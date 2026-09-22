import { extractWebsiteText, formatWebsiteCorpus } from './website-text';
import { pickRandomSlideSubset, randomSlideCount } from './slide-picker';
import { buildPostingSlots } from './posting-slots';
import { resizePostingTimes, timezoneForCountry } from './posting-times';
import { extractSearchSnippets, extractTiktokPosts, formatSearchEvidence, formatTiktokEvidence } from './competitor-search';
import { buildSlideshowSystemPrompt, buildSlideshowUserPrompt } from '../../ai/copy-prompt';

describe('website-text', () => {
  it('pulls title, description, and headings from html', () => {
    const extracted = extractWebsiteText(`
      <html><head><title>Swiply</title>
      <meta name="description" content="Slideshows on autopilot"></head>
      <body><h1>Stop posting by hand</h1><script>alert(1)</script><p>Paste your URL.</p></body></html>
    `);
    expect(extracted.title).toBe('Swiply');
    expect(extracted.description).toBe('Slideshows on autopilot');
    expect(extracted.headings).toEqual(['Stop posting by hand']);
    expect(extracted.body).toContain('Paste your URL');
    expect(extracted.body).not.toContain('alert');
    expect(formatWebsiteCorpus(extracted)).toContain('Title: Swiply');
  });
});

describe('slide-picker', () => {
  it('keeps two assets and randomizes larger sets', () => {
    expect(pickRandomSlideSubset(['a', 'b'])).toEqual(['a', 'b']);
    expect(randomSlideCount(2)).toBe(2);
    const rng = () => 0;
    expect(pickRandomSlideSubset(['a', 'b', 'c', 'd', 'e'], rng)).toHaveLength(3);
  });
});

describe('posting-times', () => {
  it('pads to the requested number of peak windows', () => {
    expect(resizePostingTimes(['09:00'], 5)).toEqual(['09:00', '07:00', '12:15', '17:00', '19:00']);
    expect(timezoneForCountry('United Kingdom')).toBe('Europe/London');
  });
});

describe('posting-slots', () => {
  it('builds future daily slots from wall-clock times', () => {
    const from = new Date('2026-09-21T12:00:00.000Z');
    const slots = buildPostingSlots({
      cadence: 'daily',
      timesOfDay: ['09:00', '18:00'],
      postsPerPeriod: 2,
      timeZone: 'UTC',
      from,
    });
    expect(slots.length).toBeGreaterThanOrEqual(12);
    expect(slots.every((slot) => slot.getTime() > from.getTime())).toBe(true);
  });
});

describe('copy-prompt', () => {
  it('asks for short TikTok slides tied to the site', () => {
    const system = buildSlideshowSystemPrompt({
      topic: 'pricing',
      goal: 'traffic',
      slideCount: 4,
      voiceContext: 'direct',
    });
    expect(system).toContain('3–12 words');
    expect(system).toContain('exactly 4 slides');
    expect(system).toContain('hashtag in English');
    const user = buildSlideshowUserPrompt({
      topic: 'pricing',
      goal: 'traffic',
      slideCount: 4,
      voiceContext: 'direct',
      websiteBrief: 'Swiply posts slideshows.',
      tiktokInsights: 'Listicles with a wait-for-it close.',
      assetNames: ['Dashboard', 'Pricing'],
      language: 'Spanish',
    });
    expect(user).toContain('Business website brief');
    expect(user).toContain('1. Dashboard');
    expect(user).toContain('Competitor TikTok patterns to beat');
    expect(user).toContain('Language: Spanish');
    const spanish = buildSlideshowSystemPrompt({
      topic: 'pricing',
      goal: 'traffic',
      slideCount: 4,
      voiceContext: 'direct',
      language: 'Spanish',
    });
    expect(spanish).toContain('hashtag in Spanish');
  });
});

describe('competitor-search', () => {
  it('pulls titles, snippets, and tiktok urls from DuckDuckGo html', () => {
    const html = `
      <div class="result results_links">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.tiktok.com%2F%40capcut">CapCut slideshows that convert</a>
        <a class="result__snippet" href="#">Listicle Photo Mode posts with a wait-for-it last slide.</a>
      </div>
      <div class="result results_links">
        <a class="result__a" href="https://www.tiktok.com/@canva">Canva vs Photo Mode</a>
        <div class="result__snippet">Carousel hooks that name the pain in 6 words.</div>
      </div>
    `;
    const snippets = extractSearchSnippets(html);
    expect(snippets[0]?.title).toContain('CapCut');
    expect(snippets[0]?.url).toContain('tiktok.com/@capcut');
    expect(snippets[1]?.snippet).toContain('Carousel hooks');
    expect(formatSearchEvidence(snippets)).toContain('CapCut slideshows');
  });

  it('turns TikAPI search payloads into ranked competitor posts', () => {
    const posts = extractTiktokPosts({
      itemList: [
        {
          id: '111',
          desc: 'Wait for the last slide',
          imagePost: { images: [{}] },
          author: { uniqueId: 'capcut' },
          stats: { playCount: 1400000, diggCount: 82000 },
        },
        {
          id: '222',
          desc: 'Quiet opener',
          author: { uniqueId: 'canva' },
          stats: { playCount: 9000, diggCount: 400 },
        },
      ],
    });
    expect(posts[0]?.author).toBe('capcut');
    expect(posts[0]?.photoMode).toBe(true);
    expect(formatTiktokEvidence(posts)).toContain('@capcut');
    expect(formatTiktokEvidence(posts)).toContain('1.4M plays');
  });
});

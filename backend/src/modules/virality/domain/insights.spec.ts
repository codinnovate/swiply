import { buildInsights, type InsightPost } from './insights';
import type { ViralityScore } from './virality-score';

const score = (total: number, hook = 15): ViralityScore => ({
  total_score: total,
  breakdown: {
    hook_strength: { score: hook, max: 25, reasoning: '' },
    reply_bait: { score: 20, max: 25, reasoning: '' },
    emotional_charge: { score: 12, max: 15, reasoning: '' },
    format_structure: { score: 12, max: 15, reasoning: '' },
    niche_consistency: { score: 8, max: 10, reasoning: '' },
    risk_factors: { score: 0, max: 0, reasoning: 'none' },
    timing: { score: 8, max: 10, reasoning: '' },
  },
  top_strength: '',
  top_weakness: '',
  suggestions: ['x'],
});

const now = new Date('2026-09-24T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const base = (index: number, overrides: Partial<InsightPost> = {}): InsightPost => ({
  text: 'A statement.',
  postedAt: daysAgo(index + 1),
  isThread: false,
  linkLocation: 'none',
  hashtagCount: 0,
  mediaType: 'none',
  score: score(50),
  ...overrides,
});

describe('buildInsights', () => {
  it('waits for ten scored posts', () => {
    const result = buildInsights(
      Array.from({ length: 9 }, (_, i) => base(i)),
      now,
    );
    expect(result).toEqual({
      status: 'needs_more_posts',
      scoredPostCount: 9,
      minimumPosts: 10,
      insights: [],
    });
  });

  it('names the weakest category relative to its maximum', () => {
    const posts = Array.from({ length: 10 }, (_, i) => base(i, { score: score(50, 6) }));
    const [insight] = buildInsights(posts, now).insights;
    expect(insight.id).toBe('weakest_category:hook_strength');
    expect(insight.message).toContain('6/25');
  });

  it('spots question endings, stale threads, and links in the main post', () => {
    const posts = [
      ...[0, 1, 2].map((i) => base(i, { text: 'What do you think?', score: score(70) })),
      base(3, { linkLocation: 'main_post' }),
      base(4, { linkLocation: 'main_post' }),
      ...[5, 6, 7].map((i) => base(i, { score: score(45) })),
      base(14, { isThread: true, score: score(75) }),
      base(20, { isThread: true, score: score(75) }),
    ];
    const ids = buildInsights(posts, now).insights.map((insight) => insight.id);
    expect(ids[0]).toBe('links_in_main_post');
    expect(ids).toEqual(expect.arrayContaining(['question_endings', 'threads_outperform']));
    const thread = buildInsights(posts, now).insights.find(
      (insight) => insight.id === 'threads_outperform',
    );
    expect(thread?.message).toContain("haven't posted a thread in 15 days");
  });

  it('caps the card at four insights', () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      base(i, {
        text: i % 2 ? 'Why?' : 'No.',
        hashtagCount: 4,
        linkLocation: i < 3 ? 'main_post' : 'none',
        isThread: i > 8,
        mediaType: i % 3 ? 'image' : 'none',
        score: score(i % 2 ? 80 : 40, 3),
      }),
    );
    expect(buildInsights(posts, now).insights.length).toBeLessThanOrEqual(4);
  });
});

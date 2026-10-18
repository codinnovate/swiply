import {
  engagementRate,
  extractHashtags,
  hashtagStats,
  rankAdsForCompany,
  resolveTiktokHandle,
  summarize,
  weeklyPerformance,
} from './competitor-analysis';
import type { CompetitorAd, CompetitorVideo } from './competitor.types';

function video(id: string, createdAt: string, views: number, hashtags: string[] = [], extra: Partial<CompetitorVideo> = {}): CompetitorVideo {
  const metrics = { views, likes: views / 10, comments: 0, shares: 0, saves: 0 };
  return {
    id,
    url: `https://www.tiktok.com/@brand/video/${id}`,
    caption: '',
    hashtags,
    coverUrl: null,
    durationSeconds: 15,
    createdAt,
    ...metrics,
    engagementRate: engagementRate(metrics),
    isPromoted: false,
    isPinned: false,
    music: null,
    ...extra,
  };
}

function ad(id: string, advertiserName: string, lastShownAt: string | null, paidFor: string | null = null): CompetitorAd {
  return {
    id,
    advertiserName,
    paidFor,
    firstShownAt: null,
    lastShownAt,
    status: 'active',
    reach: null,
    videoUrls: [],
    imageUrls: [],
    libraryUrl: '',
  };
}

describe('resolveTiktokHandle', () => {
  it('squashes a company name into a handle', () => {
    expect(resolveTiktokHandle('Blue Apron')).toBe('blueapron');
    expect(resolveTiktokHandle("Trader Joe's")).toBe('traderjoes');
  });

  it('prefers an explicit handle, with or without @', () => {
    expect(resolveTiktokHandle('Duolingo', '@Duolingo_US')).toBe('duolingo_us');
    expect(resolveTiktokHandle('Duolingo', '  ')).toBe('duolingo');
  });

  it('reads the handle out of a profile or video URL', () => {
    expect(resolveTiktokHandle('https://www.tiktok.com/@gymshark?lang=en')).toBe('gymshark');
    expect(resolveTiktokHandle('x', 'tiktok.com/@nike.running/video/123')).toBe('nike.running');
  });

  it('rejects names that leave nothing valid or run past 24 characters', () => {
    expect(resolveTiktokHandle('!!')).toBeNull();
    expect(resolveTiktokHandle('A very long company name incorporated')).toBeNull();
  });
});

describe('extractHashtags', () => {
  it('merges provider tags with inline ones, lowercased and deduped', () => {
    expect(extractHashtags('New drop 🔥 #FYP #summerSale #fyp', ['SummerSale', '#ootd'])).toEqual([
      'summersale',
      'ootd',
      'fyp',
    ]);
  });

  it('keeps non-Latin hashtags', () => {
    expect(extractHashtags('#café #日本')).toEqual(['café', '日本']);
  });
});

describe('engagementRate', () => {
  it('is interactions over views and 0 without views', () => {
    expect(engagementRate({ views: 1000, likes: 80, comments: 10, shares: 5, saves: 5 })).toBe(0.1);
    expect(engagementRate({ views: 0, likes: 5, comments: 0, shares: 0, saves: 0 })).toBe(0);
  });
});

describe('hashtagStats', () => {
  it('ranks by uses, then average views', () => {
    const stats = hashtagStats([
      video('1', '2026-09-01T10:00:00.000Z', 1000, ['fyp', 'sale']),
      video('2', '2026-09-03T10:00:00.000Z', 3000, ['fyp']),
      video('3', '2026-09-05T10:00:00.000Z', 9000, ['launch']),
    ]);
    expect(stats.map((stat) => stat.tag)).toEqual(['fyp', 'launch', 'sale']);
    expect(stats[0]).toEqual({
      tag: 'fyp',
      uses: 2,
      totalViews: 4000,
      avgViews: 2000,
      avgEngagementRate: 0.1,
      lastUsedAt: '2026-09-03T10:00:00.000Z',
    });
  });
});

describe('summarize', () => {
  it('computes totals, median, cadence and best posting slot', () => {
    const videos = [
      video('1', '2026-09-01T10:00:00.000Z', 100), // Tuesday 10:00
      video('2', '2026-09-08T18:00:00.000Z', 900, [], { isPromoted: true }), // Tuesday 18:00
      video('3', '2026-09-12T18:00:00.000Z', 500), // Saturday 18:00
      video('4', '2026-09-15T10:00:00.000Z', 300), // Tuesday 10:00
    ];
    const summary = summarize(videos, hashtagStats(videos));
    expect(summary).toMatchObject({
      videosAnalyzed: 4,
      totalViews: 1800,
      avgViews: 450,
      medianViews: 400,
      postsPerWeek: 2,
      promotedCount: 1,
      topHashtag: null,
      bestWeekday: 6,
      bestHourUtc: 18,
      firstPostAt: '2026-09-01T10:00:00.000Z',
      lastPostAt: '2026-09-15T10:00:00.000Z',
    });
  });

  it('floors cadence at one week and handles no videos', () => {
    const burst = [video('1', '2026-09-01T10:00:00.000Z', 1), video('2', '2026-09-02T10:00:00.000Z', 1)];
    expect(summarize(burst, []).postsPerWeek).toBe(2);
    expect(summarize([], [])).toMatchObject({ videosAnalyzed: 0, avgViews: 0, medianViews: 0, postsPerWeek: 0, bestWeekday: null });
  });
});

describe('weeklyPerformance', () => {
  it('buckets by Monday-start UTC week, oldest first', () => {
    const points = weeklyPerformance([
      video('3', '2026-09-14T00:00:00.000Z', 50), // Monday
      video('1', '2026-09-07T09:00:00.000Z', 100), // Monday
      video('2', '2026-09-13T23:59:00.000Z', 200), // Sunday, same week as #1
    ]);
    expect(points).toEqual([
      { weekStart: '2026-09-07', videos: 2, views: 300, engagementRate: 0.1 },
      { weekStart: '2026-09-14', videos: 1, views: 50, engagementRate: 0.1 },
    ]);
  });
});

describe('rankAdsForCompany', () => {
  it("keeps the company's own ads, newest first", () => {
    const ads = [
      ad('1', 'Reseller Ltd', '2026-09-20'),
      ad('2', 'Gymshark Ltd.', '2026-08-01'),
      ad('3', 'Agency', '2026-09-01', 'GYMSHARK'),
    ];
    expect(rankAdsForCompany(ads, 'Gymshark').map((item) => item.id)).toEqual(['3', '2']);
  });

  it('falls back to every result when no advertiser matches', () => {
    const ads = [ad('1', 'Other', '2026-01-01'), ad('2', 'Else', '2026-02-01')];
    expect(rankAdsForCompany(ads, 'Gymshark').map((item) => item.id)).toEqual(['2', '1']);
  });
});

import {
  DEFAULT_XP_CONFIG,
  buildAccountXp,
  calculatePostXp,
  levelForXp,
  type XpPostInput,
} from './xp';

const now = new Date('2026-09-25T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const input = (postId: string, overrides: Partial<XpPostInput> = {}): XpPostInput => {
  const engagement = overrides.engagement ?? { likes: 0, reposts: 0, replies: 0 };
  return {
    postId,
    postedAt: new Date(now.getTime() - DAY),
    text: `post ${postId}`,
    contentHash: `hash-${postId}`,
    engagement,
    readings: [{ milestone: 'latest', capturedAt: now, engagement }],
    authorDirectReplies: 0,
    authorReplies: {},
    ...overrides,
  };
};

describe('calculatePostXp', () => {
  it('weights conversation far above likes', () => {
    const result = calculatePostXp(
      { like: 10, repost: 2, replyReceived: 3, authorReplyToReply: 1 },
      DEFAULT_XP_CONFIG,
    );
    expect(result.xp).toBe(5 + 2 + 40.5 + 75);
    expect(result.breakdown.find((line) => line.signal === 'replyReceived')).toEqual({
      signal: 'replyReceived',
      count: 3,
      weight: 13.5,
      xp: 40.5,
      availability: 'measured',
    });
  });

  it('counts signals FxTwitter cannot see as zero, whatever is passed', () => {
    const result = calculatePostXp(
      { like: 2, reported: 5, profileClickToEngagement: 9 },
      DEFAULT_XP_CONFIG,
    );
    expect(result.xp).toBe(1);
    const reported = result.breakdown.find((line) => line.signal === 'reported');
    expect(reported).toMatchObject({ count: 0, xp: 0, availability: 'unavailable' });
  });

  it('never goes below zero, but keeps the raw penalty for insights', () => {
    const everything = Object.fromEntries(
      Object.keys(DEFAULT_XP_CONFIG.weights).map((signal) => [signal, 'measured' as const]),
    ) as Parameters<typeof calculatePostXp>[2];
    const result = calculatePostXp({ like: 4, reported: 1 }, DEFAULT_XP_CONFIG, everything);
    expect(result).toMatchObject({ xp: 0, earnedXp: 2, penaltyXp: -369 });
  });

  it('uses the configured weights', () => {
    const config = { weights: { ...DEFAULT_XP_CONFIG.weights, like: 2 } };
    expect(calculatePostXp({ like: 3 }, config).xp).toBe(6);
  });
});

describe('levelForXp', () => {
  it('starts at level 1 and reports progress to the next', () => {
    expect(levelForXp(0, DEFAULT_XP_CONFIG)).toEqual({
      level: 1,
      levelStartXp: 0,
      nextLevelXp: 50,
      xpIntoLevel: 0,
      xpForNextLevel: 50,
    });
    expect(levelForXp(260, DEFAULT_XP_CONFIG)).toMatchObject({
      level: 3,
      levelStartXp: 200,
      nextLevelXp: 450,
      xpIntoLevel: 60,
      xpForNextLevel: 190,
    });
  });

  it('flattens: each level needs more XP than the last', () => {
    const cost = (level: number) =>
      levelForXp(DEFAULT_XP_CONFIG.levelBaseXp * (level - 1) ** 2, DEFAULT_XP_CONFIG);
    expect(cost(10).level).toBe(10);
    expect(cost(11).levelStartXp - cost(10).levelStartXp).toBeGreaterThan(
      cost(3).levelStartXp - cost(2).levelStartXp,
    );
  });
});

describe('buildAccountXp', () => {
  it("doesn't count the author's own thread replies as replies received", () => {
    const { posts } = buildAccountXp(
      [input('1', { engagement: { likes: 0, reposts: 0, replies: 3 }, authorDirectReplies: 1 })],
      DEFAULT_XP_CONFIG,
      now,
    );
    expect(posts[0].xp).toBe(27);
  });

  it('decays reply-backs to the same replier across recent posts', () => {
    const answered = { ana: new Date(now.getTime() - HOUR) };
    const { posts } = buildAccountXp(
      [
        input('1', { postedAt: new Date(now.getTime() - 3 * DAY), authorReplies: answered }),
        input('2', { postedAt: new Date(now.getTime() - 2 * DAY), authorReplies: answered }),
        input('3', {
          postedAt: new Date(now.getTime() - DAY),
          authorReplies: { ...answered, bo: new Date(now.getTime() - HOUR) },
        }),
      ],
      DEFAULT_XP_CONFIG,
      now,
    );
    // Ana: 1, then ½, then ⅓ (+ Bo at full value on the third post).
    expect(posts.map((post) => post.xp)).toEqual([75, 37.5, 100]);
  });

  it('only counts reply-backs made by the time of each reading', () => {
    const postedAt = new Date(now.getTime() - 2 * DAY);
    const h1 = new Date(postedAt.getTime() + HOUR);
    const { posts } = buildAccountXp(
      [
        input('1', {
          postedAt,
          engagement: { likes: 10, reposts: 0, replies: 2 },
          readings: [
            { milestone: 'h1', capturedAt: h1, engagement: { likes: 2, reposts: 0, replies: 0 } },
            {
              milestone: 'latest',
              capturedAt: now,
              engagement: { likes: 10, reposts: 0, replies: 2 },
            },
          ],
          authorReplies: { ana: new Date(postedAt.getTime() + 3 * HOUR) },
        }),
      ],
      DEFAULT_XP_CONFIG,
      now,
    );
    expect(posts[0].history.map((point) => point.xp)).toEqual([1, 5 + 27 + 75]);
  });

  it('pays duplicate content once, to the best-performing copy', () => {
    const { posts, account } = buildAccountXp(
      [
        input('1', {
          contentHash: 'same',
          postedAt: new Date(now.getTime() - 3 * DAY),
          engagement: { likes: 2, reposts: 0, replies: 0 },
        }),
        input('2', {
          contentHash: 'same',
          postedAt: new Date(now.getTime() - 2 * DAY),
          engagement: { likes: 20, reposts: 0, replies: 0 },
        }),
        // Same hash but outside the window: earns on its own.
        input('3', {
          contentHash: 'same',
          postedAt: new Date(now.getTime() - 20 * DAY),
          engagement: { likes: 4, reposts: 0, replies: 0 },
        }),
      ],
      DEFAULT_XP_CONFIG,
      now,
    );
    const byId = new Map(posts.map((post) => [post.postId, post]));
    expect(byId.get('1')).toMatchObject({ xp: 0, duplicateOf: '2' });
    expect(byId.get('2')).toMatchObject({ xp: 10, duplicateOf: null });
    expect(byId.get('3')).toMatchObject({ xp: 2, duplicateOf: null });
    expect(account.total).toBe(12);
  });

  it('never treats text-less posts as duplicates', () => {
    const likes = { likes: 2, reposts: 0, replies: 0 };
    const { account } = buildAccountXp(
      [
        input('1', { text: '', contentHash: 'media', engagement: likes }),
        input('2', { text: ' ', contentHash: 'media', engagement: likes }),
      ],
      DEFAULT_XP_CONFIG,
      now,
    );
    expect(account.total).toBe(2);
  });

  it('totals all time and the last 7 and 30 days, with a level', () => {
    const likes = (count: number) => ({ likes: count, reposts: 0, replies: 0 });
    const { account } = buildAccountXp(
      [
        input('1', { postedAt: new Date(now.getTime() - DAY), engagement: likes(20) }),
        input('2', { postedAt: new Date(now.getTime() - 10 * DAY), engagement: likes(40) }),
        input('3', { postedAt: new Date(now.getTime() - 60 * DAY), engagement: likes(100) }),
      ],
      DEFAULT_XP_CONFIG,
      now,
    );
    expect(account).toMatchObject({ total: 80, last7Days: 10, last30Days: 30 });
    expect(account.level.level).toBe(2);
  });
});

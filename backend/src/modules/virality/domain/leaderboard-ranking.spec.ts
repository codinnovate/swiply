import {
  periodActivity,
  rankByPeriod,
  rankLeaderboard,
  type LeaderboardCandidate,
} from './leaderboard-ranking';

const now = new Date('2026-09-24T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const candidate = (
  username: string,
  scores: number[],
  overrides: Partial<LeaderboardCandidate> = {},
): LeaderboardCandidate => ({
  username,
  displayName: username,
  category: 'user',
  posts: scores.map((totalScore, index) => ({
    postedAt: new Date(now.getTime() - (index + 1) * DAY),
    totalScore,
    replies: 4,
    xp: 10,
  })),
  comments: [],
  ...overrides,
});

/** A candidate whose posts land at exact hours-ago offsets, for period-boundary tests. */
const candidateAt = (
  username: string,
  hoursAgo: number[],
  overrides: Partial<LeaderboardCandidate> = {},
): LeaderboardCandidate => ({
  username,
  displayName: username,
  category: 'user',
  posts: hoursAgo.map((hours) => ({
    postedAt: new Date(now.getTime() - hours * HOUR),
    totalScore: 0,
    replies: 0,
    xp: 10,
  })),
  comments: [],
  ...overrides,
});

const commentsAt = (hoursAgo: number[]) =>
  hoursAgo.map((hours) => ({ postedAt: new Date(now.getTime() - hours * HOUR) }));

describe('periodActivity', () => {
  it("sums the XP earned by the period's posts", () => {
    const activity = periodActivity(
      {
        posts: [
          { postedAt: new Date(now.getTime() - HOUR), totalScore: 0, replies: 5, xp: 67.5 },
          { postedAt: new Date(now.getTime() - 2 * HOUR), totalScore: 0, replies: 2, xp: 102.3 },
          { postedAt: new Date(now.getTime() - 2 * DAY), totalScore: 0, replies: 9, xp: 500 },
        ],
        comments: commentsAt([1, 3, 5]),
      },
      'day',
      now,
    );
    // Comments are shown as activity but earn no XP of their own.
    expect(activity).toEqual({ posts: 2, comments: 3, repliesReceived: 7, xp: 169.8 });
  });

  it('counts everything recorded for all time, with no 30-day cutoff', () => {
    const activity = periodActivity(
      {
        posts: [
          { postedAt: new Date(now.getTime() - 2 * HOUR), totalScore: 0, replies: 0, xp: 1 },
          { postedAt: new Date(now.getTime() - 90 * DAY), totalScore: 0, replies: 0, xp: 2 },
        ],
        comments: commentsAt([24 * 60]),
      },
      'all',
      now,
    );
    expect(activity).toMatchObject({ posts: 2, comments: 1, xp: 3 });
  });
});

describe('rankLeaderboard', () => {
  it('ranks by XP, not average score', () => {
    const entries = rankLeaderboard(
      [
        // A higher score doesn't win: earned XP ranks first.
        candidate('steady', [90, 90, 90]),
        candidate('prolific', [...Array(14).fill(10)], { category: 'featured' }),
      ],
      now,
    );
    expect(
      entries.map(({ username, rank, avgScore, periods }) => ({
        username,
        rank,
        avgScore,
        posts: periods.all.posts,
      })),
    ).toEqual([
      // avgScore is sampled from only the newest 10 posts; the post count is uncapped.
      { username: 'prolific', rank: 1, avgScore: 10, posts: 14 },
      { username: 'steady', rank: 2, avgScore: 90, posts: 3 },
    ]);
  });

  it('ranks one conversation-starting post above several quiet ones', () => {
    const quiet = candidate('quiet', Array(6).fill(50));
    const talker = candidate('talker', [50, 50, 50]);
    talker.posts[0].xp = 200;
    const entries = rankLeaderboard([quiet, talker], now);
    expect(entries.map((entry) => entry.username)).toEqual(['talker', 'quiet']);
  });

  it('leaves out accounts with fewer than three posts in the last 30 days', () => {
    const stale = candidate('stale', [90, 90, 90]);
    stale.posts[2].postedAt = new Date(now.getTime() - 40 * DAY);
    expect(rankLeaderboard([stale, candidate('new', [99])], now)).toEqual([]);
  });

  it('shares a rank on exact ties', () => {
    const ranks = rankLeaderboard(
      [candidate('a', [50, 50, 50]), candidate('b', [50, 50, 50]), candidate('c', [40, 40, 40])],
      now,
    ).map((entry) => entry.rank);
    expect(ranks).toEqual([1, 1, 3]);
  });

  it('computes day, week, and all-time activity separately', () => {
    const entries = rankLeaderboard(
      [
        // 3 posts today, nothing else.
        candidateAt('burstPoster', [1, 2, 3]),
        // 10 posts earlier in the month — none today, none in the last week.
        candidateAt('steadyOverMonth', [
          24 * 9,
          24 * 10,
          24 * 12,
          24 * 14,
          24 * 16,
          24 * 18,
          24 * 20,
          24 * 24,
          24 * 26,
          24 * 29,
        ]),
      ],
      now,
    );
    const burst = entries.find((entry) => entry.username === 'burstPoster')!;
    const steady = entries.find((entry) => entry.username === 'steadyOverMonth')!;
    expect([burst.periods.day.posts, burst.periods.week.posts, burst.periods.all.posts]).toEqual([
      3, 3, 3,
    ]);
    expect([steady.periods.day.posts, steady.periods.week.posts, steady.periods.all.posts]).toEqual(
      [0, 0, 10],
    );
  });
});

describe('rankByPeriod', () => {
  it('re-ranks the same accounts differently for day/week versus all time', () => {
    const entries = rankLeaderboard(
      [
        // All 3 posts today; nothing else this month.
        candidateAt('burstPoster', [1, 2, 3]),
        // 10 posts, but the most recent was over a week ago — a strong
        // month, a quiet week, an empty day.
        candidateAt('steadyOverMonth', [
          24 * 9,
          24 * 10,
          24 * 12,
          24 * 14,
          24 * 16,
          24 * 18,
          24 * 20,
          24 * 24,
          24 * 26,
          24 * 29,
        ]),
      ],
      now,
    );

    expect(rankByPeriod(entries, 'day').map((entry) => entry.username)).toEqual([
      'burstPoster',
      'steadyOverMonth',
    ]);
    expect(rankByPeriod(entries, 'week').map((entry) => entry.username)).toEqual([
      'burstPoster',
      'steadyOverMonth',
    ]);
    expect(rankByPeriod(entries, 'all').map((entry) => entry.username)).toEqual([
      'steadyOverMonth',
      'burstPoster',
    ]);
  });
});

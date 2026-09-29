import { rankLeaderboard, type LeaderboardCandidate } from './leaderboard-ranking';

const now = new Date('2026-09-24T12:00:00Z');
const candidate = (
  username: string,
  scores: number[],
  overrides: Partial<LeaderboardCandidate> = {},
): LeaderboardCandidate => ({
  username,
  displayName: username,
  category: 'user',
  posts: scores.map((totalScore, index) => ({
    postedAt: new Date(now.getTime() - (index + 1) * 86_400_000),
    totalScore,
    replies: 4,
  })),
  ...overrides,
});

describe('rankLeaderboard', () => {
  it('ranks by average score over the last 10 posts in the window', () => {
    const entries = rankLeaderboard(
      [
        candidate('steady', [60, 60, 60]),
        // Only the newest ten count: the eleventh (a 0) is ignored.
        candidate('prolific', [...Array(10).fill(70), 0], { category: 'featured' }),
      ],
      now,
    );
    expect(
      entries.map(({ username, rank, avgScore, postsCounted }) => ({
        username,
        rank,
        avgScore,
        postsCounted,
      })),
    ).toEqual([
      { username: 'prolific', rank: 1, avgScore: 70, postsCounted: 10 },
      { username: 'steady', rank: 2, avgScore: 60, postsCounted: 3 },
    ]);
  });

  it('leaves out accounts with fewer than three posts in the last 30 days', () => {
    const stale = candidate('stale', [90, 90, 90]);
    stale.posts[2].postedAt = new Date(now.getTime() - 40 * 86_400_000);
    expect(rankLeaderboard([stale, candidate('new', [99])], now)).toEqual([]);
  });

  it('shares a rank on exact ties', () => {
    const ranks = rankLeaderboard(
      [candidate('a', [50, 50, 50]), candidate('b', [50, 50, 50]), candidate('c', [40, 40, 40])],
      now,
    ).map((entry) => entry.rank);
    expect(ranks).toEqual([1, 1, 3]);
  });
});

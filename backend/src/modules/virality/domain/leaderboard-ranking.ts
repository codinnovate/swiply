/**
 * One window ranks featured accounts and PostLock users alike: the average
 * virality score of an account's last 10 scored posts from the past 30 days.
 * Accounts with fewer than 3 such posts aren't ranked yet.
 */
export const LEADERBOARD_WINDOW = { posts: 10, days: 30, minimumPosts: 3 } as const;

export type LeaderboardCategory = 'featured' | 'user';

export interface LeaderboardCandidate {
  username: string;
  displayName: string;
  avatarUrl?: string;
  niche?: string;
  category: LeaderboardCategory;
  /** The account's scored posts from the window, in any order. */
  posts: Array<{ postedAt: Date; totalScore: number; replies: number }>;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  niche?: string;
  category: LeaderboardCategory;
  avgScore: number;
  avgReplies: number;
  postsCounted: number;
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export function rankLeaderboard(
  candidates: LeaderboardCandidate[],
  now = new Date(),
): LeaderboardEntry[] {
  const cutoff = now.getTime() - LEADERBOARD_WINDOW.days * 86_400_000;
  const scored = candidates.flatMap((candidate) => {
    const windowPosts = candidate.posts
      .filter((post) => post.postedAt.getTime() >= cutoff)
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
      .slice(0, LEADERBOARD_WINDOW.posts);
    if (windowPosts.length < LEADERBOARD_WINDOW.minimumPosts) return [];
    const sum = (pick: (post: (typeof windowPosts)[number]) => number) =>
      windowPosts.reduce((total, post) => total + pick(post), 0);
    return [
      {
        username: candidate.username,
        displayName: candidate.displayName,
        avatarUrl: candidate.avatarUrl,
        niche: candidate.niche,
        category: candidate.category,
        avgScore: oneDecimal(sum((post) => post.totalScore) / windowPosts.length),
        avgReplies: oneDecimal(sum((post) => post.replies) / windowPosts.length),
        postsCounted: windowPosts.length,
      },
    ];
  });

  return assignRanks(
    scored.sort(
      (a, b) =>
        b.avgScore - a.avgScore ||
        b.avgReplies - a.avgReplies ||
        a.username.localeCompare(b.username),
    ),
  );
}

/** Dense-by-position ranks where exact ties share a rank (1, 2, 2, 4). */
export function assignRanks<T extends Omit<LeaderboardEntry, 'rank'>>(
  sorted: T[],
): Array<T & { rank: number }> {
  return sorted.map((entry, index) => {
    let rank = index + 1;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (
        sorted[previous].avgScore !== entry.avgScore ||
        sorted[previous].avgReplies !== entry.avgReplies
      )
        break;
      rank = previous + 1;
    }
    return { ...entry, rank };
  });
}

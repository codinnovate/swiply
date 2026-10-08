/**
 * Ranked by XP: engagement weighted the way X's own ranking weighs it (see
 * domain/xp.ts), earned by the posts an account published in the period. The
 * app views the same ranked set by three periods — today, this week, or all
 * time (everything POSTLOCK has recorded for the account) — each with its own
 * XP and rank. Ties break on average score over the most recent posts, then
 * average replies, then username. Users with fewer than 3 posts in the last
 * 30 days aren't ranked in any period; featured accounts are always listed.
 */
export const LEADERBOARD_WINDOW = { posts: 10, days: 30, minimumPosts: 3 } as const;

const DAY_MS = 86_400_000;

export type LeaderboardCategory = 'featured' | 'user';
export type LeaderboardPeriod = 'day' | 'week' | 'all';

export interface LeaderboardCandidate {
  username: string;
  displayName: string;
  avatarUrl?: string;
  niche?: string;
  category: LeaderboardCategory;
  /**
   * Every recorded post, in any order, with the XP it earned. Score is 0 for
   * posts not yet scored.
   */
  posts: Array<{ postedAt: Date; totalScore: number; replies: number; xp: number }>;
  /** Every recorded reply the account left on someone else's post. */
  comments: Array<{ postedAt: Date }>;
}

export interface PeriodActivity {
  xp: number;
  posts: number;
  comments: number;
  /** Replies drawn by this period's posts. */
  repliesReceived: number;
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
  /** Activity and XP over the last 24 hours, last 7 days, and all recorded time. */
  periods: Record<LeaderboardPeriod, PeriodActivity>;
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

const PERIOD_MS: Record<LeaderboardPeriod, number> = {
  day: DAY_MS,
  week: 7 * DAY_MS,
  all: Number.POSITIVE_INFINITY,
};

export function periodActivity(
  candidate: Pick<LeaderboardCandidate, 'posts' | 'comments'>,
  period: LeaderboardPeriod,
  now = new Date(),
): PeriodActivity {
  const inPeriod = ({ postedAt }: { postedAt: Date }) =>
    now.getTime() - postedAt.getTime() < PERIOD_MS[period];
  const posts = candidate.posts.filter(inPeriod);
  const comments = candidate.comments.filter(inPeriod).length;
  return {
    xp: oneDecimal(posts.reduce((total, post) => total + post.xp, 0)),
    posts: posts.length,
    comments,
    repliesReceived: posts.reduce((total, post) => total + post.replies, 0),
  };
}

export function rankLeaderboard(
  candidates: LeaderboardCandidate[],
  now = new Date(),
): LeaderboardEntry[] {
  const cutoff = now.getTime() - LEADERBOARD_WINDOW.days * DAY_MS;
  const scored = candidates.flatMap((candidate) => {
    const recent = candidate.posts
      .filter((post) => post.postedAt.getTime() >= cutoff)
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
    const featured = candidate.category === 'featured';
    if (!featured && recent.length < LEADERBOARD_WINDOW.minimumPosts) return [];
    // Average score/replies are a tiebreaker, sampled from the most recent
    // posts only — how active someone is ranks, not how well they score.
    const sample = recent.slice(0, LEADERBOARD_WINDOW.posts);
    const average = (pick: (post: (typeof sample)[number]) => number) =>
      sample.length === 0
        ? 0
        : oneDecimal(sample.reduce((total, post) => total + pick(post), 0) / sample.length);
    return [
      {
        username: candidate.username,
        displayName: candidate.displayName,
        avatarUrl: candidate.avatarUrl,
        niche: candidate.niche,
        category: candidate.category,
        avgScore: average((post) => post.totalScore),
        avgReplies: average((post) => post.replies),
        periods: {
          day: periodActivity(candidate, 'day', now),
          week: periodActivity(candidate, 'week', now),
          all: periodActivity(candidate, 'all', now),
        },
      },
    ];
  });

  return rankByPeriod(scored, 'all');
}

/**
 * Sorts and ranks by XP for one period (day/week/all), sharing a rank on
 * exact ties (1, 2, 2, 4). Safe to call again on an already-ranked, possibly
 * filtered list to re-rank for a different period or subset.
 */
export function rankByPeriod<
  T extends Pick<LeaderboardEntry, 'periods' | 'avgScore' | 'avgReplies' | 'username'>,
>(entries: T[], period: LeaderboardPeriod): Array<T & { rank: number }> {
  const xp = (entry: T) => entry.periods[period].xp;
  const sorted = [...entries].sort(
    (a, b) =>
      xp(b) - xp(a) ||
      b.avgScore - a.avgScore ||
      b.avgReplies - a.avgReplies ||
      a.username.localeCompare(b.username),
  );
  return sorted.map((entry, index) => {
    let rank = index + 1;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (
        xp(sorted[previous]) !== xp(entry) ||
        sorted[previous].avgScore !== entry.avgScore ||
        sorted[previous].avgReplies !== entry.avgReplies
      )
        break;
      rank = previous + 1;
    }
    return { ...entry, rank };
  });
}

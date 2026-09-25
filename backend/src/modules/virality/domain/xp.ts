/**
 * POSTLOCK XP: what a post actually earned, weighted the way X's own ranking
 * weighs engagement, so XP rewards conversation over passive likes.
 *
 * The default weights come from the heavy-ranker table in X's open-sourced
 * `twitter/the-algorithm` (2023). X has since said ranking moved to a
 * Grok-based system, so the exact numbers may be stale even if the ordering
 * (author reply-backs > replies > reposts > likes) reportedly still holds.
 * They're only defaults: the live values are the remotely editable XP config.
 */
export const XP_SIGNALS = [
  'like',
  'repost',
  'replyReceived',
  'profileClickToEngagement',
  'conversationClickEngagement',
  'authorReplyToReply',
  'mutedOrBlocked',
  'reported',
] as const;
export type XpSignal = (typeof XP_SIGNALS)[number];

export type SignalAvailability = 'measured' | 'partial' | 'unavailable';

export interface XpConfig {
  /** 0 for these built-in defaults; bumped on every edit so stored rankings recompute. */
  version: number;
  weights: Record<XpSignal, number>;
  /** Level L starts at levelBaseXp × (L − 1)². */
  levelBaseXp: number;
  /** A replier answered again within this many days counts ½, then ⅓, … */
  replierDecayWindowDays: number;
  /** The same content posted again within this many days earns XP once. */
  duplicateWindowDays: number;
}

export const DEFAULT_XP_CONFIG: XpConfig = {
  version: 0,
  weights: {
    like: 0.5,
    repost: 1,
    replyReceived: 13.5,
    profileClickToEngagement: 12,
    conversationClickEngagement: 11,
    authorReplyToReply: 75,
    mutedOrBlocked: -74,
    reported: -369,
  },
  levelBaseXp: 50,
  replierDecayWindowDays: 30,
  duplicateWindowDays: 7,
};

/**
 * What FxTwitter's public timeline exposes. Reply-backs are only seen when
 * the timeline pages include both sides of the exchange. Everything marked
 * unavailable is counted as 0, never guessed.
 */
export const FXTWITTER_SIGNAL_AVAILABILITY: Record<XpSignal, SignalAvailability> = {
  like: 'measured',
  repost: 'measured',
  replyReceived: 'measured',
  authorReplyToReply: 'partial',
  profileClickToEngagement: 'unavailable',
  conversationClickEngagement: 'unavailable',
  mutedOrBlocked: 'unavailable',
  reported: 'unavailable',
};

export const XP_AVAILABILITY_NOTE =
  'XP reflects likes, reposts, replies, and your replies back to people who replied. ' +
  "Profile-click, conversation-click, mute, block, and report data isn't public, so those count as zero.";

export type XpCounts = Partial<Record<XpSignal, number>>;

export interface XpLine {
  signal: XpSignal;
  /** May be fractional where diminishing returns apply. */
  count: number;
  weight: number;
  xp: number;
  availability: SignalAvailability;
}

export interface PostXp {
  /** Earned XP after penalties, never below 0. */
  xp: number;
  /** Sum of the positive signals. */
  earnedXp: number;
  /** Raw penalty total (≤ 0), kept for insights even when clamped away. */
  penaltyXp: number;
  breakdown: XpLine[];
}

/** `+ 0` turns -0 (a zero-count penalty) into 0. */
const round1 = (value: number) => Math.round(value * 10) / 10 + 0;

export function calculatePostXp(
  counts: XpCounts,
  config: Pick<XpConfig, 'weights'>,
  availability: Record<XpSignal, SignalAvailability> = FXTWITTER_SIGNAL_AVAILABILITY,
): PostXp {
  const breakdown = XP_SIGNALS.map((signal): XpLine => {
    const raw = availability[signal] === 'unavailable' ? 0 : (counts[signal] ?? 0);
    const count = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const weight = config.weights[signal] ?? 0;
    return {
      signal,
      count: round1(count),
      weight,
      xp: round1(count * weight),
      availability: availability[signal],
    };
  });
  const earnedXp = breakdown.filter((line) => line.xp > 0).reduce((sum, line) => sum + line.xp, 0);
  const penaltyXp = breakdown.filter((line) => line.xp < 0).reduce((sum, line) => sum + line.xp, 0);
  return {
    xp: round1(Math.max(0, earnedXp + penaltyXp)),
    earnedXp: round1(earnedXp),
    penaltyXp: round1(penaltyXp),
    breakdown,
  };
}

export interface XpLevel {
  level: number;
  /** Total XP at which the current level started. */
  levelStartXp: number;
  /** Total XP at which the next level starts. */
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/**
 * Quadratic curve: fast early (level 2 at 50 XP, about four replies) and
 * flattening later (level 10 at 4,050, level 20 at 18,050 by default).
 */
export function levelForXp(totalXp: number, config: Pick<XpConfig, 'levelBaseXp'>): XpLevel {
  const base = Math.max(1, config.levelBaseXp);
  const total = Math.max(0, totalXp);
  const level = Math.floor(Math.sqrt(total / base)) + 1;
  const levelStartXp = base * (level - 1) ** 2;
  const nextLevelXp = base * level ** 2;
  return {
    level,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel: round1(total - levelStartXp),
    xpForNextLevel: round1(nextLevelXp - total),
  };
}

export type XpMilestone = 'h1' | 'h24' | 'd7' | 'latest';

interface EngagementCounts {
  likes: number;
  reposts: number;
  replies: number;
}

export interface XpPostInput {
  postId: string;
  postedAt: Date;
  text: string;
  contentHash: string;
  engagement: EngagementCounts;
  /** Readings taken as the post aged, oldest first; the latest is `engagement`. */
  readings: Array<{ milestone: XpMilestone; capturedAt: Date; engagement: EngagementCounts }>;
  /** The author's own replies directly under the post, which X counts as replies. */
  authorDirectReplies: number;
  /** Replier handle → when the author first replied back to them on this post. */
  authorReplies: Record<string, Date>;
}

export interface PostXpResult extends PostXp {
  postId: string;
  postedAt: Date;
  /** Set when this post repeats content that already earned XP; it then earns 0. */
  duplicateOf: string | null;
  history: Array<{ milestone: XpMilestone; capturedAt: Date; xp: number }>;
}

export interface AccountXp {
  total: number;
  last7Days: number;
  last30Days: number;
  level: XpLevel;
}

const DAY_MS = 86_400_000;

/**
 * Per-post XP for one account, plus its totals. Needs every recorded post so
 * repeat repliers and duplicate content are judged against the account's full
 * recent history, not just the page being displayed.
 */
export function buildAccountXp(
  posts: XpPostInput[],
  config: XpConfig,
  now = new Date(),
): { posts: PostXpResult[]; account: AccountXp } {
  const chronological = [...posts].sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
  const decayWindow = config.replierDecayWindowDays * DAY_MS;

  const results = chronological.map((post) => {
    // Engagement pods answer each other on every post: a replier already
    // answered on k − 1 of this account's recent posts is worth 1/k here.
    const replierWeight = new Map(
      Object.keys(post.authorReplies).map((replier) => {
        const earlier = chronological.filter(
          (other) =>
            other.postId !== post.postId &&
            other.postedAt <= post.postedAt &&
            post.postedAt.getTime() - other.postedAt.getTime() <= decayWindow &&
            replier in other.authorReplies,
        ).length;
        return [replier, 1 / (earlier + 1)];
      }),
    );
    const xpAt = (engagement: EngagementCounts, at: Date) => {
      let replyBacks = 0;
      for (const [replier, answeredAt] of Object.entries(post.authorReplies)) {
        if (new Date(answeredAt) <= at) replyBacks += replierWeight.get(replier) ?? 0;
      }
      return calculatePostXp(
        {
          like: engagement.likes,
          repost: engagement.reposts,
          replyReceived: Math.max(0, engagement.replies - post.authorDirectReplies),
          authorReplyToReply: replyBacks,
        },
        config,
      );
    };
    const current = xpAt(post.engagement, now);
    return {
      postId: post.postId,
      postedAt: post.postedAt,
      ...current,
      duplicateOf: null as string | null,
      history: post.readings.map(({ milestone, capturedAt, engagement }) => ({
        milestone,
        capturedAt,
        xp: xpAt(engagement, capturedAt).xp,
      })),
    };
  });

  markDuplicates(chronological, results, config.duplicateWindowDays * DAY_MS);

  const sumSince = (ms: number) =>
    round1(
      results
        .filter((post) => now.getTime() - post.postedAt.getTime() < ms)
        .reduce((sum, post) => sum + post.xp, 0),
    );
  const total = sumSince(Number.POSITIVE_INFINITY);
  return {
    posts: results,
    account: {
      total,
      last7Days: sumSince(7 * DAY_MS),
      last30Days: sumSince(30 * DAY_MS),
      level: levelForXp(total, config),
    },
  };
}

/**
 * Deleting and re-posting the same content mustn't earn twice: within the
 * window, only the best-performing copy keeps its XP. Text-less posts (media
 * only) are never compared, since their hashes can collide.
 */
function markDuplicates(inputs: XpPostInput[], results: PostXpResult[], windowMs: number): void {
  const clusters = new Map<string, number[][]>();
  inputs.forEach((post, index) => {
    if (!post.text.trim()) return;
    const groups = clusters.get(post.contentHash) ?? [];
    const open = groups.at(-1);
    if (open && post.postedAt.getTime() - inputs[open[0]].postedAt.getTime() <= windowMs) {
      open.push(index);
    } else {
      groups.push([index]);
    }
    clusters.set(post.contentHash, groups);
  });
  for (const cluster of [...clusters.values()].flat()) {
    if (cluster.length < 2) continue;
    const keeper = cluster.reduce((best, index) =>
      results[index].xp > results[best].xp ? index : best,
    );
    for (const index of cluster) {
      if (index === keeper) continue;
      results[index].duplicateOf = results[keeper].postId;
      results[index].xp = 0;
    }
  }
}

import { createHash } from 'node:crypto';
import { DateTime, IANAZone } from 'luxon';

import type {
  XPostDetail,
  XPostEngagement,
} from '../../posting-consistency/domain/x-post-provider.interface';

export type LinkLocation = 'main_post' | 'reply' | 'none';

/** One scoreable unit: a standalone post, or a thread folded into its first post. */
export interface ScoreablePost {
  postId: string;
  url: string;
  username: string;
  kind: 'original' | 'quote';
  text: string;
  /** Text of the author's own follow-up replies, in thread order. */
  threadTexts: string[];
  quotedUsername?: string;
  quotedText?: string;
  postedAt: Date;
  mediaType: XPostDetail['mediaType'];
  isThread: boolean;
  threadLength: number;
  hasExternalLink: boolean;
  linkLocation: LinkLocation;
  hashtagCount: number;
  engagement: XPostEngagement;
  contentHash: string;
}

/**
 * Turns an account's raw timeline into scoreable posts. Reposts and replies to
 * other accounts are dropped — the rubric is for posts that stand on their own.
 * Self-replies are folded into the post that starts their thread, which is also
 * how a "link in the replies" is detected.
 */
export function buildScoreablePosts(posts: XPostDetail[], username: string): ScoreablePost[] {
  const owner = username.toLowerCase();
  const rootOf = threadRoots(posts, owner);

  const continuations = new Map<string, XPostDetail[]>();
  for (const post of posts) {
    const root = rootOf.get(post.id);
    if (!root || root === post.id) continue;
    continuations.set(root, [...(continuations.get(root) ?? []), post]);
  }

  return posts
    .filter(
      (post): post is XPostDetail & { kind: 'original' | 'quote' } =>
        post.kind === 'original' || post.kind === 'quote',
    )
    .map((post) => {
      const thread = (continuations.get(post.id) ?? []).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const linkLocation: LinkLocation = post.hasExternalLink
        ? 'main_post'
        : thread.some((reply) => reply.hasExternalLink)
          ? 'reply'
          : 'none';
      const threadTexts = thread.map((reply) => stripLeadingMentions(reply.text));
      const scoreable = {
        postId: post.id,
        url: post.url,
        username: owner,
        kind: post.kind,
        text: post.text,
        threadTexts,
        quotedUsername: post.quoted?.username,
        quotedText: post.quoted?.text,
        postedAt: post.createdAt,
        mediaType: post.mediaType,
        isThread: thread.length > 0,
        threadLength: thread.length + 1,
        hasExternalLink: linkLocation !== 'none',
        linkLocation,
        hashtagCount: post.hashtagCount,
        engagement: post.engagement,
      };
      return { ...scoreable, contentHash: contentHash(scoreable) };
    });
}

/**
 * Maps each of the owner's posts that starts or continues a thread to the id
 * of the post that starts it. Self-replies whose start isn't in the timeline
 * are left out.
 */
function threadRoots(posts: XPostDetail[], owner: string): Map<string, string> {
  const byId = new Map(posts.map((post) => [post.id, post]));
  const isSelfReply = (post: XPostDetail) =>
    post.kind === 'reply' && post.replyToUsername === owner;
  const roots = new Map<string, string>();
  for (const post of posts) {
    if (post.authorUsername !== owner || post.kind === 'repost') continue;
    let root: XPostDetail | undefined = post;
    const visited = new Set<string>();
    while (root && isSelfReply(root) && root.replyToPostId && !visited.has(root.id)) {
      visited.add(root.id);
      root = byId.get(root.replyToPostId);
    }
    if (root && !isSelfReply(root) && root.kind !== 'reply') roots.set(post.id, root.id);
  }
  return roots;
}

export interface ConversationSignals {
  /** The author's own replies directly under the post (a thread's next part). */
  authorDirectReplies: number;
  /** Replier handle → when the author first replied back to them. */
  authorReplies: Record<string, Date>;
}

/**
 * The author's side of each post's conversation, keyed by the id of the post
 * that starts it: how many replies X counts on the post are the author's own,
 * and whom the author replied back to. A reply-back is the author answering a
 * post that was itself a reply to one of the author's posts (or thread parts).
 * The post it lands on may be older than this timeline, so keys aren't
 * guaranteed to be in it.
 */
export function conversationSignals(
  posts: XPostDetail[],
  username: string,
): Map<string, ConversationSignals> {
  const owner = username.toLowerCase();
  const rootOf = threadRoots(posts, owner);
  const signals = new Map<string, ConversationSignals>();
  const entry = (rootId: string) => {
    const existing = signals.get(rootId);
    if (existing) return existing;
    const created: ConversationSignals = { authorDirectReplies: 0, authorReplies: {} };
    signals.set(rootId, created);
    return created;
  };

  for (const post of posts) {
    if (post.kind !== 'reply' || post.authorUsername !== owner || !post.replyToPostId) continue;
    if (post.replyToUsername === owner) {
      if (rootOf.get(post.replyToPostId) === post.replyToPostId) {
        entry(post.replyToPostId).authorDirectReplies += 1;
      }
      continue;
    }
    const answered = post.parentReplyTo;
    if (!post.replyToUsername || answered?.username !== owner || !answered.postId) continue;
    const rootId = rootOf.get(answered.postId) ?? answered.postId;
    const replies = entry(rootId).authorReplies;
    const previous = replies[post.replyToUsername];
    if (!previous || post.createdAt < previous) replies[post.replyToUsername] = post.createdAt;
  }
  return signals;
}

/** Changes whenever anything the scorer sees changes, e.g. a thread grows. */
function contentHash(post: Omit<ScoreablePost, 'contentHash'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        post.text,
        post.threadTexts,
        post.quotedText,
        post.mediaType,
        post.linkLocation,
        post.hashtagCount,
      ]),
    )
    .digest('hex')
    .slice(0, 32);
}

function stripLeadingMentions(text: string): string {
  return text.replace(/^(?:@\w+\s+)+/, '');
}

/** A short topic label for niche-consistency context: the post's first line. */
export function topicLabel(text: string): string {
  const firstLine =
    text
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? '';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export interface ScoringContext {
  recentPostTopics: string[];
  accountNiche?: string;
  timezone?: string;
  highActivityWindows?: string[];
}

/** The user message for the scoring call, in the input shape the system prompt documents. */
export function buildScoringInput(
  post: Pick<
    ScoreablePost,
    | 'text'
    | 'threadTexts'
    | 'quotedUsername'
    | 'quotedText'
    | 'mediaType'
    | 'isThread'
    | 'threadLength'
    | 'hasExternalLink'
    | 'linkLocation'
    | 'hashtagCount'
    | 'postedAt'
  >,
  context: ScoringContext,
) {
  const zone =
    context.timezone && IANAZone.isValidZone(context.timezone) ? context.timezone : 'UTC';
  const postText = post.isThread
    ? [post.text, ...post.threadTexts]
        .map((text, index) => `[${index + 1}/${post.threadLength}]\n${text}`)
        .join('\n\n')
    : post.text;
  // A quote post is judged alongside what it quotes; the quoted text isn't the author's.
  const quoted = post.quotedText
    ? `\n\n[Quoting @${post.quotedUsername ?? 'unknown'}: ${post.quotedText}]`
    : '';
  return {
    post_text: postText + quoted,
    media_type: post.mediaType,
    is_thread: post.isThread,
    ...(post.isThread ? { thread_length: post.threadLength } : {}),
    has_external_link: post.hasExternalLink,
    link_location: post.linkLocation,
    hashtag_count: post.hashtagCount,
    posted_at: DateTime.fromJSDate(post.postedAt).setZone(zone).toISO(),
    recent_post_topics: context.recentPostTopics,
    ...(context.accountNiche ? { account_niche: context.accountNiche } : {}),
    ...(context.highActivityWindows?.length
      ? { account_high_activity_windows: context.highActivityWindows }
      : {}),
  };
}

export interface EngagementSample {
  postedAt: Date;
  engagement: XPostEngagement;
}

/**
 * The account's best local posting hours, learned from its own history: posts
 * are bucketed into 2-hour windows and ranked by engagement per view. Returns
 * nothing until there is enough history to be more useful than a guess.
 */
export function highActivityWindows(
  samples: EngagementSample[],
  timezone = 'UTC',
  minimumSamples = 10,
): string[] {
  const usable = samples.filter((sample) => (sample.engagement.views ?? 0) > 0);
  if (usable.length < minimumSamples) return [];
  const zone = IANAZone.isValidZone(timezone) ? timezone : 'UTC';

  const buckets = new Map<number, number[]>();
  for (const { postedAt, engagement } of usable) {
    const bucket = Math.floor(DateTime.fromJSDate(postedAt).setZone(zone).hour / 2) * 2;
    const interactions =
      engagement.likes + engagement.reposts * 2 + engagement.replies * 3 + engagement.bookmarks;
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), interactions / (engagement.views ?? 1)]);
  }

  const pad = (hour: number) => `${String(hour % 24).padStart(2, '0')}:00`;
  return [...buckets.entries()]
    .filter(([, rates]) => rates.length >= 2)
    .map(([bucket, rates]) => ({ bucket, rate: rates.reduce((a, b) => a + b, 0) / rates.length }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map(({ bucket }) => `${pad(bucket)}-${pad(bucket + 2)} ${zone}`);
}

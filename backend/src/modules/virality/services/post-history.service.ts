import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { AnyBulkWriteOperation, Model } from 'mongoose';

import { ApiException } from '../../../common/errors/api.exception';
import {
  X_POST_PROVIDER,
  type XPostDetail,
  type XPostProvider,
} from '../../posting-consistency/domain/x-post-provider.interface';
import { buildInsights, type InsightsResult } from '../domain/insights';
import {
  buildScoreablePosts,
  buildScoringInput,
  conversationSignals,
  highActivityWindows,
  topicLabel,
  type ConversationSignals,
  type ScoreablePost,
} from '../domain/post-features';
import { SCORING_PROMPT_VERSION } from '../domain/prompts';
import type { ViralityScore } from '../domain/virality-score';
import {
  ScoredPost,
  type EngagementReading,
  type ScoredPostDocument,
} from '../schemas/scored-post.schema';
import { XComment } from '../schemas/x-comment.schema';
import { ViralityScorerService } from './virality-scorer.service';
import { XpService } from './xp.service';

export interface ScoringOptions {
  niche?: string;
  timezone?: string;
}

export interface IngestOptions {
  /** Timeline pages to pull; more reaches further back. */
  pages?: number;
}

const HOUR = 3_600_000;
/** Age windows in which the first engagement reading counts as that milestone. */
const MILESTONES = [
  { key: 'h1', from: HOUR, to: 4 * HOUR },
  { key: 'h24', from: 24 * HOUR, to: 48 * HOUR },
  { key: 'd7', from: 7 * 24 * HOUR, to: 10 * 24 * HOUR },
] as const;
const MAX_SCORE_ATTEMPTS = 3;
const SCORING_CONCURRENCY = 3;
const HISTORY_LIMIT = 50;

@Injectable()
export class PostHistoryService {
  private readonly logger = new Logger(PostHistoryService.name);
  private readonly scoringRuns = new Map<string, Promise<void>>();
  private readonly maxScoresPerSync: number;

  constructor(
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    @InjectModel(XComment.name) private readonly comments: Model<XComment>,
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly scorer: ViralityScorerService,
    private readonly xp: XpService,
    config: ConfigService,
  ) {
    this.maxScoresPerSync = config.get<number>('virality.maxScoresPerSync', 10);
  }

  /** Pulls fresh posts for the history tab and scores new ones in the background. */
  async syncUser(username: string, options: ScoringOptions) {
    await this.ingest(username);
    this.scoreInBackground(username, options);
    return this.getHistory(username);
  }

  /** Pulls and scores to completion — for scheduled leaderboard refreshes. */
  async syncAndScore(
    username: string,
    options: ScoringOptions,
    ingestOptions: IngestOptions = {},
  ): Promise<void> {
    await this.ingest(username, ingestOptions);
    await this.runScoring(username, options);
  }

  async getHistory(username: string) {
    const xpConfig = await this.xp.config();
    const [posts, scored, xp] = await Promise.all([
      this.posts.find({ username }).sort({ postedAt: -1 }).limit(HISTORY_LIMIT).lean(),
      this.posts.find({ username, scoreStatus: 'scored' }).sort({ postedAt: -1 }).limit(100).lean(),
      this.xp.forAccount(username, xpConfig),
    ]);
    const insights: InsightsResult = buildInsights(
      scored.map((post) => ({ ...post, score: post.score as ViralityScore })),
    );
    return {
      username,
      scoringAvailable: this.scorer.isAvailable,
      isScoring:
        this.scorer.isAvailable &&
        (this.scoringRuns.has(username) || posts.some((post) => this.needsScore(post))),
      posts: posts.map((post) => ({
        postId: post.postId,
        url: post.url,
        kind: post.kind,
        text: post.text,
        threadTexts: post.threadTexts,
        quotedUsername: post.quotedUsername,
        quotedText: post.quotedText,
        postedAt: post.postedAt,
        mediaType: post.mediaType,
        isThread: post.isThread,
        threadLength: post.threadLength,
        linkLocation: post.linkLocation,
        hashtagCount: post.hashtagCount,
        engagement: post.engagement,
        scoreStatus: post.scoreStatus,
        score: post.score,
        scoredAt: post.scoredAt,
        xp: xp.posts.get(post.postId) ?? null,
      })),
      insights,
      xp: xp.account,
      xpRules: this.xp.rules(xpConfig),
    };
  }

  async rewrite(username: string, postId: string): Promise<{ variants: string[] }> {
    const post = await this.posts.findOne({ postId, username });
    if (!post) throw ApiException.notFound('Post', { postId });
    if (post.scoreStatus !== 'scored' || !post.score) {
      throw ApiException.unprocessable('VALIDATION_FAILED', 'This post has not been scored yet.');
    }
    if (post.rewriteVariants.length > 0 && post.rewriteContentHash === post.contentHash) {
      return { variants: post.rewriteVariants };
    }
    const fullText = [post.text, ...post.threadTexts].join('\n\n');
    const variants = await this.scorer.rewrite(fullText, post.score);
    await this.posts.updateOne(
      { _id: post._id },
      { $set: { rewriteVariants: variants, rewriteContentHash: post.contentHash } },
    );
    return { variants };
  }

  /**
   * Upserts the account's recent posts and refreshes their public metrics, and
   * records the replies it left on other people's posts (its comments).
   */
  async ingest(username: string, options: IngestOptions = {}): Promise<ScoreablePost[]> {
    const timeline = await this.provider.listRecentPosts(username, { pages: options.pages });
    await this.recordComments(username, timeline);
    const scoreable = buildScoreablePosts(timeline, username);
    const conversations = conversationSignals(timeline, username);
    const inTimeline = new Set(scoreable.map((post) => post.postId));
    await this.recordConversations(
      username,
      new Map([...conversations].filter(([postId]) => !inTimeline.has(postId))),
    );
    if (scoreable.length === 0) return scoreable;

    const existing = new Map(
      (
        await this.posts
          .find({ postId: { $in: scoreable.map((post) => post.postId) } })
          .select('postId engagementSnapshots')
          .lean()
      ).map((post) => [post.postId, post]),
    );
    const now = new Date();
    const operations: AnyBulkWriteOperation<ScoredPost>[] = scoreable.map((post) => {
      const reading: EngagementReading = { ...post.engagement, capturedAt: now };
      const snapshots = existing.get(post.postId)?.engagementSnapshots ?? {};
      const age = now.getTime() - post.postedAt.getTime();
      const milestone = MILESTONES.find(
        ({ key, from, to }) => age >= from && age < to && !snapshots[key],
      );
      return {
        updateOne: {
          filter: { postId: post.postId },
          update: {
            $set: {
              username: post.username,
              url: post.url,
              kind: post.kind,
              text: post.text,
              threadTexts: post.threadTexts,
              quotedUsername: post.quotedUsername ?? null,
              quotedText: post.quotedText ?? null,
              postedAt: post.postedAt,
              mediaType: post.mediaType,
              isThread: post.isThread,
              threadLength: post.threadLength,
              hasExternalLink: post.hasExternalLink,
              linkLocation: post.linkLocation,
              hashtagCount: post.hashtagCount,
              contentHash: post.contentHash,
              engagement: reading,
              ...(milestone ? { [`engagementSnapshots.${milestone.key}`]: reading } : {}),
            },
            ...this.conversationUpdate(conversations.get(post.postId)),
            $setOnInsert: { scoreStatus: 'pending', scoreAttempts: 0, score: null },
          },
          upsert: true,
        },
      };
    });
    await this.posts.bulkWrite(operations, { ordered: false });
    return scoreable;
  }

  /**
   * Conversation evidence only accumulates: a reply-back stays counted after
   * it scrolls off the timeline pages a sync reads.
   */
  private conversationUpdate(signals: ConversationSignals | undefined) {
    if (!signals) return {};
    const answered = Object.entries(signals.authorReplies).map(([replier, at]) => [
      `authorReplies.${replier}`,
      at,
    ]);
    return {
      $max: { authorDirectReplies: signals.authorDirectReplies },
      ...(answered.length > 0 ? { $min: Object.fromEntries(answered) } : {}),
    };
  }

  /** Reply-backs landing on posts that are stored but no longer in the timeline. */
  private async recordConversations(
    username: string,
    conversations: Map<string, ConversationSignals>,
  ): Promise<void> {
    if (conversations.size === 0) return;
    await this.posts.bulkWrite(
      [...conversations].map(([postId, signals]) => ({
        updateOne: {
          filter: { postId, username: username.toLowerCase() },
          update: this.conversationUpdate(signals),
        },
      })),
      { ordered: false },
    );
  }

  /** Replies to other accounts only — replies to itself are thread continuations. */
  private async recordComments(username: string, timeline: XPostDetail[]): Promise<void> {
    const owner = username.toLowerCase();
    const comments = timeline.filter(
      (post) =>
        post.kind === 'reply' && post.authorUsername === owner && post.replyToUsername !== owner,
    );
    if (comments.length === 0) return;
    await this.comments.bulkWrite(
      comments.map((comment) => ({
        updateOne: {
          filter: { postId: comment.id },
          update: { $set: { username: owner, postedAt: comment.createdAt } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  private scoreInBackground(username: string, options: ScoringOptions): void {
    if (!this.scorer.isAvailable || this.scoringRuns.has(username)) return;
    const run = this.runScoring(username, options)
      .catch((error: unknown) =>
        this.logger.error(`Background scoring for @${username} failed: ${String(error)}`),
      )
      .finally(() => this.scoringRuns.delete(username));
    this.scoringRuns.set(username, run);
  }

  /** A post needs (re-)scoring when it's new, edited, or scored under an older prompt. */
  private needsScore(
    post: Pick<
      ScoredPost,
      'scoreStatus' | 'scoreAttempts' | 'contentHash' | 'scoredContentHash' | 'scoringPromptVersion'
    >,
  ): boolean {
    if (post.scoreStatus === 'failed') return post.scoreAttempts < MAX_SCORE_ATTEMPTS;
    return (
      post.scoreStatus === 'pending' ||
      post.scoredContentHash !== post.contentHash ||
      post.scoringPromptVersion !== SCORING_PROMPT_VERSION
    );
  }

  private async runScoring(username: string, options: ScoringOptions): Promise<void> {
    if (!this.scorer.isAvailable) return;
    const recent = await this.posts.find({ username }).sort({ postedAt: -1 }).limit(60);
    const queue = recent.filter((post) => this.needsScore(post)).slice(0, this.maxScoresPerSync);
    if (queue.length === 0) return;

    const windows = highActivityWindows(recent, options.timezone);
    for (let index = 0; index < queue.length; index += SCORING_CONCURRENCY) {
      await Promise.all(
        queue
          .slice(index, index + SCORING_CONCURRENCY)
          .map((post) => this.scoreOne(post, recent, { ...options, windows })),
      );
    }
  }

  private async scoreOne(
    post: ScoredPostDocument,
    recent: ScoredPostDocument[],
    options: ScoringOptions & { windows: string[] },
  ): Promise<void> {
    // Niche context: the posts just before this one, falling back to newer ones.
    const others = recent.filter((other) => other.postId !== post.postId);
    const earlier = others.filter((other) => other.postedAt <= post.postedAt);
    const recentPostTopics = [
      ...earlier,
      ...others.filter((other) => other.postedAt > post.postedAt),
    ]
      .slice(0, 8)
      .map((other) => topicLabel(other.text))
      .filter(Boolean);

    const input = buildScoringInput(
      {
        ...post.toObject(),
        quotedUsername: post.quotedUsername ?? undefined,
        quotedText: post.quotedText ?? undefined,
      },
      {
        recentPostTopics,
        accountNiche: options.niche,
        timezone: options.timezone,
        highActivityWindows: options.windows,
      },
    );
    // Only settle the score if the content is still what was scored.
    const filter = { _id: post._id, contentHash: post.contentHash };
    try {
      const score = await this.scorer.score(input);
      await this.posts.updateOne(filter, {
        $set: {
          score,
          scoreStatus: 'scored',
          scoredContentHash: post.contentHash,
          scoringPromptVersion: SCORING_PROMPT_VERSION,
          scoringModel: this.scorer.modelLabel,
          scoredAt: new Date(),
          scoreAttempts: 0,
        },
      });
    } catch (error) {
      this.logger.warn(`Scoring post ${post.postId} failed: ${String(error)}`);
      await this.posts.updateOne(filter, {
        $set: { scoreStatus: 'failed' },
        $inc: { scoreAttempts: 1 },
      });
    }
  }
}

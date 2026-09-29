import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { AnyBulkWriteOperation, Model } from 'mongoose';

import { ApiException } from '../../../common/errors/api.exception';
import {
  X_POST_PROVIDER,
  type XPostProvider,
} from '../../posting-consistency/domain/x-post-provider.interface';
import { buildInsights, type InsightsResult } from '../domain/insights';
import {
  buildScoreablePosts,
  buildScoringInput,
  highActivityWindows,
  topicLabel,
  type ScoreablePost,
} from '../domain/post-features';
import { SCORING_PROMPT_VERSION } from '../domain/prompts';
import type { ViralityScore } from '../domain/virality-score';
import {
  ScoredPost,
  type EngagementReading,
  type ScoredPostDocument,
} from '../schemas/scored-post.schema';
import { ViralityScorerService } from './virality-scorer.service';

export interface ScoringOptions {
  niche?: string;
  timezone?: string;
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
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly scorer: ViralityScorerService,
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
  async syncAndScore(username: string, options: ScoringOptions): Promise<void> {
    await this.ingest(username);
    await this.runScoring(username, options);
  }

  async getHistory(username: string) {
    const [posts, scored] = await Promise.all([
      this.posts.find({ username }).sort({ postedAt: -1 }).limit(HISTORY_LIMIT).lean(),
      this.posts.find({ username, scoreStatus: 'scored' }).sort({ postedAt: -1 }).limit(100).lean(),
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
      })),
      insights,
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

  /** Upserts the account's recent posts and refreshes their public metrics. */
  async ingest(username: string): Promise<ScoreablePost[]> {
    const scoreable = buildScoreablePosts(await this.provider.listRecentPosts(username), username);
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
            $setOnInsert: { scoreStatus: 'pending', scoreAttempts: 0, score: null },
          },
          upsert: true,
        },
      };
    });
    await this.posts.bulkWrite(operations, { ordered: false });
    return scoreable;
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

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TikTokAdapter } from '../../platforms/adapters/tiktok.adapter';
import type { TikTokPublishStatus } from '../../platforms/adapters/tiktok/tiktok-posting.client';
import { PlatformRegistry } from '../../platforms/platform-registry.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { Post, PostDocument } from './schemas/post.schema';

const POLL_INTERVAL_MS = 30 * 1000;
const BATCH_SIZE = 50;
/** TikTok normally finishes in minutes; past this the post is reported as failed. */
const GIVE_UP_AFTER_MS = 2 * 60 * 60 * 1000;

/** Maps a TikTok publish status onto the Post fields it changes. */
export function tiktokPostUpdate(
  status: TikTokPublishStatus,
  checkedAt: Date,
  submittedAt: Date | null,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    providerStatus: status.status,
    lastProviderStatusCheckedAt: checkedAt,
  };
  if (status.status === 'PUBLISH_COMPLETE') {
    update.status = 'published';
    update.publishedAt = checkedAt;
    update.failureReason = null;
    // Only set for public posts; private (e.g. unaudited sandbox) posts keep the publish_id.
    if (status.postIds[0]) update.platformPostId = status.postIds[0];
  } else if (status.status === 'FAILED') {
    update.status = 'failed';
    update.failureReason = `TikTok could not publish the post${status.failReason ? ` (${status.failReason})` : ''}`;
  } else if (status.status === 'SEND_TO_USER_INBOX') {
    update.status = 'pending_review';
    update.failureReason = null;
  } else if (submittedAt && checkedAt.getTime() - submittedAt.getTime() > GIVE_UP_AFTER_MS) {
    update.status = 'failed';
    update.failureReason = 'TikTok did not finish processing the post. Try publishing again.';
  }
  return update;
}

/**
 * Polls TikTok's publish/status/fetch for directly published posts, the way
 * PublishingProviderReconciliationService does for Buffer and Postiz.
 */
@Injectable()
export class TikTokPublishStatusService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TikTokPublishStatusService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectModel(Post.name) private readonly posts: Model<PostDocument>,
    private readonly registry: PlatformRegistry,
    private readonly socialAccounts: SocialAccountsService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.run(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcile(): Promise<void> {
    const checkedAt = new Date();
    const staleBefore = new Date(checkedAt.getTime() - POLL_INTERVAL_MS + 1000);
    const pending = await this.posts
      .find({
        platform: 'tiktok',
        publishingProvider: 'direct',
        status: 'processing',
        externalProviderPostId: { $ne: null },
        $or: [
          { lastProviderStatusCheckedAt: null },
          { lastProviderStatusCheckedAt: { $lte: staleBefore } },
        ],
      })
      .limit(BATCH_SIZE)
      .exec();
    for (const post of pending) await this.reconcilePost(post, checkedAt);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error(
        `TikTok publish status poll failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async reconcilePost(post: PostDocument, checkedAt: Date): Promise<void> {
    try {
      const adapter = this.registry.get('tiktok');
      if (!(adapter instanceof TikTokAdapter)) return;
      const token = await this.socialAccounts.getUsableAccessToken(
        post.workspaceId.toString(),
        post.socialAccountId.toString(),
      );
      const status = await adapter.fetchPublishStatus(token, post.externalProviderPostId as string);
      await this.posts
        .updateOne(
          { _id: post._id, status: 'processing' },
          { $set: tiktokPostUpdate(status, checkedAt, post.submittedAt) },
        )
        .exec();
    } catch (error) {
      await this.posts
        .updateOne({ _id: post._id }, { $set: { lastProviderStatusCheckedAt: checkedAt } })
        .exec();
      this.logger.warn(
        `Could not check TikTok publish ${post.externalProviderPostId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}

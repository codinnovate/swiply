import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { GatewayPostStatus } from './publishing-provider.gateway';
import { PublishingProvidersService } from './publishing-providers.service';
import type { PublishingProvider } from './schemas/publishing-provider-connection.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';

const STATUS_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DELIVERY_LOOK_AHEAD_MS = 15 * 60 * 1000;
const RECONCILIATION_BATCH_SIZE = 100;
const RECONCILIATION_CONCURRENCY = 5;
const CHANNEL_HEALTH_INTERVAL_MS = 60 * 60 * 1000;

export function remotePostUpdate(status: GatewayPostStatus, checkedAt: Date) {
  const normalized = status.status.toLowerCase();
  const update: Record<string, unknown> = {
    providerStatus: status.status,
    lastProviderStatusCheckedAt: checkedAt,
  };
  if (['sent', 'published', 'success', 'completed'].includes(normalized)) {
    update.status = 'published';
    update.publishedAt = status.publishedAt || checkedAt;
    update.failureReason = null;
  } else if (['error', 'failed', 'failure'].includes(normalized)) {
    update.status = 'failed';
    update.failureReason = status.failureReason || 'Publishing provider could not deliver the post';
  } else if (['sending', 'processing', 'publishing', 'in_progress'].includes(normalized)) {
    update.status = 'processing';
  } else if (['draft', 'needs_approval'].includes(normalized)) {
    update.status = 'pending_review';
  } else if (['queue', 'queued', 'scheduled'].includes(normalized)) {
    update.status = 'queued';
  }
  if (status.url) update.platformPostUrl = status.url;
  if (status.platformPostId) update.platformPostId = status.platformPostId;
  return update;
}

@Injectable()
export class PublishingProviderReconciliationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PublishingProviderReconciliationService.name);
  private postStatusTimer: NodeJS.Timeout | null = null;
  private channelHealthTimer: NodeJS.Timeout | null = null;
  private postStatusRunActive = false;
  private channelHealthRunActive = false;

  constructor(
    @InjectModel(Post.name) private readonly posts: Model<PostDocument>,
    private readonly providers: PublishingProvidersService,
  ) {}

  onApplicationBootstrap(): void {
    this.postStatusTimer = setInterval(() => {
      void this.runPostStatusReconciliation();
    }, STATUS_POLL_INTERVAL_MS);
    this.channelHealthTimer = setInterval(() => {
      void this.runChannelHealthReconciliation();
    }, CHANNEL_HEALTH_INTERVAL_MS);
    this.postStatusTimer.unref();
    this.channelHealthTimer.unref();
  }

  onApplicationShutdown(): void {
    if (this.postStatusTimer) clearInterval(this.postStatusTimer);
    if (this.channelHealthTimer) clearInterval(this.channelHealthTimer);
  }

  async reconcilePostDeliveryStatuses(): Promise<void> {
    const checkedAt = new Date();
    const staleBefore = new Date(checkedAt.getTime() - STATUS_POLL_INTERVAL_MS);
    const deliveryWindowEnd = new Date(checkedAt.getTime() + DELIVERY_LOOK_AHEAD_MS);
    const posts = await this.posts
      .find({
        publishingProvider: { $in: ['buffer', 'postiz'] },
        externalProviderPostId: { $ne: null },
        $and: [
          {
            $or: [
              { status: 'processing' },
              {
                status: { $in: ['queued', 'pending_review'] },
                scheduledFor: { $lte: deliveryWindowEnd },
              },
            ],
          },
          {
            $or: [
              { lastProviderStatusCheckedAt: null },
              { lastProviderStatusCheckedAt: { $lte: staleBefore } },
            ],
          },
        ],
      })
      .sort({ scheduledFor: 1 })
      .limit(RECONCILIATION_BATCH_SIZE)
      .exec();

    for (let index = 0; index < posts.length; index += RECONCILIATION_CONCURRENCY) {
      await Promise.all(
        posts
          .slice(index, index + RECONCILIATION_CONCURRENCY)
          .map((post) => this.reconcilePost(post, checkedAt)),
      );
    }
  }

  async reconcileChannelHealth(): Promise<void> {
    const result = await this.providers.syncAllConnections();
    if (result.failed)
      this.logger.warn(
        `Could not refresh ${result.failed} of ${result.checked} publishing provider connections`,
      );
  }

  private async runPostStatusReconciliation(): Promise<void> {
    if (this.postStatusRunActive) return;
    this.postStatusRunActive = true;
    try {
      await this.reconcilePostDeliveryStatuses();
    } catch (error) {
      this.logger.error(
        `Publishing provider post reconciliation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.postStatusRunActive = false;
    }
  }

  private async runChannelHealthReconciliation(): Promise<void> {
    if (this.channelHealthRunActive) return;
    this.channelHealthRunActive = true;
    try {
      await this.reconcileChannelHealth();
    } catch (error) {
      this.logger.error(
        `Publishing provider channel reconciliation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.channelHealthRunActive = false;
    }
  }

  private async reconcilePost(post: PostDocument, checkedAt: Date): Promise<void> {
    try {
      const status = await this.providers.getPostStatus(
        post.workspaceId.toString(),
        post.publishingProvider as PublishingProvider,
        post.externalProviderPostId as string,
        post.scheduledFor,
      );
      const update = status
        ? remotePostUpdate(status, checkedAt)
        : { lastProviderStatusCheckedAt: checkedAt };
      await this.posts
        .updateOne(
          {
            _id: post._id,
            status: { $in: ['queued', 'pending_review', 'processing'] },
          },
          { $set: update },
        )
        .exec();
    } catch (error) {
      await this.posts
        .updateOne({ _id: post._id }, { $set: { lastProviderStatusCheckedAt: checkedAt } })
        .exec();
      this.logger.warn(
        `Could not reconcile ${post.publishingProvider} post ${post.externalProviderPostId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}

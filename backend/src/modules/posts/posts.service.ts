import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { PlatformRegistry } from '../../platforms/platform-registry.service';
import {
  SocialAccount,
  SocialAccountDocument,
} from '../social-accounts/schemas/social-account.schema';
import { Content, ContentDocument } from '../content/schemas/content.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { Post, PostDocument } from './schemas/post.schema';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { slideFrameFor } from '../media/slide-render';
import { SlideRenderService } from '../media/slide-render.service';
import { SlideshowVideoService } from '../media/slideshow-video.service';
import { TikTokMediaFitService } from '../media/tiktok-media-fit.service';
import { PublishingProvidersService } from '../publishing-providers/publishing-providers.service';
import type { PublishingProvider } from '../publishing-providers/schemas/publishing-provider-connection.schema';
import { assertSettingsShape } from '../../platforms/adapters/tiktok/tiktok-post-settings';
import type { TikTokPostSettingsDto } from './dto/tiktok-post-settings.dto';
import type { TikTokSettings } from './schemas/post.schema';

/** The creator's consent is stamped server-side, at the moment they submit. */
export function toTikTokSettings(dto: TikTokPostSettingsDto): TikTokSettings {
  const settings: TikTokSettings = {
    title: dto.title?.trim() || null,
    privacyLevel: dto.privacyLevel,
    allowComment: dto.allowComment,
    allowDuet: dto.allowDuet,
    allowStitch: dto.allowStitch,
    brandOrganic: dto.brandOrganic,
    brandContent: dto.brandContent,
    autoAddMusic: dto.autoAddMusic,
    isAigc: dto.isAigc,
    consentedAt: new Date(),
  };
  assertSettingsShape(settings);
  return settings;
}

const isDirectTikTok = (account: Pick<SocialAccountDocument, 'platform' | 'connectionProvider'>) =>
  account.platform === 'tiktok' && (account.connectionProvider ?? 'direct') === 'direct';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Content.name) private readonly contentModel: Model<ContentDocument>,
    @InjectModel(SocialAccount.name) private readonly accountModel: Model<SocialAccountDocument>,
    private readonly registry: PlatformRegistry,
    private readonly socialAccounts: SocialAccountsService,
    private readonly publishingProviders: PublishingProvidersService,
    private readonly tiktokMediaFit: TikTokMediaFitService,
    private readonly slideshowVideo: SlideshowVideoService,
    private readonly slideRender: SlideRenderService,
  ) {}

  async create(workspaceId: string, dto: CreatePostDto) {
    const scheduledFor = new Date(dto.scheduledFor);
    if (scheduledFor.getTime() <= Date.now()) {
      throw ApiException.unprocessable(
        'SCHEDULE_CONFIGURATION_INVALID',
        'Choose a publishing time in the future',
      );
    }
    const [content, account] = await Promise.all([
      this.contentModel
        .findOne({
          _id: new Types.ObjectId(dto.contentId),
          workspaceId: new Types.ObjectId(workspaceId),
        })
        .exec(),
      this.accountModel
        .findOne({
          _id: new Types.ObjectId(dto.socialAccountId),
          workspaceId: new Types.ObjectId(workspaceId),
          status: 'active',
        })
        .exec(),
    ]);
    if (!content) throw ApiException.notFound('Content');
    if (!account) throw ApiException.notFound('Social account');
    const imageCount =
      content.type === 'slideshow'
        ? (content.slideshow?.slides.length ?? 0)
        : (content.post?.imageUrls.length ?? 0);
    if ((account.connectionProvider ?? 'direct') === 'direct') {
      const validation = this.registry.get(account.platform).validateContent({
        type: content.type,
        imageCount,
        text: content.postCaption || content.post?.text,
      });
      if (!validation.valid)
        throw ApiException.unprocessable(
          'CONTENT_INVALID_FOR_PLATFORM',
          validation.errors.join('; '),
          { errors: validation.errors },
        );
    }
    const tiktokSettings = isDirectTikTok(account) && dto.tiktok ? toTikTokSettings(dto.tiktok) : null;
    // TikTok requires the creator to choose these per post, so a direct TikTok
    // post without them (e.g. from autopilot) waits for review instead of publishing.
    const awaitsTikTokSettings = isDirectTikTok(account) && !tiktokSettings;
    const post = await this.postModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      contentId: content._id,
      socialAccountId: account._id,
      platform: account.platform,
      scheduledFor,
      status: awaitsTikTokSettings ? 'pending_review' : 'queued',
      attempts: 0,
      lastAttemptAt: null,
      publishedAt: null,
      platformPostId: null,
      platformPostUrl: null,
      failureReason: null,
      publishingProvider: account.connectionProvider ?? 'direct',
      externalProviderPostId: null,
      providerStatus: null,
      submittedAt: null,
      lastProviderStatusCheckedAt: null,
      tiktokSettings,
    });
    if ((account.connectionProvider ?? 'direct') !== 'direct') {
      try {
        const result = await this.submitToProvider(
          workspaceId,
          account,
          content,
          post.scheduledFor,
          Boolean(dto.publishNow),
        );
        post.externalProviderPostId = result.id;
        post.platformPostId = result.id;
        post.platformPostUrl = result.url;
        post.providerStatus = result.status;
        post.submittedAt = new Date();
        post.lastProviderStatusCheckedAt = null;
        await post.save();
      } catch (error) {
        post.status = 'failed';
        post.failureReason =
          error instanceof ApiException ? error.message : 'Provider scheduling failed';
        await post.save();
        throw error;
      }
    } else if (dto.publishNow && !awaitsTikTokSettings) {
      return this.publishNow(workspaceId, String(post.id || post._id));
    }
    return post;
  }

  list(workspaceId: string, status?: string, socialAccountId?: string) {
    const filter: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (status) filter.status = status;
    if (socialAccountId) filter.socialAccountId = new Types.ObjectId(socialAccountId);
    return this.postModel.find(filter).sort({ scheduledFor: 1 }).limit(100).exec();
  }

  async get(workspaceId: string, id: string) {
    const post = await this.postModel
      .findOne({ _id: new Types.ObjectId(id), workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!post) throw ApiException.notFound('Post');
    return post;
  }

  async cancel(workspaceId: string, id: string) {
    const post = await this.get(workspaceId, id);
    if (!['queued', 'pending_review'].includes(post.status))
      throw ApiException.unprocessable('POST_NOT_CANCELABLE', 'Only queued posts can be canceled');
    if (post.publishingProvider !== 'direct' && post.externalProviderPostId) {
      await this.publishingProviders.deletePost(
        workspaceId,
        post.publishingProvider as PublishingProvider,
        post.externalProviderPostId,
      );
    }
    post.status = 'canceled';
    post.providerStatus = 'canceled';
    await post.save();
  }

  async publishNow(workspaceId: string, id: string, tiktok?: TikTokPostSettingsDto) {
    if (tiktok) {
      // Attaching the creator's choices is what releases a TikTok post from review.
      const updated = await this.postModel
        .updateOne(
          {
            _id: new Types.ObjectId(id),
            workspaceId: new Types.ObjectId(workspaceId),
            platform: 'tiktok',
            publishingProvider: 'direct',
            status: { $in: ['queued', 'failed', 'pending_review'] },
          },
          { $set: { tiktokSettings: toTikTokSettings(tiktok), status: 'queued' } },
        )
        .exec();
      if (!updated.matchedCount)
        throw ApiException.unprocessable(
          'POST_NOT_PUBLISHABLE',
          'TikTok settings only apply to a direct TikTok post that has not been published',
        );
    }
    const post = await this.postModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          workspaceId: new Types.ObjectId(workspaceId),
          status: { $in: ['queued', 'failed'] },
        },
        {
          $set: { status: 'processing', lastAttemptAt: new Date(), failureReason: null },
          $inc: { attempts: 1 },
        },
        { new: true },
      )
      .exec();
    if (!post)
      throw ApiException.unprocessable(
        'POST_NOT_PUBLISHABLE',
        'Post is already processing, published, or canceled',
      );
    try {
      const account = await this.accountModel
        .findOne({ _id: post.socialAccountId, workspaceId: post.workspaceId, status: 'active' })
        .exec();
      const content = await this.contentModel
        .findOne({ _id: post.contentId, workspaceId: post.workspaceId })
        .exec();
      if (!account || !content)
        throw ApiException.notFound(!account ? 'Social account' : 'Content');
      if ((account.connectionProvider ?? 'direct') !== 'direct') {
        if (post.externalProviderPostId)
          await this.publishingProviders.deletePost(
            workspaceId,
            account.connectionProvider as PublishingProvider,
            post.externalProviderPostId,
          );
        const result = await this.submitToProvider(workspaceId, account, content, new Date(), true);
        post.status = 'queued';
        post.externalProviderPostId = result.id;
        post.platformPostId = result.id;
        post.platformPostUrl = result.url;
        post.providerStatus = result.status;
        post.submittedAt = new Date();
        post.lastProviderStatusCheckedAt = null;
        await post.save();
        return post;
      }
      const imageUrls = await this.imagesForPlatform(workspaceId, account.platform, content);
      const result = await this.registry
        .get(account.platform)
        .publishContent(
          await this.socialAccounts.getUsableAccessToken(workspaceId, account._id.toString()),
          {
            type: content.type,
            platformAccountId: account.platformAccountId,
            imageCount: imageUrls.length,
            text: content.postCaption || content.post?.text,
            postCaption: content.postCaption,
            hashtags: content.hashtags,
            imageUrls,
            videoUrl: content.video?.videoUrl,
            videoDurationSeconds: content.video?.durationSeconds,
            tiktok: post.tiktokSettings,
          },
        );
      post.platformPostId = result.platformPostId;
      post.platformPostUrl = result.platformPostUrl;
      if (result.status === 'processing') {
        // TikTok finishes asynchronously; TikTokPublishStatusService polls the publish_id.
        post.status = 'processing';
        post.externalProviderPostId = result.platformPostId;
        post.providerStatus = 'PROCESSING_UPLOAD';
        post.submittedAt = new Date();
        post.lastProviderStatusCheckedAt = null;
      } else {
        post.status = 'published';
        post.publishedAt = new Date();
      }
      await post.save();
      return post;
    } catch (error) {
      post.status = 'failed';
      post.failureReason = error instanceof ApiException ? error.message : 'Publishing failed';
      await post.save();
      throw error;
    }
  }

  private async submitToProvider(
    workspaceId: string,
    account: SocialAccountDocument,
    content: ContentDocument,
    scheduledFor: Date,
    publishNow: boolean,
  ) {
    const imageUrls = await this.imagesForPlatform(workspaceId, account.platform, content);
    const text = [content.postCaption || content.post?.text || '', ...content.hashtags]
      .filter(Boolean)
      .join('\n\n');
    // Buffer's API has no TikTok auto-music option, so the music is baked into a video instead.
    if (needsRenderedMusic(account, imageUrls, content.video?.videoUrl)) {
      return this.publishingProviders.createPost(workspaceId, account, {
        text,
        imageUrls: [],
        videoUrl: await this.slideshowVideo.renderWithMusic(workspaceId, imageUrls),
        scheduledFor,
        publishNow,
      });
    }
    return this.publishingProviders.createPost(workspaceId, account, {
      text,
      imageUrls,
      videoUrl: content.video?.videoUrl,
      scheduledFor,
      publishNow,
    });
  }

  /**
   * The images a post is published with. Slides are cropped to the platform's
   * frame with their captions drawn on, matching the dashboard preview; plain
   * image posts only get TikTok's size fit.
   */
  private imagesForPlatform(workspaceId: string, platform: string, content: ContentDocument) {
    if (content.type === 'slideshow') {
      const slides = content.slideshow?.slides ?? [];
      if (!slides.length) return Promise.resolve([]);
      return this.slideRender.renderAll(
        workspaceId,
        slides.map((slide) => ({ imageUrl: slide.imageUrl, caption: slide.caption })),
        slideFrameFor(platform),
      );
    }
    const imageUrls = content.post?.imageUrls ?? [];
    if (platform !== 'tiktok' || !imageUrls.length) return Promise.resolve(imageUrls);
    return this.tiktokMediaFit.fitAll(workspaceId, imageUrls);
  }
}

export function needsRenderedMusic(
  account: Pick<SocialAccountDocument, 'platform' | 'connectionProvider' | 'publishingDefaults'>,
  imageUrls: string[],
  videoUrl?: string | null,
): boolean {
  return (
    account.platform === 'tiktok' &&
    account.connectionProvider === 'buffer' &&
    account.publishingDefaults?.autoAddMusic === 'yes' &&
    imageUrls.length > 0 &&
    !videoUrl
  );
}

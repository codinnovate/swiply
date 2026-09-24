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
import { TikTokMediaFitService } from '../media/tiktok-media-fit.service';
import { PublishingProvidersService } from '../publishing-providers/publishing-providers.service';
import type { PublishingProvider } from '../publishing-providers/schemas/publishing-provider-connection.schema';

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
    const post = await this.postModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      contentId: content._id,
      socialAccountId: account._id,
      platform: account.platform,
      scheduledFor,
      status: 'queued',
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
    } else if (dto.publishNow) {
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

  async publishNow(workspaceId: string, id: string) {
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
      const imageUrls = await this.imagesForPlatform(
        workspaceId,
        account.platform,
        content.type === 'slideshow'
          ? (content.slideshow?.slides.map((slide) => slide.imageUrl) ?? [])
          : (content.post?.imageUrls ?? []),
      );
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
          },
        );
      post.status = 'published';
      post.publishedAt = new Date();
      post.platformPostId = result.platformPostId;
      post.platformPostUrl = result.platformPostUrl;
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
    const imageUrls = await this.imagesForPlatform(
      workspaceId,
      account.platform,
      content.type === 'slideshow'
        ? (content.slideshow?.slides.map((slide) => slide.imageUrl) ?? [])
        : (content.post?.imageUrls ?? []),
    );
    const text = [content.postCaption || content.post?.text || '', ...content.hashtags]
      .filter(Boolean)
      .join('\n\n');
    return this.publishingProviders.createPost(workspaceId, account, {
      text,
      imageUrls,
      videoUrl: content.video?.videoUrl,
      scheduledFor,
      publishNow,
    });
  }

  private imagesForPlatform(workspaceId: string, platform: string, imageUrls: string[]) {
    if (platform !== 'tiktok' || !imageUrls.length) return Promise.resolve(imageUrls);
    return this.tiktokMediaFit.fitAll(workspaceId, imageUrls);
  }
}

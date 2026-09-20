import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types, isValidObjectId } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { CreateContentDto } from './dto/create-content.dto';
import { Content, ContentDocument } from './schemas/content.schema';
import { MediaService } from '../media/media.service';
import { TextService } from '../../ai/text.service';
import { VoiceProfilesService } from '../voice-profiles/voice-profiles.service';
import { UpdateContentDto } from './dto/update-content.dto';

type GeneratedCopy = Awaited<ReturnType<TextService['generate']>>;

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(Content.name) private readonly model: Model<ContentDocument>,
    private readonly media: MediaService,
    private readonly text: TextService,
    private readonly voices: VoiceProfilesService,
  ) {}

  async createManual(workspaceId: string, userId: string, dto: CreateContentDto) {
    if (dto.type === 'video') {
      if (!dto.providedVideoUrl) {
        throw ApiException.unprocessable(
          'VIDEO_REQUIRED',
          'Choose a video from this workspace before creating the draft',
        );
      }
      await this.media.assertVideoBelongsToWorkspace(workspaceId, dto.providedVideoUrl);
      return this.model.create({
        workspaceId: new Types.ObjectId(workspaceId),
        createdByUserId: new Types.ObjectId(userId),
        type: dto.type,
        goal: dto.goal ?? null,
        imageSource: null,
        postCaption: dto.postCaption ?? dto.text ?? '',
        hashtags: dto.hashtags ?? [],
        slideshow: null,
        post: null,
        video: {
          status: 'ready',
          script: null,
          videoUrl: dto.providedVideoUrl,
          thumbnailUrl: null,
          durationSeconds: null,
          provider: 'upload',
        },
        generationSource: 'manual',
        aiPrompt: null,
        targetCountry: dto.targetCountry?.trim() || null,
        aiProvider: null,
        aiModel: null,
        voiceProfileId: null,
        status: 'ready',
      });
    }
    const images = dto.providedImageUrls ?? [];
    let resolved: { imageUrl: string; mediaAssetId: Types.ObjectId | null }[] = [];
    if (dto.imageSource === 'user_provided') {
      const expected = dto.type === 'slideshow' ? (dto.slideCount ?? 2) : 1;
      if (images.length !== expected) {
        throw ApiException.unprocessable(
          'IMAGE_COUNT_MISMATCH',
          'Expected ' + expected + ' image(s), got ' + images.length,
          { expected, actual: images.length },
        );
      }
      resolved = await this.media.resolveImages(workspaceId, images, dto.providedMediaAssetIds);
    } else if (images.length) {
      throw ApiException.unprocessable(
        'IMAGE_SOURCE_CONFLICT',
        'AI-generated images cannot be supplied by the caller',
      );
    }
    if (dto.type === 'post' && dto.imageSource === 'ai_generated') {
      throw ApiException.unprocessable(
        'CONTENT_TYPE_NOT_READY',
        'AI image generation arrives in the next build step',
      );
    }
    const slides =
      dto.type === 'slideshow'
        ? resolved.map(({ imageUrl, mediaAssetId }, order) => ({
            order,
            imageUrl,
            mediaAssetId,
            caption: null,
            altText: null,
            imageSource: 'user_provided' as const,
          }))
        : null;
    const created = await this.model.create({
      workspaceId: new Types.ObjectId(workspaceId),
      createdByUserId: new Types.ObjectId(userId),
      type: dto.type,
      goal: dto.goal ?? null,
      imageSource: dto.imageSource,
      postCaption: dto.postCaption ?? '',
      hashtags: dto.hashtags ?? [],
      slideshow: slides ? { slides } : null,
      post:
        dto.type === 'post'
          ? { imageUrls: resolved.map((r) => r.imageUrl), text: dto.text ?? dto.postCaption ?? '' }
          : null,
      video: null,
      generationSource: 'manual',
      aiPrompt: null,
      targetCountry: dto.targetCountry?.trim() || null,
      aiProvider: null,
      aiModel: null,
      voiceProfileId: null,
      status: 'ready',
    });
    await this.recordSlideUsage(workspaceId, slides);
    return created;
  }

  async generate(workspaceId: string, userId: string, dto: CreateContentDto) {
    if (!dto.goal)
      throw ApiException.unprocessable(
        'CONTENT_GOAL_REQUIRED',
        'A goal is required for AI generation',
      );
    const topic = dto.topic?.trim();
    if (!topic)
      throw ApiException.unprocessable(
        'CONTENT_TOPIC_REQUIRED',
        'A topic is required for AI generation',
      );
    let voiceContext = 'Use a neutral, concise, brand-safe voice.';
    let voiceProfileId: Types.ObjectId | null = null;
    if (dto.socialAccountId) {
      const profile = await this.voices.get(workspaceId, dto.socialAccountId);
      if (profile) {
        voiceProfileId = profile._id;
        voiceContext = [
          profile.userSetTone.join(', '),
          profile.styleSummary,
          'Use the profile style attributes: ' + JSON.stringify(profile.styleAttributes),
        ]
          .filter(Boolean)
          .join('\n');
      }
    }
    const slideCount = dto.type === 'slideshow' ? (dto.slideCount ?? 2) : 0;
    const recentCopies = await this.recentGeneratedCopies(workspaceId);
    const copy = await this.generateUniqueCopy({
      userId,
      model: dto.aiModel,
      provider: dto.aiProvider,
      topic,
      targetCountry: dto.targetCountry?.trim() || undefined,
      goal: dto.goal,
      slideCount,
      voiceContext,
      recentCopies,
    });
    const contentFingerprint = this.fingerprintGeneratedCopy(copy);
    if (dto.type === 'video') {
      if (!dto.providedVideoUrl) {
        throw ApiException.unprocessable(
          'VIDEO_REQUIRED',
          'Choose an uploaded video before generating its copy',
        );
      }
      await this.media.assertVideoBelongsToWorkspace(workspaceId, dto.providedVideoUrl);
      return this.model.create({
        workspaceId: new Types.ObjectId(workspaceId),
        createdByUserId: new Types.ObjectId(userId),
        type: dto.type,
        goal: dto.goal,
        imageSource: null,
        postCaption: copy.postCaption,
        hashtags: copy.hashtags,
        slideshow: null,
        post: null,
        video: {
          status: 'ready',
          script: copy.postText,
          videoUrl: dto.providedVideoUrl,
          thumbnailUrl: null,
          durationSeconds: null,
          provider: 'upload',
        },
        generationSource: 'ai',
        aiPrompt: topic,
        targetCountry: dto.targetCountry?.trim() || null,
        contentFingerprint,
        aiProvider: copy.provider,
        aiModel: copy.model,
        voiceProfileId,
        status: 'ready',
      });
    }
    const images = dto.providedImageUrls ?? [];
    let resolved: { imageUrl: string; mediaAssetId: Types.ObjectId | null }[] = [];
    if (dto.imageSource === 'user_provided') {
      const expected = dto.type === 'slideshow' ? slideCount : 1;
      const textOnlyPost = dto.type === 'post' && images.length === 0;
      if (!textOnlyPost && images.length !== expected)
        throw ApiException.unprocessable(
          'IMAGE_COUNT_MISMATCH',
          'Expected ' + expected + ' image(s), got ' + images.length,
          { expected, actual: images.length },
        );
      resolved = textOnlyPost
        ? []
        : await this.media.resolveImages(workspaceId, images, dto.providedMediaAssetIds);
    } else if (images.length) {
      throw ApiException.unprocessable(
        'IMAGE_SOURCE_CONFLICT',
        'AI-generated images cannot be supplied by the caller',
      );
    } else {
      throw ApiException.unprocessable(
        'IMAGE_PROVIDER_NOT_CONFIGURED',
        'AI image generation is not configured on this deployment',
      );
    }
    const slides =
      dto.type === 'slideshow'
        ? resolved.map(({ imageUrl, mediaAssetId }, order) => ({
            order,
            imageUrl,
            mediaAssetId,
            caption: copy.slides[order]?.caption ?? null,
            altText: copy.slides[order]?.altText ?? null,
            imageSource: 'user_provided' as const,
          }))
        : null;
    const created = await this.model.create({
      workspaceId: new Types.ObjectId(workspaceId),
      createdByUserId: new Types.ObjectId(userId),
      type: dto.type,
      goal: dto.goal,
      imageSource: dto.imageSource,
      postCaption: copy.postCaption,
      hashtags: copy.hashtags,
      slideshow: slides ? { slides } : null,
      post: dto.type === 'post' ? { imageUrls: resolved.map((r) => r.imageUrl), text: copy.postText } : null,
      video: null,
      generationSource: 'ai',
      aiPrompt: topic,
      targetCountry: dto.targetCountry?.trim() || null,
      contentFingerprint,
      aiProvider: copy.provider,
      aiModel: copy.model,
      voiceProfileId,
      status: 'ready',
    });
    await this.recordSlideUsage(workspaceId, slides);
    return created;
  }

  private async generateUniqueCopy(request: {
    userId: string;
    model?: string;
    provider?: CreateContentDto['aiProvider'];
    topic: string;
    targetCountry?: string;
    goal: string;
    slideCount: number;
    voiceContext: string;
    recentCopies: string[];
  }): Promise<GeneratedCopy> {
    let lastCopy: GeneratedCopy | null = null;
    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const copy = await this.text.generate({
        userId: request.userId,
        model: request.model,
        provider: request.provider,
        topic: request.topic,
        targetCountry: request.targetCountry,
        goal: request.goal,
        slideCount: request.slideCount,
        voiceContext: request.voiceContext,
        uniquenessContext: this.uniquenessContext(request.recentCopies, lastCopy, attempt),
      });
      lastCopy = copy;
      const generatedText = this.generatedCopyText(copy);
      if (!this.tooSimilar(generatedText, request.recentCopies)) return copy;
    }
    throw ApiException.unprocessable(
      'CONTENT_TOO_SIMILAR',
      'Generated copy was too similar to recent content. Change the topic or try again.',
    );
  }

  private async recentGeneratedCopies(workspaceId: string): Promise<string[]> {
    const records = await this.model
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        generationSource: 'ai',
      })
      .sort({ createdAt: -1 })
      .limit(250)
      .lean()
      .exec();
    return records.map((record) => this.contentDocumentText(record)).filter(Boolean);
  }

  private uniquenessContext(recentCopies: string[], lastCopy: GeneratedCopy | null, attempt: number) {
    const recent = recentCopies.slice(0, 30).map((text, index) => `[${index + 1}] ${text.slice(0, 450)}`);
    const retry =
      attempt > 0 && lastCopy
        ? [
            'Previous attempt was rejected as too similar. Change the opening hook, narrative angle, CTA, examples, rhythm, and hashtags.',
            'Rejected attempt:',
            this.generatedCopyText(lastCopy).slice(0, 700),
          ]
        : [];
    return [...retry, ...recent].join('\n\n');
  }

  private fingerprintGeneratedCopy(copy: GeneratedCopy) {
    return createHash('sha256').update(this.normalizeCopy(this.generatedCopyText(copy))).digest('hex');
  }

  private tooSimilar(generatedText: string, recentCopies: string[]) {
    const normalized = this.normalizeCopy(generatedText);
    if (!normalized) return false;
    return recentCopies.some((recent) => {
      const normalizedRecent = this.normalizeCopy(recent);
      return (
        normalized === normalizedRecent ||
        this.jaccard(this.wordSet(normalized), this.wordSet(normalizedRecent)) >= 0.72 ||
        this.jaccard(this.trigramSet(normalized), this.trigramSet(normalizedRecent)) >= 0.55
      );
    });
  }

  private generatedCopyText(copy: GeneratedCopy) {
    return [
      copy.postCaption,
      copy.postText,
      copy.hashtags.join(' '),
      ...copy.slides.flatMap((slide) => [slide.caption, slide.altText]),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private contentDocumentText(record: Partial<Content>) {
    return [
      record.postCaption,
      record.post?.text,
      record.video?.script,
      ...(record.hashtags ?? []),
      ...(record.slideshow?.slides ?? []).flatMap((slide) => [slide.caption, slide.altText]),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeCopy(text: string) {
    return text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^\p{L}\p{N}#\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private wordSet(text: string) {
    return new Set(text.split(' ').filter((word) => word.length > 2));
  }

  private trigramSet(text: string) {
    const compact = text.replace(/\s+/g, ' ');
    const grams = new Set<string>();
    for (let index = 0; index <= compact.length - 3; index += 1) {
      grams.add(compact.slice(index, index + 3));
    }
    return grams;
  }

  private jaccard(a: Set<string>, b: Set<string>) {
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    a.forEach((item) => {
      if (b.has(item)) intersection += 1;
    });
    return intersection / (a.size + b.size - intersection);
  }

  async list(
    workspaceId: string,
    type?: string,
    status?: string,
    goal?: string,
    mediaAssetId?: string,
  ) {
    const filter: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (goal) filter.goal = goal;
    if (mediaAssetId && isValidObjectId(mediaAssetId)) {
      filter['slideshow.slides.mediaAssetId'] = new Types.ObjectId(mediaAssetId);
    }
    return this.model.find(filter).sort({ createdAt: -1 }).limit(100).exec();
  }

  async get(workspaceId: string, id: string) {
    if (!isValidObjectId(id)) throw ApiException.notFound('Content');
    const content = await this.model
      .findOne({ _id: new Types.ObjectId(id), workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!content) throw ApiException.notFound('Content');
    return content;
  }

  async remove(workspaceId: string, id: string) {
    const content = await this.get(workspaceId, id);
    await content.deleteOne();
  }

  async update(workspaceId: string, id: string, dto: UpdateContentDto) {
    const content = await this.get(workspaceId, id);
    let updatedSlides: { mediaAssetId: Types.ObjectId | null }[] | null = null;
    if (dto.imageUrls) {
      const resolved = await this.media.resolveImages(workspaceId, dto.imageUrls, dto.mediaAssetIds);
      if (content.type === 'slideshow' && content.slideshow) {
        content.slideshow.slides = resolved.map(({ imageUrl, mediaAssetId }, order) => ({
          order,
          imageUrl,
          mediaAssetId,
          caption: content.slideshow?.slides[order]?.caption ?? null,
          altText: content.slideshow?.slides[order]?.altText ?? null,
          imageSource: 'user_provided',
        }));
        updatedSlides = content.slideshow.slides;
      } else if (content.type === 'post' && content.post) {
        content.post.imageUrls = resolved.map((r) => r.imageUrl);
      }
    }
    if (dto.postCaption !== undefined) content.postCaption = dto.postCaption;
    if (dto.text !== undefined && content.post) content.post.text = dto.text;
    if (dto.hashtags !== undefined) content.hashtags = dto.hashtags;
    if (dto.status !== undefined) content.status = dto.status;
    const saved = await content.save();
    if (updatedSlides) await this.recordSlideUsage(workspaceId, updatedSlides);
    return saved;
  }

  async duplicate(workspaceId: string, userId: string, id: string) {
    const source = await this.get(workspaceId, id);
    const raw = source.toObject() as unknown as Record<string, unknown>;
    delete raw._id;
    delete raw.__v;
    delete raw.createdAt;
    delete raw.updatedAt;
    const created = await this.model.create({
      ...raw,
      workspaceId: new Types.ObjectId(workspaceId),
      createdByUserId: new Types.ObjectId(userId),
      status: 'ready',
    });
    const slides = (created.slideshow?.slides ?? null) as { mediaAssetId: Types.ObjectId | null }[] | null;
    await this.recordSlideUsage(workspaceId, slides);
    return created;
  }

  private async recordSlideUsage(
    workspaceId: string,
    slides: { mediaAssetId: Types.ObjectId | null }[] | null,
  ): Promise<void> {
    if (!slides?.length) return;
    const ids = slides.map((slide) => slide.mediaAssetId).filter((id): id is Types.ObjectId => !!id);
    if (!ids.length) return;
    try {
      await this.media.recordUsage(workspaceId, ids);
    } catch {
      // usage tracking is best-effort and must never block content creation/updates
    }
  }
}

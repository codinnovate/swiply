import { Model, Types } from 'mongoose';

import { ContentService } from './content.service';
import { ContentDocument } from './schemas/content.schema';
import { MediaService } from '../media/media.service';
import { TextService } from '../../ai/text.service';
import { VoiceProfilesService } from '../voice-profiles/voice-profiles.service';

const workspaceId = new Types.ObjectId().toHexString();
const userId = new Types.ObjectId().toHexString();

describe('ContentService', () => {
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const media = {
    assertVideoBelongsToWorkspace: jest.fn(),
    resolveImages: jest.fn(),
    recordUsage: jest.fn(),
  };
  const text = { generate: jest.fn() };
  const voices = { get: jest.fn() };

  let service: ContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentService(
      model as unknown as Model<ContentDocument>,
      media as unknown as MediaService,
      text as unknown as TextService,
      voices as unknown as VoiceProfilesService,
    );
  });

  describe('createManual', () => {
    it('resolves slide imageUrls via mediaAssetIds and records usage after creation', async () => {
      const assetId = new Types.ObjectId();
      media.resolveImages.mockResolvedValue([
        { imageUrl: 'https://cdn.example.com/a.png', mediaAssetId: assetId },
        { imageUrl: 'https://cdn.example.com/b.png', mediaAssetId: null },
      ]);
      model.create.mockResolvedValue({ id: 'content-id' });

      const created = await service.createManual(workspaceId, userId, {
        type: 'slideshow',
        imageSource: 'user_provided',
        slideCount: 2,
        providedImageUrls: ['https://spoofed.example.com/a.png', 'https://cdn.example.com/b.png'],
        providedMediaAssetIds: [assetId.toString(), ''],
      } as never);

      expect(media.resolveImages).toHaveBeenCalledWith(
        workspaceId,
        ['https://spoofed.example.com/a.png', 'https://cdn.example.com/b.png'],
        [assetId.toString(), ''],
      );
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slideshow: {
            slides: [
              expect.objectContaining({
                order: 0,
                imageUrl: 'https://cdn.example.com/a.png',
                mediaAssetId: assetId,
              }),
              expect.objectContaining({ order: 1, imageUrl: 'https://cdn.example.com/b.png', mediaAssetId: null }),
            ],
          },
        }),
      );
      expect(media.recordUsage).toHaveBeenCalledWith(workspaceId, [assetId]);
      expect(created).toEqual({ id: 'content-id' });
    });

    it('does not record usage when no slide references a library asset', async () => {
      media.resolveImages.mockResolvedValue([
        { imageUrl: 'https://cdn.example.com/a.png', mediaAssetId: null },
        { imageUrl: 'https://cdn.example.com/b.png', mediaAssetId: null },
      ]);
      model.create.mockResolvedValue({ id: 'content-id' });

      await service.createManual(workspaceId, userId, {
        type: 'slideshow',
        imageSource: 'user_provided',
        slideCount: 2,
        providedImageUrls: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'],
      } as never);

      expect(media.recordUsage).not.toHaveBeenCalled();
    });

    it('rejects a slide count mismatch before resolving images', async () => {
      await expect(
        service.createManual(workspaceId, userId, {
          type: 'slideshow',
          imageSource: 'user_provided',
          slideCount: 2,
          providedImageUrls: ['https://cdn.example.com/a.png'],
        } as never),
      ).rejects.toMatchObject({ code: 'IMAGE_COUNT_MISMATCH' });
      expect(media.resolveImages).not.toHaveBeenCalled();
    });

    it('never lets a usage-tracking failure block content creation', async () => {
      const assetId = new Types.ObjectId();
      media.resolveImages.mockResolvedValue([
        { imageUrl: 'https://cdn.example.com/a.png', mediaAssetId: assetId },
        { imageUrl: 'https://cdn.example.com/b.png', mediaAssetId: null },
      ]);
      model.create.mockResolvedValue({ id: 'content-id' });
      media.recordUsage.mockRejectedValue(new Error('mongo down'));

      const created = await service.createManual(workspaceId, userId, {
        type: 'slideshow',
        imageSource: 'user_provided',
        slideCount: 2,
        providedImageUrls: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'],
        providedMediaAssetIds: [assetId.toString(), ''],
      } as never);

      expect(created).toEqual({ id: 'content-id' });
    });
  });

  describe('generate', () => {
    beforeEach(() => {
      voices.get.mockResolvedValue(null);
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      media.resolveImages.mockResolvedValue([
        { imageUrl: 'https://cdn.example.com/a.png', mediaAssetId: null },
      ]);
      model.create.mockImplementation(async (value) => ({ id: 'content-id', ...value }));
    });

    it('stores a fingerprint for generated content', async () => {
      text.generate.mockResolvedValue({
        postCaption: 'Stop scrolling for this workflow.',
        postText: 'Here is a fresh workflow angle.',
        hashtags: ['#workflow'],
        slides: [],
        model: 'gpt-5-mini',
        provider: 'openai',
      });

      const created = await service.generate(workspaceId, userId, {
        type: 'post',
        goal: 'awareness',
        topic: 'workflow planning',
        imageSource: 'user_provided',
        providedImageUrls: ['https://cdn.example.com/a.png'],
      } as never);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      expect(created).toEqual(
        expect.objectContaining({
          contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
    });

    it('allows AI-generated text-only posts without selected media', async () => {
      text.generate.mockResolvedValue({
        postCaption: 'A clean text-only idea.',
        postText: 'Start with the bottleneck, then name the first tiny action.',
        hashtags: ['#planning'],
        slides: [],
        model: 'gpt-5-mini',
        provider: 'openai',
      });

      await service.generate(workspaceId, userId, {
        type: 'post',
        goal: 'engagement',
        topic: 'planning',
        imageSource: 'user_provided',
      } as never);

      expect(media.resolveImages).not.toHaveBeenCalled();
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          post: {
            imageUrls: [],
            text: 'Start with the bottleneck, then name the first tiny action.',
          },
        }),
      );
    });

    it('retries when generated copy is too similar to recent AI content', async () => {
      model.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            postCaption: 'Stop scrolling for this workflow.',
            post: { text: 'Here is a fresh workflow angle.' },
            hashtags: ['#workflow'],
          },
        ]),
      });
      text.generate
        .mockResolvedValueOnce({
          postCaption: 'Stop scrolling for this workflow.',
          postText: 'Here is a fresh workflow angle.',
          hashtags: ['#workflow'],
          slides: [],
          model: 'gpt-5-mini',
          provider: 'openai',
        })
        .mockResolvedValueOnce({
          postCaption: 'Most planners fail because the first task is too vague.',
          postText: 'Try naming the first visible action before you open your calendar.',
          hashtags: ['#planning', '#creatorops'],
          slides: [],
          model: 'gpt-5-mini',
          provider: 'openai',
        });

      await service.generate(workspaceId, userId, {
        type: 'post',
        goal: 'awareness',
        topic: 'workflow planning',
        imageSource: 'user_provided',
        providedImageUrls: ['https://cdn.example.com/a.png'],
      } as never);

      expect(text.generate).toHaveBeenCalledTimes(2);
      expect(text.generate.mock.calls[1][0].uniquenessContext).toContain(
        'Previous attempt was rejected',
      );
    });
  });

  describe('update', () => {
    it('resolves and records usage for updated slide media asset ids', async () => {
      const assetId = new Types.ObjectId();
      const save = jest.fn().mockResolvedValue({ id: 'content-id' });
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          type: 'slideshow',
          slideshow: { slides: [{ caption: 'old', altText: null }] },
          save,
        }),
      });
      media.resolveImages.mockResolvedValue([
        { imageUrl: 'https://cdn.example.com/a.png', mediaAssetId: assetId },
      ]);

      await service.update(workspaceId, new Types.ObjectId().toHexString(), {
        imageUrls: ['https://cdn.example.com/a.png'],
        mediaAssetIds: [assetId.toString()],
      } as never);

      expect(media.recordUsage).toHaveBeenCalledWith(workspaceId, [assetId]);
      expect(save).toHaveBeenCalled();
    });
  });
});

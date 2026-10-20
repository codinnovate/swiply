import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import nock from 'nock';

import { ApiException, ApiErrorBody } from '../../../common/errors/api.exception';
import { TikTokAdapter } from '../tiktok.adapter';
import { chunkPlan } from './tiktok-posting.client';
import { assertSettingsAllowed, type TikTokCreatorInfo, type TikTokPostSettings } from './tiktok-post-settings';

const API = 'https://open.tiktokapis.com';
const MB = 1024 * 1024;

interface SentBody {
  post_mode?: string;
  post_info: Record<string, unknown>;
  source_info: Record<string, unknown>;
}

const adapter = new TikTokAdapter(new HttpService(), {
  get: () => 'configured',
} as unknown as ConfigService);

const settings: TikTokPostSettings = {
  title: null,
  privacyLevel: 'SELF_ONLY',
  allowComment: true,
  allowDuet: false,
  allowStitch: false,
  brandOrganic: false,
  brandContent: false,
  autoAddMusic: true,
  isAigc: true,
  consentedAt: new Date(),
};

const creator: TikTokCreatorInfo = {
  username: 'creator',
  nickname: 'Creator',
  avatarUrl: null,
  privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
  commentDisabled: false,
  duetDisabled: true,
  stitchDisabled: false,
  maxVideoPostDurationSec: 60,
};

const creatorBody = {
  data: {
    creator_nickname: 'Creator',
    privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
    comment_disabled: false,
    duet_disabled: true,
    stitch_disabled: false,
    max_video_post_duration_sec: 60,
  },
  error: { code: 'ok' },
};

const photoContent = {
  type: 'slideshow' as const,
  platformAccountId: 'open-id',
  imageCount: 2,
  postCaption: 'Caption',
  hashtags: ['#a'],
  imageUrls: ['https://media.swiply.test/1.jpg', 'https://media.swiply.test/2.jpg'],
};

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error.code;
  }
  throw new Error('expected the call to reject');
}

describe('TikTok Direct Post', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  describe('chunkPlan', () => {
    it('sends a video up to 64 MB as one chunk', () => {
      expect(chunkPlan(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunkCount: 1 });
      expect(chunkPlan(64 * MB)).toEqual({ chunkSize: 64 * MB, totalChunkCount: 1 });
    });

    it('rounds the chunk count down so the final chunk carries the remainder', () => {
      expect(chunkPlan(105 * MB)).toEqual({ chunkSize: 10 * MB, totalChunkCount: 10 });
    });
  });

  describe('assertSettingsAllowed', () => {
    /** The readable message, or null when the settings pass. */
    const check = (patch: Partial<TikTokPostSettings>, isVideo = true, durationSeconds = 30) => {
      try {
        assertSettingsAllowed({ ...settings, ...patch }, creator, { isVideo, durationSeconds });
        return null;
      } catch (error) {
        return ((error as ApiException).getResponse() as ApiErrorBody).error.message;
      }
    };

    it('accepts choices the creator account allows', () => {
      expect(check({})).toBeNull();
    });

    it('rejects a privacy level missing from privacy_level_options', () => {
      expect(check({ privacyLevel: 'FOLLOWER_OF_CREATOR' })).toMatch(/can't post/);
    });

    it('rejects private branded content', () => {
      expect(check({ brandContent: true })).toMatch(/Branded content cannot be private/);
    });

    it('rejects an interaction the account has disabled', () => {
      expect(check({ allowDuet: true })).toMatch(/Duet/);
    });

    it('ignores duet on photo posts, which only offer comments', () => {
      expect(check({ allowDuet: true }, false)).toBeNull();
    });

    it('rejects a video longer than max_video_post_duration_sec', () => {
      expect(check({}, true, 61)).toMatch(/up to 60 seconds/);
    });
  });

  describe('publishContent', () => {
    it('refuses to post without the creator choosing settings', async () => {
      expect(await codeOf(() => adapter.publishContent('token', photoContent))).toBe(
        'TIKTOK_POST_SETTINGS_REQUIRED',
      );
    });

    it('direct-posts photos with the creator settings and returns the publish_id', async () => {
      let body: SentBody = { post_info: {}, source_info: {} };
      nock(API).post('/v2/post/publish/creator_info/query/').reply(200, creatorBody);
      nock(API)
        .post('/v2/post/publish/content/init/', (sent: SentBody) => {
          body = sent;
          return true;
        })
        .reply(200, { data: { publish_id: 'p_1' }, error: { code: 'ok' } });

      const result = await adapter.publishContent('token', { ...photoContent, tiktok: settings });

      expect(result).toEqual({ platformPostId: 'p_1', platformPostUrl: null, status: 'processing' });
      expect(body.post_mode).toBe('DIRECT_POST');
      expect(body.post_info).toMatchObject({
        privacy_level: 'SELF_ONLY',
        disable_comment: false,
        auto_add_music: true,
        description: 'Caption #a',
      });
      expect(body.source_info.photo_images).toEqual(photoContent.imageUrls);
    });

    it('stops before uploading when the creator has hit the posting cap', async () => {
      nock(API)
        .post('/v2/post/publish/creator_info/query/')
        .reply(200, { data: {}, error: { code: 'spam_risk_too_many_posts' } });

      expect(
        await codeOf(() => adapter.publishContent('token', { ...photoContent, tiktok: settings })),
      ).toBe('TIKTOK_POSTING_LIMIT_REACHED');
    });

    it('uploads a video by FILE_UPLOAD with the Content-Range TikTok expects', async () => {
      const video = Buffer.alloc(1024, 1);
      let range = '';
      nock(API).post('/v2/post/publish/creator_info/query/').reply(200, creatorBody);
      nock('https://media.swiply.test').get('/v.mp4').reply(200, video);
      nock(API)
        .post('/v2/post/publish/video/init/', (sent: SentBody) =>
          sent.source_info.source === 'FILE_UPLOAD' && sent.source_info.video_size === 1024 && sent.post_info.is_aigc === true,
        )
        .reply(200, { data: { publish_id: 'v_1', upload_url: 'https://upload.tiktok.test/u' }, error: { code: 'ok' } });
      nock('https://upload.tiktok.test')
        .put('/u')
        .reply(function () {
          range = String(this.req.headers['content-range']);
          return [201];
        });

      const result = await adapter.publishContent('token', {
        ...photoContent,
        type: 'video',
        imageUrls: [],
        videoUrl: 'https://media.swiply.test/v.mp4',
        tiktok: settings,
      });

      expect(result.platformPostId).toBe('v_1');
      expect(range).toBe('bytes 0-1023/1024');
    });
  });
});

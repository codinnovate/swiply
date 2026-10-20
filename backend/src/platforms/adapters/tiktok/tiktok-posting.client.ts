import { HttpService } from '@nestjs/axios';
import { HttpStatus, Logger } from '@nestjs/common';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { ApiException } from '../../../common/errors/api.exception';
import {
  TIKTOK_PRIVACY_LEVELS,
  type TikTokCreatorInfo,
  type TikTokPrivacyLevel,
} from './tiktok-post-settings';

const API = 'https://open.tiktokapis.com/v2/post/publish';
/** TikTok takes a video of up to 64 MB as one chunk; larger ones must be split. */
const SINGLE_CHUNK_MAX = 64 * 1024 * 1024;
const CHUNK = 10 * 1024 * 1024;
/** Uploads and downloads move whole videos, so they outlive the module-wide 10s timeout. */
const TRANSFER_TIMEOUT_MS = 5 * 60 * 1000;

/** Errors TikTok reports while the account is temporarily unable to post. */
const LIMIT_ERRORS = new Set([
  'spam_risk_too_many_posts',
  'spam_risk_user_banned_from_posting',
  'reached_active_user_cap',
]);

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
}

export type TikTokPublishState =
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED';

export interface TikTokPublishStatus {
  status: TikTokPublishState;
  failReason: string | null;
  postIds: string[];
}

/** File-upload chunk plan per TikTok's media transfer guide. */
export function chunkPlan(size: number) {
  if (size <= SINGLE_CHUNK_MAX) return { chunkSize: size, totalChunkCount: 1 };
  // Rounded down: the final chunk carries the remainder (at most 2x CHUNK, under TikTok's 128 MB cap).
  return { chunkSize: CHUNK, totalChunkCount: Math.floor(size / CHUNK) };
}

/**
 * Content Posting API calls (Direct Post). Kept apart from the adapter so the
 * OAuth half stays readable; every method takes the already-decrypted token.
 */
export class TikTokPostingClient {
  private readonly logger = new Logger('TikTokPostingClient');

  constructor(private readonly http: HttpService) {}

  async queryCreatorInfo(token: string): Promise<TikTokCreatorInfo> {
    const data = await this.call<{
      creator_username?: string;
      creator_nickname?: string;
      creator_avatar_url?: string;
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
    }>(token, '/creator_info/query/', {}, 'creator info lookup');
    return {
      username: data.creator_username ?? null,
      nickname: data.creator_nickname ?? null,
      avatarUrl: data.creator_avatar_url ?? null,
      privacyLevelOptions: (data.privacy_level_options ?? []).filter(
        (level): level is TikTokPrivacyLevel =>
          (TIKTOK_PRIVACY_LEVELS as readonly string[]).includes(level),
      ),
      commentDisabled: Boolean(data.comment_disabled),
      duetDisabled: Boolean(data.duet_disabled),
      stitchDisabled: Boolean(data.stitch_disabled),
      maxVideoPostDurationSec: data.max_video_post_duration_sec ?? null,
    };
  }

  /**
   * Video Direct Post via FILE_UPLOAD, so the media host doesn't have to be a
   * TikTok-verified domain. Returns the publish_id to poll.
   */
  async postVideo(token: string, videoUrl: string, postInfo: Record<string, unknown>) {
    const video = await this.download(videoUrl);
    const { chunkSize, totalChunkCount } = chunkPlan(video.length);
    const init = await this.call<{ publish_id?: string; upload_url?: string }>(
      token,
      '/video/init/',
      {
        post_info: postInfo,
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: video.length,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      },
      'video publish',
    );
    if (!init.publish_id || !init.upload_url) throw this.failure('video publish', 'missing_upload_url');
    for (let index = 0; index < totalChunkCount; index += 1) {
      const start = index * chunkSize;
      // The final chunk absorbs the remainder, as TikTok's guide requires.
      const end = index === totalChunkCount - 1 ? video.length : start + chunkSize;
      await this.putChunk(init.upload_url, video.subarray(start, end), start, video.length);
    }
    return init.publish_id;
  }

  /** Photo Direct Post. TikTok only pulls photos from a verified domain or URL prefix. */
  async postPhotos(
    token: string,
    imageUrls: string[],
    postInfo: Record<string, unknown>,
  ): Promise<string> {
    const init = await this.call<{ publish_id?: string }>(
      token,
      '/content/init/',
      {
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        post_info: postInfo,
        source_info: { source: 'PULL_FROM_URL', photo_images: imageUrls, photo_cover_index: 0 },
      },
      'photo publish',
    );
    if (!init.publish_id) throw this.failure('photo publish', 'missing_publish_id');
    return init.publish_id;
  }

  async fetchStatus(token: string, publishId: string): Promise<TikTokPublishStatus> {
    const data = await this.call<{
      status?: TikTokPublishState;
      fail_reason?: string;
      publicaly_available_post_id?: Array<string | number>;
    }>(token, '/status/fetch/', { publish_id: publishId }, 'publish status lookup');
    return {
      status: data.status ?? 'PROCESSING_UPLOAD',
      failReason: data.fail_reason || null,
      postIds: (data.publicaly_available_post_id ?? []).map(String),
    };
  }

  private async call<T>(token: string, path: string, body: object, stage: string): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.post<TikTokEnvelope<T>>(API + path, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        }),
      );
      const code = response.data.error?.code;
      // creator_info reports a reached posting cap with HTTP 200, so the body is authoritative.
      if (code && code !== 'ok') throw this.failure(stage, code, response.data.error?.log_id);
      return response.data.data ?? ({} as T);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      const body = (error as AxiosError<TikTokEnvelope<unknown>>).response?.data;
      throw this.failure(stage, body?.error?.code ?? (error as AxiosError).code, body?.error?.log_id);
    }
  }

  private async download(url: string): Promise<Buffer> {
    try {
      const response = await firstValueFrom(
        this.http.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: TRANSFER_TIMEOUT_MS }),
      );
      return Buffer.from(response.data);
    } catch (error) {
      throw this.failure('video download', (error as AxiosError).code ?? 'download_failed');
    }
  }

  private async putChunk(uploadUrl: string, chunk: Buffer, start: number, total: number) {
    try {
      await firstValueFrom(
        this.http.put(uploadUrl, chunk, {
          timeout: TRANSFER_TIMEOUT_MS,
          maxBodyLength: Infinity,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': chunk.length,
            'Content-Range': `bytes ${start}-${start + chunk.length - 1}/${total}`,
          },
        }),
      );
    } catch (error) {
      throw this.failure('video upload', `http_${(error as AxiosError).response?.status ?? 'error'}`);
    }
  }

  /** Keeps TikTok's error slug and log_id (for support tickets) and drops the rest of the body. */
  private failure(stage: string, code?: string, logId?: string): ApiException {
    const reason = code || 'unknown_error';
    this.logger.warn(`tiktok ${stage} failed: ${reason}${logId ? ` (log_id ${logId})` : ''}`);
    if (LIMIT_ERRORS.has(reason)) {
      return ApiException.unprocessable(
        'TIKTOK_POSTING_LIMIT_REACHED',
        "This TikTok account can't post right now. Try again later.",
        { platform: 'tiktok', reason },
      );
    }
    if (reason === 'access_token_invalid' || reason === 'scope_not_authorized') {
      return ApiException.unauthorized(
        'TOKEN_REFRESH_FAILED',
        'Reconnect TikTok to keep publishing',
        { platform: 'tiktok', reason },
      );
    }
    return new ApiException(
      'TIKTOK_PUBLISH_FAILED',
      `TikTok rejected the ${stage}`,
      HttpStatus.BAD_GATEWAY,
      { platform: 'tiktok', reason, logId: logId ?? null },
    );
  }
}

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { BasePlatformAdapter } from '../base-platform.adapter';
import type {
  OAuthAuthorizeRequest,
  OAuthExchangeRequest,
  PlatformCapabilities,
  PlatformConnection,
  PlatformCredentials,
  PostMetricsInput,
  PublishableContent,
  PublishResult,
  SourcePostInput,
} from '../platform-adapter.interface';
import {
  assertSettingsAllowed,
  commonPostInfo,
  type TikTokCreatorInfo,
} from './tiktok/tiktok-post-settings';
import { TikTokPostingClient, type TikTokPublishStatus } from './tiktok/tiktok-posting.client';
import { ApiException } from '../../common/errors/api.exception';

const VIDEO_METRIC_FIELDS =
  'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count';

interface TikTokVideo {
  id?: string;
  title?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

interface TikTokVideoPage {
  data?: { videos?: TikTokVideo[]; cursor?: number; has_more?: boolean };
}

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

/** Photo Mode posting needs video.publish too — TikTok scopes them together. */
const SCOPES = ['user.info.basic', 'video.list', 'video.upload', 'video.publish'];

interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  scope?: string;
}

interface TikTokUserResponse {
  data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
}

/**
 * Section 6. Note the audit constraint: until the app passes TikTok's review,
 * Direct Post only works against the developer's own sandboxed account, so a
 * successful connect here does not imply publishing will work in production.
 */
@Injectable()
export class TikTokAdapter extends BasePlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    platform: 'tiktok',
    usesPkce: true,
    supportsSlideshow: true,
    slideshowImageRange: [2, 35],
    supportsVideo: true,
    // Not a supported post type on TikTok — every post carries media.
    supportsPost: false,
    allowsTextOnlyPost: false,
    // The Comments API is limited and there is no reliable mentions feed.
    supportsMentions: false,
    supportsReplies: false,
    maxTextLength: 2200,
  };

  private readonly posting: TikTokPostingClient;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
    this.posting = new TikTokPostingClient(http);
  }

  isConfigured(): boolean {
    return Boolean(this.clientKey && this.clientSecret);
  }

  getOAuthUrl(request: OAuthAuthorizeRequest): string {
    if (!this.isConfigured()) throw this.notConfigured();

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_key', this.clientKey as string);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection> {
    if (!this.isConfigured()) throw this.notConfigured();

    const token = await this.postToken({
      client_key: this.clientKey as string,
      client_secret: this.clientSecret as string,
      code: request.code,
      grant_type: 'authorization_code',
      redirect_uri: request.redirectUri,
      code_verifier: request.codeVerifier,
    });

    const identity = await this.fetchIdentity(token.access_token);

    return {
      ...this.toCredentials(token),
      accountId: token.open_id ?? identity.accountId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    if (!this.isConfigured()) throw this.notConfigured();

    return this.toCredentials(
      await this.postToken(
        {
          client_key: this.clientKey as string,
          client_secret: this.clientSecret as string,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        'token refresh',
      ),
    );
  }

  async fetchRecentPosts(accessToken: string, limit: number): Promise<SourcePostInput[]> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ data?: { videos?: Array<{ id?: string; title?: string; create_time?: number; like_count?: number; comment_count?: number; share_count?: number }> } }>(
          'https://open.tiktokapis.com/v2/video/list/',
          { max_count: Math.min(limit, 20), cursor: 0 },
          { params: { fields: 'id,title,create_time,like_count,comment_count,share_count' }, headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      return (response.data.data?.videos ?? []).flatMap((post) =>
        post.id && post.title && post.create_time
          ? [{ platformPostId: post.id, text: post.title, postedAt: new Date(post.create_time * 1000), engagementScore: (post.like_count ?? 0) + (post.comment_count ?? 0) + (post.share_count ?? 0) }]
          : [],
      );
    } catch (error) {
      throw this.exchangeFailure(error, 'recent posts lookup');
    }
  }

  /**
   * The account's recent videos with their public counts, newest first.
   * `video/list` pages at 20, so this follows the cursor until `limit`.
   */
  async fetchPostMetrics(accessToken: string, limit: number): Promise<PostMetricsInput[]> {
    const metrics: PostMetricsInput[] = [];
    let cursor: number | undefined = 0;
    try {
      while (cursor !== undefined && metrics.length < limit) {
        const response: { data: TikTokVideoPage } = await firstValueFrom(
          this.http.post<TikTokVideoPage>(
            'https://open.tiktokapis.com/v2/video/list/',
            { max_count: Math.min(limit - metrics.length, 20), cursor },
            { params: { fields: VIDEO_METRIC_FIELDS }, headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        );
        const page: TikTokVideoPage['data'] = response.data.data;
        for (const video of page?.videos ?? []) {
          if (!video.id || !video.create_time) continue;
          metrics.push({
            platformPostId: video.id,
            title: video.title || null,
            postedAt: new Date(video.create_time * 1000),
            coverImageUrl: video.cover_image_url ?? null,
            shareUrl: video.share_url ?? null,
            views: video.view_count ?? 0,
            likes: video.like_count ?? 0,
            comments: video.comment_count ?? 0,
            shares: video.share_count ?? 0,
          });
        }
        cursor = page?.has_more && page.cursor !== undefined && page.videos?.length ? page.cursor : undefined;
      }
    } catch (error) {
      throw this.exchangeFailure(error, 'video metrics lookup');
    }
    return metrics.slice(0, limit);
  }

  /** Fresh creator state; TikTok requires it each time the post screen renders. */
  queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    return this.posting.queryCreatorInfo(accessToken);
  }

  fetchPublishStatus(accessToken: string, publishId: string): Promise<TikTokPublishStatus> {
    return this.posting.fetchStatus(accessToken, publishId);
  }

  /**
   * Direct Post. Settings come from the creator, never from defaults, and are
   * re-checked against live creator_info so a stale choice (a privacy option
   * the account lost, a reached posting cap) fails before any upload starts.
   */
  async publishContent(accessToken: string, content: PublishableContent): Promise<PublishResult> {
    const settings = content.tiktok;
    if (!settings) {
      throw ApiException.unprocessable(
        'TIKTOK_POST_SETTINGS_REQUIRED',
        'Choose TikTok visibility, interactions and disclosure before posting',
      );
    }
    const isVideo = Boolean(content.videoUrl);
    if (!isVideo && !content.imageUrls.length) {
      throw ApiException.unprocessable('CONTENT_INVALID_FOR_PLATFORM', 'TikTok posts need a video or photos');
    }
    const creator = await this.posting.queryCreatorInfo(accessToken);
    assertSettingsAllowed(settings, creator, {
      isVideo,
      durationSeconds: content.videoDurationSeconds,
    });

    const caption = [content.postCaption, ...content.hashtags].filter(Boolean).join(' ');
    const publishId = isVideo
      ? await this.posting.postVideo(accessToken, content.videoUrl as string, {
          ...commonPostInfo(settings),
          title: caption,
          disable_duet: !settings.allowDuet,
          disable_stitch: !settings.allowStitch,
          is_aigc: settings.isAigc,
        })
      : await this.posting.postPhotos(accessToken, content.imageUrls, {
          ...commonPostInfo(settings),
          title: settings.title || undefined,
          description: caption,
          auto_add_music: settings.autoAddMusic,
        });
    return { platformPostId: publishId, platformPostUrl: null, status: 'processing' };
  }

  private async postToken(
    body: Record<string, string>,
    stage = 'token exchange',
  ): Promise<TikTokTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<TikTokTokenResponse>(TOKEN_URL, new URLSearchParams(body).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      if (!response.data?.access_token) {
        throw new Error('response carried no access_token');
      }

      return response.data;
    } catch (error) {
      throw this.exchangeFailure(error, stage);
    }
  }

  private async fetchIdentity(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.http.get<TikTokUserResponse>(USER_INFO_URL, {
          params: { fields: 'open_id,display_name,avatar_url' },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const user = response.data?.data?.user;
      return {
        accountId: user?.open_id ?? '',
        // A TikTok account can genuinely have no display name set.
        displayName: user?.display_name || 'TikTok account',
        avatarUrl: user?.avatar_url ?? null,
      };
    } catch (error) {
      throw this.exchangeFailure(error, 'profile lookup');
    }
  }

  /** postToken has already proved `access_token` is present. */
  private toCredentials(token: TikTokTokenResponse): PlatformCredentials {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope ? token.scope.split(/[,\s]+/).filter(Boolean) : SCOPES,
    };
  }

  private get clientKey(): string | undefined {
    return this.config.get<string>('platforms.tiktok.clientKey');
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('platforms.tiktok.clientSecret');
  }
}

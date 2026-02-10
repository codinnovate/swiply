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
} from '../platform-adapter.interface';

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

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
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

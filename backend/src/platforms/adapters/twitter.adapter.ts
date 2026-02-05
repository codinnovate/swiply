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

const AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const ME_URL = 'https://api.twitter.com/2/users/me';

/** offline.access is what makes a refresh token be issued at all. */
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

/** Tiers that can actually pull the mentions timeline (Section 16). */
const MENTION_CAPABLE_TIERS = new Set(['basic', 'pro']);

interface TwitterTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface TwitterMeResponse {
  data?: { id?: string; name?: string; username?: string; profile_image_url?: string };
}

/**
 * Section 6. X is the one platform whose reply automation depends on billing:
 * the free tier cannot reliably pull a mentions timeline, so `supportsMentions`
 * is derived from TWITTER_API_TIER rather than hardcoded. The engagement engine
 * (build step 10) reads the capability instead of discovering the limit as a
 * 403 in production.
 */
@Injectable()
export class TwitterAdapter extends BasePlatformAdapter {
  readonly capabilities: PlatformCapabilities;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();

    this.capabilities = {
      platform: 'twitter',
      usesPkce: true,
      // Up to 4 images per tweet — not a true carousel UX, but it is the
      // closest surface, and the distributor needs a real upper bound.
      supportsSlideshow: true,
      slideshowImageRange: [2, 4],
      supportsVideo: true,
      supportsPost: true,
      allowsTextOnlyPost: true,
      supportsMentions: MENTION_CAPABLE_TIERS.has(
        this.config.get<string>('platforms.twitter.apiTier') ?? 'free',
      ),
      supportsReplies: true,
      maxTextLength: 280,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  getOAuthUrl(request: OAuthAuthorizeRequest): string {
    if (!this.isConfigured()) throw this.notConfigured();

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId as string);
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection> {
    if (!this.isConfigured()) throw this.notConfigured();

    const token = await this.postToken({
      code: request.code,
      grant_type: 'authorization_code',
      client_id: this.clientId as string,
      redirect_uri: request.redirectUri,
      code_verifier: request.codeVerifier,
    });

    const identity = await this.fetchIdentity(token.access_token as string);

    return { ...this.toCredentials(token), ...identity };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    if (!this.isConfigured()) throw this.notConfigured();

    return this.toCredentials(
      await this.postToken(
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId as string,
        },
        'token refresh',
      ),
    );
  }

  private async postToken(
    body: Record<string, string>,
    stage = 'token exchange',
  ): Promise<TwitterTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<TwitterTokenResponse>(TOKEN_URL, new URLSearchParams(body).toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // X requires HTTP Basic for confidential clients even though the
            // client_id is also in the body.
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`,
            ).toString('base64')}`,
          },
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
        this.http.get<TwitterMeResponse>(ME_URL, {
          params: { 'user.fields': 'profile_image_url' },
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const user = response.data?.data;
      return {
        accountId: user?.id ?? '',
        displayName: user?.username ? `@${user.username}` : (user?.name ?? 'X account'),
        avatarUrl: user?.profile_image_url ?? null,
      };
    } catch (error) {
      throw this.exchangeFailure(error, 'profile lookup');
    }
  }

  private toCredentials(token: TwitterTokenResponse): PlatformCredentials {
    return {
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : SCOPES,
    };
  }

  private get clientId(): string | undefined {
    return this.config.get<string>('platforms.twitter.clientId');
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('platforms.twitter.clientSecret');
  }
}

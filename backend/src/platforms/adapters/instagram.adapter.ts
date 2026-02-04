import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ApiException } from '../../common/errors/api.exception';
import { BasePlatformAdapter } from '../base-platform.adapter';
import type {
  OAuthAuthorizeRequest,
  OAuthExchangeRequest,
  PlatformCapabilities,
  PlatformConnection,
  PlatformCredentials,
} from '../platform-adapter.interface';

/** Pinned deliberately: Meta deprecates versions on a schedule, and a silent
 * float to "latest" would change response shapes under us. */
const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_read_engagement',
];

interface MetaTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface MetaAccountsResponse {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    };
  }>;
}

/**
 * Section 6. Instagram publishing runs through the Facebook Graph API and needs
 * an IG Business/Creator account linked to a Page the user administers.
 *
 * Token model, which is why `refreshToken` is not a refresh token here: Meta
 * issues no refresh tokens. The flow exchanges the short-lived user token for a
 * long-lived one (~60 days), then derives a Page token from it. The Page token
 * is what publishes, so it is stored as `accessToken`; the long-lived user
 * token is stored in `refreshToken` because re-deriving a Page token is exactly
 * what "refresh" means for this platform.
 */
@Injectable()
export class InstagramAdapter extends BasePlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    platform: 'instagram',
    // Meta's OAuth dialog does not implement PKCE; state carries the binding.
    usesPkce: false,
    supportsSlideshow: true,
    slideshowImageRange: [2, 10],
    supportsVideo: true,
    supportsPost: true,
    // Every IG publish needs media — there is no text-only post.
    allowsTextOnlyPost: false,
    supportsMentions: true,
    supportsReplies: true,
    maxTextLength: 2200,
  };

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  getOAuthUrl(request: OAuthAuthorizeRequest): string {
    if (!this.isConfigured()) throw this.notConfigured();

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', this.appId as string);
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('state', request.state);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    return url.toString();
  }

  async handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection> {
    if (!this.isConfigured()) throw this.notConfigured();

    const shortLived = await this.getToken(
      {
        client_id: this.appId as string,
        client_secret: this.appSecret as string,
        redirect_uri: request.redirectUri,
        code: request.code,
      },
      'token exchange',
    );

    const longLived = await this.exchangeForLongLived(shortLived.access_token as string);
    const page = await this.findInstagramPage(longLived.access_token as string);

    return {
      accessToken: page.pageAccessToken,
      refreshToken: longLived.access_token as string,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : null,
      scopes: SCOPES,
      accountId: page.instagramAccountId,
      displayName: page.displayName,
      avatarUrl: page.avatarUrl,
    };
  }

  /**
   * "Refresh" for Meta is re-running the long-lived exchange and re-deriving
   * the Page token, so the stored long-lived user token is the input.
   */
  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    if (!this.isConfigured()) throw this.notConfigured();

    const longLived = await this.exchangeForLongLived(refreshToken, 'token refresh');
    const page = await this.findInstagramPage(longLived.access_token as string, 'token refresh');

    return {
      accessToken: page.pageAccessToken,
      refreshToken: longLived.access_token as string,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000)
        : null,
      scopes: SCOPES,
    };
  }

  private async exchangeForLongLived(
    token: string,
    stage = 'token exchange',
  ): Promise<MetaTokenResponse> {
    return this.getToken(
      {
        grant_type: 'fb_exchange_token',
        client_id: this.appId as string,
        client_secret: this.appSecret as string,
        fb_exchange_token: token,
      },
      stage,
    );
  }

  private async getToken(
    params: Record<string, string>,
    stage: string,
  ): Promise<MetaTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.get<MetaTokenResponse>(`${GRAPH_URL}/oauth/access_token`, { params }),
      );

      if (!response.data?.access_token) {
        throw new Error('response carried no access_token');
      }

      return response.data;
    } catch (error) {
      throw this.exchangeFailure(error, stage);
    }
  }

  private async findInstagramPage(userAccessToken: string, stage = 'token exchange') {
    let response;

    try {
      response = await firstValueFrom(
        this.http.get<MetaAccountsResponse>(`${GRAPH_URL}/me/accounts`, {
          params: {
            fields:
              'name,access_token,instagram_business_account{id,username,name,profile_picture_url}',
            access_token: userAccessToken,
          },
        }),
      );
    } catch (error) {
      throw this.exchangeFailure(error, stage);
    }

    const page = response.data?.data?.find(
      (candidate) => candidate.instagram_business_account?.id && candidate.access_token,
    );

    // A real and common setup mistake, not a platform fault: the user granted
    // everything but has no IG Business account linked to any Page they admin.
    // Told apart from a failed exchange so the dashboard can explain the fix.
    if (!page) {
      throw ApiException.unprocessable(
        'INSTAGRAM_BUSINESS_ACCOUNT_REQUIRED',
        'No Instagram Business or Creator account is linked to a Facebook Page you manage',
        { platform: 'instagram' },
      );
    }

    const ig = page.instagram_business_account as NonNullable<
      NonNullable<MetaAccountsResponse['data']>[number]['instagram_business_account']
    >;

    return {
      pageAccessToken: page.access_token as string,
      instagramAccountId: ig.id as string,
      displayName: ig.username || ig.name || page.name || 'Instagram account',
      avatarUrl: ig.profile_picture_url ?? null,
    };
  }

  private get appId(): string | undefined {
    return this.config.get<string>('platforms.meta.appId');
  }

  private get appSecret(): string | undefined {
    return this.config.get<string>('platforms.meta.appSecret');
  }
}

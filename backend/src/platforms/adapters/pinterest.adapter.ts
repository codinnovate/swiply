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
  SourcePostInput,
} from '../platform-adapter.interface';

const AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const API_BASE = 'https://api.pinterest.com/v5';
const SCOPES = ['user_accounts:read', 'boards:read', 'pins:read'];
const BOARD_PAGE_SIZE = 25;
const PIN_PAGE_SIZE = 25;
export const PINTEREST_IMPORT_LIMIT = 40;

interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface PinterestUserResponse {
  username?: string;
  id?: string;
  profile_image?: string;
}

export interface PinterestBoard {
  id: string;
  name: string;
  pinCount: number;
  coverUrl: string | null;
}

export interface PinterestBoardPin {
  pinId: string;
  title: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

interface PinterestBoardRow {
  id?: string;
  name?: string;
  pin_count?: number;
  media?: { image_cover_url?: string };
}

interface PinterestPinRow {
  id?: string;
  title?: string;
  description?: string;
  created_at?: string;
  media?: {
    media_type?: string;
    images?: Record<string, { url?: string; width?: number; height?: number }>;
  };
}

@Injectable()
export class PinterestAdapter extends BasePlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    platform: 'pinterest',
    usesPkce: true,
    supportsSlideshow: true,
    slideshowImageRange: [2, 5],
    supportsVideo: true,
    supportsPost: true,
    allowsTextOnlyPost: false,
    supportsMentions: false,
    supportsReplies: false,
    maxTextLength: 500,
  };

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  getOAuthUrl(request: OAuthAuthorizeRequest): string {
    if (!this.isConfigured()) throw this.notConfigured();

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', this.clientId as string);
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async handleOAuthCallback(request: OAuthExchangeRequest): Promise<PlatformConnection> {
    if (!this.isConfigured()) throw this.notConfigured();

    const token = await this.postToken({
      grant_type: 'authorization_code',
      code: request.code,
      redirect_uri: request.redirectUri,
      code_verifier: request.codeVerifier,
    });
    const identity = await this.fetchIdentity(token.access_token as string);

    return {
      ...this.toCredentials(token),
      accountId: identity.accountId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    if (!this.isConfigured()) throw this.notConfigured();

    return this.toCredentials(
      await this.postToken(
        { grant_type: 'refresh_token', refresh_token: refreshToken },
        'token refresh',
      ),
    );
  }

  async fetchRecentPosts(accessToken: string, limit: number): Promise<SourcePostInput[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ items?: PinterestPinRow[] }>(`${API_BASE}/pins`, {
          params: { page_size: Math.min(limit, PIN_PAGE_SIZE) },
          headers: this.auth(accessToken),
        }),
      );
      return (response.data.items ?? []).flatMap((pin) =>
        pin.id
          ? [
              {
                platformPostId: pin.id,
                text: pin.title || pin.description || '',
                postedAt: pin.created_at ? new Date(pin.created_at) : new Date(),
                engagementScore: null,
              },
            ]
          : [],
      );
    } catch (error) {
      throw this.exchangeFailure(error, 'recent posts lookup');
    }
  }

  async listBoards(accessToken: string): Promise<PinterestBoard[]> {
    const boards: PinterestBoard[] = [];
    let bookmark: string | undefined;
    do {
      const page = await this.getPage<{ items?: PinterestBoardRow[]; bookmark?: string }>(
        `${API_BASE}/boards`,
        accessToken,
        { page_size: BOARD_PAGE_SIZE, ...(bookmark ? { bookmark } : {}) },
        'boards lookup',
      );
      for (const board of page.items ?? []) {
        if (!board.id || !board.name) continue;
        boards.push({
          id: board.id,
          name: board.name,
          pinCount: board.pin_count ?? 0,
          coverUrl: board.media?.image_cover_url ?? null,
        });
      }
      bookmark = page.bookmark;
    } while (bookmark && boards.length < 100);
    return boards;
  }

  async listBoardImagePins(
    accessToken: string,
    boardId: string,
    limit = PINTEREST_IMPORT_LIMIT,
  ): Promise<PinterestBoardPin[]> {
    const pins: PinterestBoardPin[] = [];
    let bookmark: string | undefined;
    do {
      const page = await this.getPage<{ items?: PinterestPinRow[]; bookmark?: string }>(
        `${API_BASE}/boards/${encodeURIComponent(boardId)}/pins`,
        accessToken,
        { page_size: PIN_PAGE_SIZE, ...(bookmark ? { bookmark } : {}) },
        'board pins lookup',
      );
      for (const pin of page.items ?? []) {
        const image = this.bestImage(pin);
        if (!pin.id || !image?.url) continue;
        pins.push({
          pinId: pin.id,
          title: pin.title || pin.description || `Pinterest pin ${pin.id}`,
          imageUrl: image.url,
          width: image.width ?? null,
          height: image.height ?? null,
        });
        if (pins.length >= limit) return pins;
      }
      bookmark = page.bookmark;
    } while (bookmark);
    return pins;
  }

  bestImage(pin: PinterestPinRow): { url: string; width?: number; height?: number } | null {
    const images = pin.media?.images ?? {};
    const preferred = images.originals ?? images.original ?? images['1200x'] ?? images['600x'];
    if (preferred?.url) return { url: preferred.url, width: preferred.width, height: preferred.height };
    const first = Object.values(images).find((image) => image?.url);
    return first?.url ? { url: first.url, width: first.width, height: first.height } : null;
  }

  private async postToken(
    body: Record<string, string>,
    stage = 'token exchange',
  ): Promise<PinterestTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<PinterestTokenResponse>(TOKEN_URL, new URLSearchParams(body).toString(), {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
      if (!response.data?.access_token) throw new Error('response carried no access_token');
      return response.data;
    } catch (error) {
      throw this.exchangeFailure(error, stage);
    }
  }

  private async fetchIdentity(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.http.get<PinterestUserResponse>(`${API_BASE}/user_account`, {
          headers: this.auth(accessToken),
        }),
      );
      const user = response.data;
      return {
        accountId: user?.id || user?.username || '',
        displayName: user?.username || 'Pinterest account',
        avatarUrl: user?.profile_image ?? null,
      };
    } catch (error) {
      throw this.exchangeFailure(error, 'profile lookup');
    }
  }

  private async getPage<T>(
    url: string,
    accessToken: string,
    params: Record<string, string | number>,
    stage: string,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, { params, headers: this.auth(accessToken) }),
      );
      return response.data;
    } catch (error) {
      throw this.exchangeFailure(error, stage);
    }
  }

  private toCredentials(token: PinterestTokenResponse): PlatformCredentials {
    return {
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope ? token.scope.split(/[,\s]+/).filter(Boolean) : SCOPES,
    };
  }

  private auth(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
  }

  private get clientId(): string | undefined {
    return this.config.get<string>('platforms.pinterest.appId');
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('platforms.pinterest.appSecret');
  }
}

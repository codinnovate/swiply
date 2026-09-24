import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { ApiException } from '../../../common/errors/api.exception';
import type { XPost, XPostProvider, XProfile } from '../domain/x-post-provider.interface';

interface FxTwitterProfileResponse {
  code: number;
  message?: string;
  user?: {
    id?: string;
    screen_name?: string;
    name?: string;
    avatar_url?: string;
    protected?: boolean;
    verification?: {
      verified?: boolean;
      type?: 'individual' | 'organization' | 'government' | null;
    };
  };
}

interface FxTwitterTimelineResponse {
  code: number;
  results?: Array<{
    id: string;
    created_timestamp: number;
    replying_to?: object | null;
    quote?: object | null;
    reposted_by?: object | null;
  }>;
}

/** Public, read-only X profile lookup. No user or developer OAuth is involved. */
@Injectable()
export class FxTwitterXPostProvider implements XPostProvider {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getProfile(username: string): Promise<XProfile> {
    const baseUrl = this.config.get<string>(
      'postingConsistency.providerBaseUrl',
      'https://api.fxtwitter.com',
    );
    const timeout = this.config.get<number>('postingConsistency.providerTimeoutMs', 8_000);
    const url = new URL(`/2/profile/${encodeURIComponent(username)}`, baseUrl).toString();

    try {
      const response = await firstValueFrom(
        this.http.get<FxTwitterProfileResponse>(url, {
          timeout,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'POSTLOCK/1.0 profile-verification',
          },
        }),
      );
      const user = response.data.user;
      if (
        response.data.code !== 200 ||
        !user?.id ||
        !user.screen_name ||
        !user.name
      ) {
        throw ApiException.notFound('X profile', { username });
      }

      return {
        providerUserId: user.id,
        username: user.screen_name.toLowerCase(),
        displayName: user.name,
        avatarUrl: user.avatar_url ? this.highResolutionAvatar(user.avatar_url) : undefined,
        isPublic: user.protected !== true,
        isVerified: user.verification?.verified === true,
        verificationType: user.verification?.type ?? undefined,
      };
    } catch (error) {
      if (error instanceof ApiException) throw error;
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw ApiException.notFound('X profile', { username });
      }
      throw ApiException.unprocessable(
        'X_PROFILE_PROVIDER_FAILED',
        'We could not check that X profile right now. Please try again.',
      );
    }
  }

  async listPostsSince(username: string, since: Date): Promise<XPost[]> {
    const baseUrl = this.config.get<string>(
      'postingConsistency.providerBaseUrl',
      'https://api.fxtwitter.com',
    );
    const timeout = this.config.get<number>('postingConsistency.providerTimeoutMs', 8_000);
    const url = new URL(`/2/profile/${encodeURIComponent(username)}/statuses`, baseUrl);
    url.searchParams.set('count', '100');
    url.searchParams.set('with_replies', 'true');
    url.searchParams.set('since', String(Math.floor(since.getTime() / 1000)));

    try {
      const response = await firstValueFrom(
        this.http.get<FxTwitterTimelineResponse>(url.toString(), {
          timeout,
          headers: { Accept: 'application/json', 'User-Agent': 'POSTLOCK/1.0 post-verification' },
        }),
      );
      if (response.status === 204) return [];
      const unique = new Map<string, XPost>();
      for (const post of response.data.results ?? []) {
        const kind: XPost['kind'] = post.reposted_by
          ? 'repost'
          : post.replying_to
            ? 'reply'
            : post.quote
              ? 'quote'
              : 'original';
        unique.set(post.id, {
          id: post.id,
          createdAt: new Date(post.created_timestamp * 1000),
          kind,
        });
      }
      return [...unique.values()].filter((post) => post.createdAt >= since);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 204) return [];
      throw ApiException.unprocessable(
        'X_PROFILE_PROVIDER_FAILED',
        'We could not check public X posts right now. Please try again.',
      );
    }
  }

  private highResolutionAvatar(url: string): string {
    return url.replace(/_normal(?=\.[a-zA-Z]+(?:\?|$))/, '_400x400');
  }
}

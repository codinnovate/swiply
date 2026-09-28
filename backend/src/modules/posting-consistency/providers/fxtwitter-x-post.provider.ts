import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { ApiException } from '../../../common/errors/api.exception';
import type {
  XPost,
  XPostDetail,
  XPostProvider,
  XProfile,
} from '../domain/x-post-provider.interface';

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

interface FxTwitterFacet {
  type: string;
  replacement?: string;
}

interface FxTwitterStatus {
  id: string;
  url?: string;
  text?: string;
  created_timestamp: number;
  author?: { screen_name?: string };
  replying_to?: { screen_name?: string; status?: string } | null;
  quote?: { text?: string; author?: { screen_name?: string } } | null;
  reposted_by?: { screen_name?: string } | null;
  raw_text?: { facets?: FxTwitterFacet[] };
  media?: { all?: Array<{ type?: string }> };
  likes?: number;
  reposts?: number;
  replies?: number;
  quotes?: number;
  bookmarks?: number;
  views?: number | null;
}

interface FxTwitterTimelineResponse {
  code: number;
  results?: FxTwitterStatus[];
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
      if (response.data.code !== 200 || !user?.id || !user.screen_name || !user.name) {
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
    const posts = await this.fetchTimeline(username, since);
    return posts
      .filter((post) => post.createdAt >= since)
      .map(({ id, createdAt, kind }) => ({ id, createdAt, kind }));
  }

  listRecentPosts(username: string): Promise<XPostDetail[]> {
    return this.fetchTimeline(username);
  }

  /**
   * With replies enabled the timeline interleaves other people's posts from the
   * same conversations, so only posts owned by `username` are kept — authored
   * by them, or reposted by them.
   */
  private async fetchTimeline(username: string, since?: Date): Promise<XPostDetail[]> {
    const baseUrl = this.config.get<string>(
      'postingConsistency.providerBaseUrl',
      'https://api.fxtwitter.com',
    );
    const timeout = this.config.get<number>('postingConsistency.providerTimeoutMs', 8_000);
    const url = new URL(`/2/profile/${encodeURIComponent(username)}/statuses`, baseUrl);
    url.searchParams.set('count', '100');
    url.searchParams.set('with_replies', 'true');
    if (since) url.searchParams.set('since', String(Math.floor(since.getTime() / 1000)));

    try {
      const response = await firstValueFrom(
        this.http.get<FxTwitterTimelineResponse>(url.toString(), {
          timeout,
          headers: { Accept: 'application/json', 'User-Agent': 'POSTLOCK/1.0 post-verification' },
        }),
      );
      if (response.status === 204) return [];
      const owner = username.toLowerCase();
      const unique = new Map<string, XPostDetail>();
      for (const post of response.data.results ?? []) {
        const postOwner = (
          post.reposted_by?.screen_name ?? post.author?.screen_name
        )?.toLowerCase();
        if (postOwner !== owner) continue;
        unique.set(post.id, this.toDetail(post, owner));
      }
      return [...unique.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 204) return [];
      throw ApiException.unprocessable(
        'X_PROFILE_PROVIDER_FAILED',
        'We could not check public X posts right now. Please try again.',
      );
    }
  }

  private toDetail(post: FxTwitterStatus, owner: string): XPostDetail {
    const kind: XPost['kind'] = post.reposted_by
      ? 'repost'
      : post.replying_to
        ? 'reply'
        : post.quote
          ? 'quote'
          : 'original';
    const facets = post.raw_text?.facets ?? [];
    const mediaTypes = new Set((post.media?.all ?? []).map((item) => item.type));
    const mediaType: XPostDetail['mediaType'] = mediaTypes.has('video')
      ? 'video'
      : mediaTypes.has('gif')
        ? 'gif'
        : mediaTypes.has('photo')
          ? 'image'
          : 'none';
    return {
      id: post.id,
      url: post.url ?? `https://x.com/${owner}/status/${post.id}`,
      authorUsername: (post.author?.screen_name ?? owner).toLowerCase(),
      text: post.text ?? '',
      createdAt: new Date(post.created_timestamp * 1000),
      kind,
      replyToUsername: post.replying_to?.screen_name?.toLowerCase(),
      replyToPostId: post.replying_to?.status,
      quoted:
        kind === 'quote' && post.quote?.text
          ? {
              username: (post.quote.author?.screen_name ?? '').toLowerCase(),
              text: post.quote.text,
            }
          : undefined,
      mediaType,
      // Links to other X posts are quotes, not off-platform links.
      hasExternalLink: facets.some(
        (facet) =>
          facet.type === 'url' &&
          !/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(facet.replacement ?? ''),
      ),
      hashtagCount: facets.filter((facet) => facet.type === 'hashtag').length,
      engagement: {
        likes: post.likes ?? 0,
        reposts: post.reposts ?? 0,
        replies: post.replies ?? 0,
        quotes: post.quotes ?? 0,
        bookmarks: post.bookmarks ?? 0,
        views: post.views ?? null,
      },
    };
  }

  private highResolutionAvatar(url: string): string {
    return url.replace(/_normal(?=\.[a-zA-Z]+(?:\?|$))/, '_400x400');
  }
}

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
  cursor?: { top?: string; bottom?: string };
}

/** Hard ceiling on timeline pages per call, whatever the caller asks for. */
const MAX_TIMELINE_PAGES = 20;

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

  listRecentPosts(username: string, options?: { pages?: number }): Promise<XPostDetail[]> {
    return this.fetchTimeline(username, undefined, options?.pages);
  }

  /**
   * With replies enabled the timeline interleaves other people's posts from the
   * same conversations, so only posts owned by `username` are kept — authored
   * by them, or reposted by them.
   *
   * Later pages follow the `bottom` cursor. FxTwitter's pages overlap and
   * aren't strictly ordered, so posts are de-duplicated by id and paging stops
   * at the first page that is empty, has no cursor, or adds nothing new.
   *
   * The other people's posts are still read for one thing: what they were
   * replying to, which becomes `parentReplyTo` on the owner's answer.
   */
  private async fetchTimeline(username: string, since?: Date, pages = 1): Promise<XPostDetail[]> {
    const owner = username.toLowerCase();
    const unique = new Map<string, XPostDetail>();
    const seen = new Map<string, FxTwitterStatus>();
    let cursor: string | undefined;
    for (let page = 0; page < Math.min(Math.max(pages, 1), MAX_TIMELINE_PAGES); page += 1) {
      let response: FxTwitterTimelineResponse | null;
      try {
        response = await this.fetchTimelinePage(username, since, cursor);
      } catch (error) {
        // A failed deeper page keeps what earlier pages already returned.
        if (page === 0) throw error;
        break;
      }
      const before = unique.size;
      for (const post of response?.results ?? []) {
        seen.set(post.id, post);
        const postOwner = (
          post.reposted_by?.screen_name ?? post.author?.screen_name
        )?.toLowerCase();
        if (postOwner !== owner) continue;
        unique.set(post.id, this.toDetail(post, owner));
      }
      const next = response?.cursor?.bottom;
      if (unique.size === before || !next || next === cursor) break;
      cursor = next;
    }
    return [...unique.values()]
      .map((post) => {
        const parent = post.replyToPostId ? seen.get(post.replyToPostId) : undefined;
        const answering = parent?.replying_to;
        return answering?.screen_name
          ? {
              ...post,
              parentReplyTo: {
                username: answering.screen_name.toLowerCase(),
                postId: answering.status,
              },
            }
          : post;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async fetchTimelinePage(
    username: string,
    since: Date | undefined,
    cursor: string | undefined,
  ): Promise<FxTwitterTimelineResponse | null> {
    const baseUrl = this.config.get<string>(
      'postingConsistency.providerBaseUrl',
      'https://api.fxtwitter.com',
    );
    const timeout = this.config.get<number>('postingConsistency.providerTimeoutMs', 8_000);
    const url = new URL(`/2/profile/${encodeURIComponent(username)}/statuses`, baseUrl);
    url.searchParams.set('count', '100');
    url.searchParams.set('with_replies', 'true');
    if (since) url.searchParams.set('since', String(Math.floor(since.getTime() / 1000)));
    if (cursor) url.searchParams.set('cursor', cursor);

    try {
      const response = await firstValueFrom(
        this.http.get<FxTwitterTimelineResponse>(url.toString(), {
          timeout,
          headers: { Accept: 'application/json', 'User-Agent': 'POSTLOCK/1.0 post-verification' },
        }),
      );
      return response.status === 204 ? null : response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 204) return null;
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

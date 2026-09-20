import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ApiException } from '../../common/errors/api.exception';
import type { ErrorCodeValue } from '../../common/errors/error-codes';
import type { PublishingProvider } from './schemas/publishing-provider-connection.schema';

export interface DiscoveredOrganization {
  id: string;
  name: string;
}
export interface DiscoveredChannel {
  id: string;
  name: string;
  avatarUrl: string | null;
  platform: string;
  providerType: string;
  disabled: boolean;
}
export interface DiscoveryResult {
  organizations: DiscoveredOrganization[];
  channels: DiscoveredChannel[];
}
export interface GatewayConnection {
  provider: PublishingProvider;
  apiKey: string;
  baseUrl: string | null;
  organizationId: string | null;
}
export interface GatewayPost {
  channelId: string;
  providerType: string;
  text: string;
  imageUrls: string[];
  videoUrl?: string | null;
  scheduledFor: Date;
  defaults: Record<string, unknown>;
  publishNow?: boolean;
}

export interface GatewayPostStatus {
  status: string;
  url: string | null;
  platformPostId: string | null;
  publishedAt: Date | null;
  failureReason: string | null;
}

const SUPPORTED = new Map([
  ['twitter', 'twitter'],
  ['x', 'twitter'],
  ['instagram', 'instagram'],
  ['instagram-standalone', 'instagram'],
  ['facebook', 'facebook'],
  ['pinterest', 'pinterest'],
  ['linkedin', 'linkedin'],
  ['linkedin-page', 'linkedin'],
  ['tiktok', 'tiktok'],
]);

@Injectable()
export class PublishingProviderGateway {
  async assertSafePostizOrigin(input?: string): Promise<string> {
    const raw = input || 'https://api.postiz.com';
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw this.invalid('PUBLISHING_PROVIDER_URL_UNSAFE', 'Enter a valid Postiz HTTPS origin');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw this.invalid(
        'PUBLISHING_PROVIDER_URL_UNSAFE',
        'Postiz must be a public HTTPS origin without a path, query, or credentials',
      );
    }
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (!addresses.length || addresses.some(({ address }) => this.isPrivateAddress(address))) {
      throw this.invalid(
        'PUBLISHING_PROVIDER_URL_UNSAFE',
        'Postiz must resolve only to public network addresses',
      );
    }
    return url.origin;
  }

  async discover(
    provider: PublishingProvider,
    apiKey: string,
    baseUrl?: string,
    organizationId?: string,
  ): Promise<DiscoveryResult> {
    return provider === 'buffer'
      ? this.discoverBuffer(apiKey, organizationId)
      : this.discoverPostiz(apiKey, await this.assertSafePostizOrigin(baseUrl));
  }

  async createPost(
    connection: GatewayConnection,
    post: GatewayPost,
  ): Promise<{ id: string; url: string | null; status: string }> {
    return connection.provider === 'buffer'
      ? this.createBufferPost(connection, post)
      : this.createPostizPost(connection, post);
  }

  async deletePost(connection: GatewayConnection, id: string): Promise<void> {
    if (connection.provider === 'buffer') {
      await this.bufferGraphql(
        connection.apiKey,
        'mutation DeletePost($input: DeletePostInput!) { deletePost(input: $input) { ... on DeletePostSuccess { id } ... on VoidMutationError { message } } }',
        { input: { id } },
      );
      return;
    }
    const response = await this.request(
      `${await this.assertSafePostizOrigin(connection.baseUrl || undefined)}/public/v1/posts/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { Authorization: connection.apiKey } },
    );
    if (!response.ok) throw this.providerFailure('postiz', response.status);
  }

  async getPostStatus(
    connection: GatewayConnection,
    id: string,
    scheduledFor: Date,
  ): Promise<GatewayPostStatus | null> {
    return connection.provider === 'buffer'
      ? this.getBufferPostStatus(connection, id)
      : this.getPostizPostStatus(connection, id, scheduledFor);
  }

  private async discoverBuffer(apiKey: string, organizationId?: string): Promise<DiscoveryResult> {
    const orgData = await this.bufferGraphql(
      apiKey,
      'query Organizations { account { organizations { id name } } }',
      {},
    );
    const organizations =
      (orgData.account as { organizations?: DiscoveredOrganization[] })?.organizations || [];
    if (!organizationId) return { organizations, channels: [] };
    if (!organizations.some((item) => item.id === organizationId))
      throw this.invalid(
        'PUBLISHING_PROVIDER_ORGANIZATION_REQUIRED',
        'Choose an organization available to this Buffer key',
      );
    const channelData = await this.bufferGraphql(
      apiKey,
      'query Channels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar isDisconnected isLocked } }',
      { organizationId },
    );
    const channels = ((channelData.channels as Array<Record<string, unknown>>) || []).flatMap(
      (item) => {
        const providerType = String(item.service || '');
        const platform = SUPPORTED.get(providerType);
        return platform
          ? [
              {
                id: String(item.id),
                name: String(item.displayName || item.name || platform),
                avatarUrl: item.avatar ? String(item.avatar) : null,
                platform,
                providerType,
                disabled: Boolean(item.isDisconnected || item.isLocked),
              },
            ]
          : [];
      },
    );
    return { organizations, channels };
  }

  private async discoverPostiz(apiKey: string, origin: string): Promise<DiscoveryResult> {
    const response = await this.request(`${origin}/public/v1/integrations`, {
      headers: { Authorization: apiKey },
    });
    if (!response.ok) throw this.providerFailure('postiz', response.status, true);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    return {
      organizations: [],
      channels: body.flatMap((item) => {
        const providerType = String(item.identifier || '');
        const platform = SUPPORTED.get(providerType);
        return platform
          ? [
              {
                id: String(item.id),
                name: String(item.name || item.profile || platform),
                avatarUrl: item.picture ? String(item.picture) : null,
                platform,
                providerType,
                disabled: Boolean(item.disabled),
              },
            ]
          : [];
      }),
    };
  }

  private async createBufferPost(connection: GatewayConnection, post: GatewayPost) {
    const assets = post.videoUrl
      ? [{ video: { url: post.videoUrl, metadata: { thumbnailOffset: 0 } } }]
      : post.imageUrls.map((url) => ({ image: { url } }));
    const input = {
      text: post.text,
      channelId: post.channelId,
      schedulingType: 'automatic',
      mode: post.publishNow ? 'shareNow' : 'customScheduled',
      ...(post.publishNow ? {} : { dueAt: post.scheduledFor.toISOString() }),
      assets,
      needsApproval: false,
      saveToDraft: false,
      aiAssisted: false,
    };
    const data = await this.bufferGraphql(
      connection.apiKey,
      'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status } } ... on MutationError { message } } }',
      { input },
    );
    const payload = data.createPost as { post?: { id: string; status?: string }; message?: string };
    if (!payload?.post)
      throw this.invalid(
        'PUBLISHING_PROVIDER_REQUEST_FAILED',
        payload?.message || 'Buffer rejected the post',
      );
    return { id: payload.post.id, url: null, status: payload.post.status || 'scheduled' };
  }

  private async getBufferPostStatus(
    connection: GatewayConnection,
    id: string,
  ): Promise<GatewayPostStatus> {
    const data = await this.bufferGraphql(
      connection.apiKey,
      'query Post($input: PostInput!) { post(input: $input) { id status externalLink sentAt error { message } } }',
      { input: { id } },
    );
    const post = data.post as {
      status: string;
      externalLink?: string | null;
      sentAt?: string | null;
      error?: { message?: string } | null;
    };
    return {
      status: post.status,
      url: post.externalLink || null,
      platformPostId: null,
      publishedAt: this.optionalDate(post.sentAt),
      failureReason: post.error?.message || null,
    };
  }

  private async createPostizPost(connection: GatewayConnection, post: GatewayPost) {
    const origin = await this.assertSafePostizOrigin(connection.baseUrl || undefined);
    const media = [] as Array<{ id: string; path: string }>;
    for (const url of [...post.imageUrls, ...(post.videoUrl ? [post.videoUrl] : [])]) {
      const uploaded = await this.request(`${origin}/public/v1/upload-from-url`, {
        method: 'POST',
        headers: { Authorization: connection.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!uploaded.ok) throw this.providerFailure('postiz', uploaded.status);
      const item = (await uploaded.json()) as { id: string; path: string };
      media.push({ id: item.id, path: item.path });
    }
    const response = await this.request(`${origin}/public/v1/posts`, {
      method: 'POST',
      headers: { Authorization: connection.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: post.publishNow ? 'now' : 'schedule',
        date: post.scheduledFor.toISOString(),
        shortLink: false,
        tags: [],
        posts: [
          {
            integration: { id: post.channelId },
            value: [{ content: post.text, image: media }],
            settings: { __type: post.providerType, ...post.defaults },
          },
        ],
      }),
    });
    if (!response.ok) throw this.providerFailure('postiz', response.status);
    const result = (await response.json()) as Array<{ postId: string }>;
    if (!result[0]?.postId)
      throw this.invalid(
        'PUBLISHING_PROVIDER_REQUEST_FAILED',
        'Postiz returned no post identifier',
      );
    return {
      id: result[0].postId,
      url: null,
      status: post.publishNow ? 'processing' : 'scheduled',
    };
  }

  private async getPostizPostStatus(
    connection: GatewayConnection,
    id: string,
    scheduledFor: Date,
  ): Promise<GatewayPostStatus | null> {
    const origin = await this.assertSafePostizOrigin(connection.baseUrl || undefined);
    const windowMilliseconds = 36 * 60 * 60 * 1000;
    const params = new URLSearchParams({
      startDate: new Date(scheduledFor.getTime() - windowMilliseconds).toISOString(),
      endDate: new Date(scheduledFor.getTime() + windowMilliseconds).toISOString(),
    });
    const response = await this.request(`${origin}/public/v1/posts?${params.toString()}`, {
      headers: { Authorization: connection.apiKey },
    });
    if (!response.ok) throw this.providerFailure('postiz', response.status);
    const body = (await response.json()) as
      { posts?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const posts = Array.isArray(body) ? body : body.posts || [];
    const post = posts.find((item) => String(item.id) === id);
    if (!post) return null;
    const error = post.error;
    return {
      status: String(post.state || post.status || 'unknown'),
      url: post.releaseURL ? String(post.releaseURL) : null,
      platformPostId: post.releaseId ? String(post.releaseId) : null,
      publishedAt: this.optionalDate(post.publishDate),
      failureReason:
        typeof error === 'string'
          ? error
          : error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : null,
    };
  }

  private async bufferGraphql(
    apiKey: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.request('https://api.buffer.com', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw this.providerFailure('buffer', response.status, true);
    const body = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: string }>;
    };
    if (body.errors?.length || !body.data)
      throw this.invalid(
        'PUBLISHING_PROVIDER_REQUEST_FAILED',
        body.errors?.[0]?.message || 'Buffer rejected the request',
      );
    return body.data;
  }

  private request(url: string, init: RequestInit) {
    return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) }).catch(
      () => {
        throw this.invalid(
          'PUBLISHING_PROVIDER_REQUEST_FAILED',
          'The publishing provider did not respond',
        );
      },
    );
  }
  private providerFailure(provider: string, status: number, validating = false) {
    return this.invalid(
      status === 429
        ? 'PUBLISHING_PROVIDER_RATE_LIMITED'
        : validating && [401, 403].includes(status)
          ? 'PUBLISHING_PROVIDER_CREDENTIAL_INVALID'
          : 'PUBLISHING_PROVIDER_REQUEST_FAILED',
      status === 429 ? `${provider} rate limit reached` : `${provider} rejected the request`,
    );
  }
  private invalid(code: ErrorCodeValue, message: string) {
    return ApiException.unprocessable(code, message);
  }
  private optionalDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      const [a, b] = address.split('.').map(Number);
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19))
      );
    }
    const value = address.toLowerCase();
    const mappedIpv4 = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4) return this.isPrivateAddress(mappedIpv4);
    return (
      value === '::1' ||
      value === '::' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe8') ||
      value.startsWith('fe9') ||
      value.startsWith('fea') ||
      value.startsWith('feb') ||
      value.startsWith('ff')
    );
  }
}

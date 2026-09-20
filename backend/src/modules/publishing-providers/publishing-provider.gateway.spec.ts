import { ApiException } from '../../common/errors/api.exception';
import { PublishingProviderGateway } from './publishing-provider.gateway';

describe('PublishingProviderGateway', () => {
  const originalFetch = global.fetch;
  let gateway: PublishingProviderGateway;

  beforeEach(() => {
    gateway = new PublishingProviderGateway();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('discovers and normalizes only supported Buffer channels', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { account: { organizations: [{ id: 'org-1', name: 'Studio' }] } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              channels: [
                {
                  id: 'x-1',
                  displayName: '@studio',
                  service: 'twitter',
                  avatar: 'https://cdn.example/x.png',
                  isDisconnected: false,
                  isLocked: false,
                },
                {
                  id: 'b-1',
                  displayName: 'Blue',
                  service: 'bluesky',
                  avatar: '',
                  isDisconnected: false,
                  isLocked: false,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const result = await gateway.discover('buffer', 'buffer-key', undefined, 'org-1');
    expect(result.organizations).toEqual([{ id: 'org-1', name: 'Studio' }]);
    expect(result.channels).toEqual([
      {
        id: 'x-1',
        name: '@studio',
        avatarUrl: 'https://cdn.example/x.png',
        platform: 'twitter',
        providerType: 'twitter',
        disabled: false,
      },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.buffer.com',
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('treats Buffer GraphQL errors as failures even with HTTP 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'Not authorized' }] }), { status: 200 }),
    );
    await expect(gateway.discover('buffer', 'bad-key')).rejects.toMatchObject({
      code: 'PUBLISHING_PROVIDER_REQUEST_FAILED',
    });
  });

  it('sends an exact provider-side schedule to Buffer', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { createPost: { post: { id: 'post-1', status: 'scheduled' } } } }),
        { status: 200 },
      ),
    );
    const result = await gateway.createPost(
      { provider: 'buffer', apiKey: 'key', baseUrl: null, organizationId: 'org-1' },
      {
        channelId: 'channel-1',
        providerType: 'instagram',
        text: 'Hello',
        imageUrls: ['https://cdn.example/a.jpg'],
        scheduledFor: new Date('2026-10-01T09:00:00.000Z'),
        defaults: {},
      },
    );
    expect(result).toEqual({ id: 'post-1', url: null, status: 'scheduled' });
    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.variables.input).toMatchObject({
      channelId: 'channel-1',
      mode: 'customScheduled',
      dueAt: '2026-10-01T09:00:00.000Z',
    });
  });

  it('reads Buffer delivery status and publication details', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            post: {
              id: 'post-1',
              status: 'sent',
              externalLink: 'https://social.example/post-1',
              sentAt: '2026-10-01T09:01:00.000Z',
              error: null,
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      gateway.getPostStatus(
        { provider: 'buffer', apiKey: 'key', baseUrl: null, organizationId: 'org-1' },
        'post-1',
        new Date('2026-10-01T09:00:00.000Z'),
      ),
    ).resolves.toEqual({
      status: 'sent',
      url: 'https://social.example/post-1',
      platformPostId: null,
      publishedAt: new Date('2026-10-01T09:01:00.000Z'),
      failureReason: null,
    });
    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
    expect(body.variables).toEqual({ input: { id: 'post-1' } });
  });

  it('imports remote media before creating a Postiz post', async () => {
    jest.spyOn(gateway, 'assertSafePostizOrigin').mockResolvedValue('https://postiz.example.com');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'asset-1', path: 'https://postiz.example.com/a.jpg' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ postId: 'postiz-1', integration: 'ig-1' }]), {
          status: 200,
        }),
      );
    const result = await gateway.createPost(
      {
        provider: 'postiz',
        apiKey: 'key',
        baseUrl: 'https://postiz.example.com',
        organizationId: null,
      },
      {
        channelId: 'ig-1',
        providerType: 'instagram',
        text: 'Hello',
        imageUrls: ['https://cdn.example/a.jpg'],
        scheduledFor: new Date('2026-10-01T09:00:00.000Z'),
        defaults: { post_type: 'post' },
      },
    );
    expect(result.id).toBe('postiz-1');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://postiz.example.com/public/v1/upload-from-url',
      expect.objectContaining({ method: 'POST' }),
    );
    const postBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[1][1].body));
    expect(postBody.posts[0].value[0].image).toEqual([
      { id: 'asset-1', path: 'https://postiz.example.com/a.jpg' },
    ]);
  });

  it('finds and normalizes a Postiz delivery status', async () => {
    jest.spyOn(gateway, 'assertSafePostizOrigin').mockResolvedValue('https://postiz.example.com');
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          posts: [
            {
              id: 'postiz-1',
              state: 'PUBLISHED',
              releaseId: 'platform-1',
              releaseURL: 'https://social.example/platform-1',
              publishDate: '2026-10-01T09:00:00.000Z',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(
      gateway.getPostStatus(
        {
          provider: 'postiz',
          apiKey: 'key',
          baseUrl: 'https://postiz.example.com',
          organizationId: null,
        },
        'postiz-1',
        new Date('2026-10-01T09:00:00.000Z'),
      ),
    ).resolves.toEqual({
      status: 'PUBLISHED',
      url: 'https://social.example/platform-1',
      platformPostId: 'platform-1',
      publishedAt: new Date('2026-10-01T09:00:00.000Z'),
      failureReason: null,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/postiz\.example\.com\/public\/v1\/posts\?startDate=.*&endDate=.*/,
      ),
      expect.objectContaining({ headers: { Authorization: 'key' } }),
    );
  });

  it('rejects unsafe Postiz origins before making a provider request', async () => {
    await expect(gateway.assertSafePostizOrigin('http://127.0.0.1:5000')).rejects.toBeInstanceOf(
      ApiException,
    );
  });
});

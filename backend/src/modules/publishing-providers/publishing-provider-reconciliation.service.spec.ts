import {
  PublishingProviderReconciliationService,
  remotePostUpdate,
} from './publishing-provider-reconciliation.service';

describe('remotePostUpdate', () => {
  const checkedAt = new Date('2026-10-01T09:05:00.000Z');

  it('promotes a delivered provider post to published', () => {
    const publishedAt = new Date('2026-10-01T09:01:00.000Z');
    expect(
      remotePostUpdate(
        {
          status: 'sent',
          url: 'https://social.example/post-1',
          platformPostId: 'platform-1',
          publishedAt,
          failureReason: null,
        },
        checkedAt,
      ),
    ).toEqual({
      providerStatus: 'sent',
      lastProviderStatusCheckedAt: checkedAt,
      status: 'published',
      publishedAt,
      failureReason: null,
      platformPostUrl: 'https://social.example/post-1',
      platformPostId: 'platform-1',
    });
  });

  it('records provider delivery failures', () => {
    expect(
      remotePostUpdate(
        {
          status: 'ERROR',
          url: null,
          platformPostId: null,
          publishedAt: null,
          failureReason: 'Channel disconnected',
        },
        checkedAt,
      ),
    ).toMatchObject({
      providerStatus: 'ERROR',
      status: 'failed',
      failureReason: 'Channel disconnected',
    });
  });

  it('preserves an unknown remote state without guessing a local state', () => {
    expect(
      remotePostUpdate(
        {
          status: 'WAITING_FOR_NETWORK',
          url: null,
          platformPostId: null,
          publishedAt: null,
          failureReason: null,
        },
        checkedAt,
      ),
    ).toEqual({
      providerStatus: 'WAITING_FOR_NETWORK',
      lastProviderStatusCheckedAt: checkedAt,
    });
  });

  it('reconciles eligible provider posts without overwriting terminal local states', async () => {
    const post = {
      _id: 'local-1',
      workspaceId: { toString: () => 'workspace-1' },
      publishingProvider: 'buffer',
      externalProviderPostId: 'remote-1',
      scheduledFor: new Date('2026-10-01T09:00:00.000Z'),
    };
    const query = {
      sort: jest.fn(),
      limit: jest.fn(),
      exec: jest.fn().mockResolvedValue([post]),
    };
    query.sort.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    const updateExec = jest.fn().mockResolvedValue(undefined);
    const posts = {
      find: jest.fn().mockReturnValue(query),
      updateOne: jest.fn().mockReturnValue({ exec: updateExec }),
    };
    const providers = {
      getPostStatus: jest.fn().mockResolvedValue({
        status: 'sent',
        url: 'https://social.example/remote-1',
        platformPostId: null,
        publishedAt: new Date('2026-10-01T09:01:00.000Z'),
        failureReason: null,
      }),
    };
    const service = new PublishingProviderReconciliationService(posts as never, providers as never);

    await service.reconcilePostDeliveryStatuses();

    expect(providers.getPostStatus).toHaveBeenCalledWith(
      'workspace-1',
      'buffer',
      'remote-1',
      post.scheduledFor,
    );
    expect(posts.updateOne).toHaveBeenCalledWith(
      {
        _id: 'local-1',
        status: { $in: ['queued', 'pending_review', 'processing'] },
      },
      {
        $set: expect.objectContaining({
          status: 'published',
          providerStatus: 'sent',
          platformPostUrl: 'https://social.example/remote-1',
        }),
      },
    );
  });
});

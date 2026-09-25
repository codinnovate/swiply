import { PostingConsistencyService } from './posting-consistency.service';
import type { XPostProvider } from './domain/x-post-provider.interface';

describe('PostingConsistencyService', () => {
  it('returns the normalized provider profile', async () => {
    const provider: XPostProvider = {
      getProfile: jest.fn().mockResolvedValue({
        username: 'samuel',
        displayName: 'Samuel',
        avatarUrl: 'https://example.com/avatar.png',
        isPublic: true,
      }),
      listPostsSince: jest.fn().mockResolvedValue([]),
      listRecentPosts: jest.fn(),
    };
    const service = new PostingConsistencyService(provider);

    await expect(service.getProfile('samuel')).resolves.toEqual({
      username: 'samuel',
      displayName: 'Samuel',
      avatarUrl: 'https://example.com/avatar.png',
      isPublic: true,
    });
    expect(provider.getProfile).toHaveBeenCalledWith('samuel');
  });

  it('counts only enabled qualifying post types', async () => {
    const provider: XPostProvider = {
      getProfile: jest.fn(),
      listPostsSince: jest.fn().mockResolvedValue([
        { id: '1', createdAt: new Date(), kind: 'original' },
        { id: '2', createdAt: new Date(), kind: 'reply' },
        { id: '3', createdAt: new Date(), kind: 'quote' },
      ]),
      listRecentPosts: jest.fn(),
    };
    const service = new PostingConsistencyService(provider);
    const result = await service.verifyPosts({
      username: 'samuel',
      timezone: 'UTC',
      postingDays: [1, 2, 3, 4, 5, 6, 7],
      deadlineMinutes: [0, 1439],
      qualifyingPostTypes: {
        originalPosts: true,
        replies: false,
        reposts: false,
        quotePosts: true,
      },
    });
    expect(result.verifiedCount).toBe(2);
    expect(result.shouldBlock).toBe(false);
  });
});

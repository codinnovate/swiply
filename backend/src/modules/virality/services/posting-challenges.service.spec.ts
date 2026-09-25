import { PostingChallengesService } from './posting-challenges.service';

const now = new Date('2026-09-25T08:00:00.000Z');

const challenge = {
  _id: '66f52c8d1132db6d6d5a4190',
  pairKey: 'alice:bob',
  challengerUsername: 'alice',
  challengerInstallId: '11111111-1111-4111-8111-111111111111',
  challengerDisplayName: 'Alice',
  challengerAvatarUrl: null,
  opponentUsername: 'bob',
  opponentDisplayName: 'Bob',
  opponentAvatarUrl: null,
  opponentInstallId: '22222222-2222-4222-8222-222222222222',
  duration: 'day' as const,
  status: 'pending' as const,
  startsAt: now,
  endsAt: new Date(now.getTime() + 86_400_000),
  respondedAt: null,
  createdAt: now,
  updatedAt: now,
};

function makeService() {
  const listQuery = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([challenge]),
  };
  const challenges = {
    updateMany: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue(listQuery),
    findById: jest.fn(),
    create: jest.fn().mockResolvedValue({ toObject: () => challenge }),
  };
  const participantQuery = {
    lean: jest.fn().mockResolvedValue({ installId: challenge.opponentInstallId }),
  };
  const participants = { findOne: jest.fn().mockReturnValue(participantQuery) };
  const posts = { aggregate: jest.fn().mockResolvedValue([]) };
  const provider = {
    getProfile: jest.fn((username: string) =>
      Promise.resolve({
        username,
        displayName: username === 'alice' ? 'Alice' : 'Bob',
        avatarUrl: null,
        isPublic: true,
      }),
    ),
  };
  const history = { syncAndScore: jest.fn().mockResolvedValue(undefined) };
  const service = new PostingChallengesService(
    challenges as never,
    participants as never,
    posts as never,
    provider as never,
    history as never,
  );
  return { service, challenges, posts, history };
}

describe('PostingChallengesService', () => {
  it('stores a canonical pair and does not ask the challenger to answer their invitation', async () => {
    const { service, challenges } = makeService();

    const result = await service.create({
      challengerUsername: 'alice',
      challengerInstallId: challenge.challengerInstallId,
      opponentUsername: 'bob',
      duration: 'day',
    });

    expect(challenges.findOne).toHaveBeenCalledWith({
      pairKey: 'alice:bob',
      status: { $in: ['pending', 'active'] },
    });
    expect(challenges.create).toHaveBeenCalledWith(
      expect.objectContaining({ pairKey: 'alice:bob', status: 'pending' }),
    );
    expect(result).toMatchObject({ status: 'pending', requiresResponse: false });
  });

  it('marks a pending challenge actionable only for its opponent', async () => {
    const { service } = makeService();

    const forOpponent = await service.list({
      username: 'bob',
      installId: challenge.opponentInstallId,
    });
    const forChallenger = await service.list({
      username: 'alice',
      installId: challenge.challengerInstallId,
    });

    expect(forOpponent[0]).toMatchObject({ requiresResponse: true });
    expect(forChallenger[0]).toMatchObject({ requiresResponse: false });
  });

  it('uses the same pair key when the usernames are reversed', async () => {
    const { service, challenges } = makeService();
    challenges.findOne.mockResolvedValue({ _id: challenge._id });

    await expect(
      service.create({
        challengerUsername: 'bob',
        challengerInstallId: challenge.opponentInstallId,
        opponentUsername: 'alice',
        duration: 'week',
      }),
    ).rejects.toMatchObject({ code: 'CHALLENGE_EXISTS' });
    expect(challenges.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ pairKey: 'alice:bob' }),
    );
  });

  it('rejects malformed challenge ids as not found instead of leaking a database cast error', async () => {
    const { service, challenges } = makeService();

    await expect(
      service.respond('not-an-object-id', {
        username: 'bob',
        installId: challenge.opponentInstallId,
        action: 'accept',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(challenges.findById).not.toHaveBeenCalled();
  });
});

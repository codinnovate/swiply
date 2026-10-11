import { DuelAlertsService } from './duel-alerts.service';

const now = new Date('2026-09-26T12:00:00.000Z');

const duel = {
  _id: '66f52c8d1132db6d6d5a4190',
  challengerUsername: 'alice',
  challengerInstallId: '11111111-1111-4111-8111-111111111111',
  opponentUsername: 'bob',
  opponentInstallId: '22222222-2222-4222-8222-222222222222' as string | null,
  status: 'active' as const,
  startsAt: new Date(now.getTime() - 3_600_000),
  endsAt: new Date(now.getTime() + 6 * 3_600_000),
  notifiedScores: { challenger: 3, opponent: 3 } as { challenger: number; opponent: number } | null,
  challengerPostAlertAt: null,
  opponentPostAlertAt: null,
};

function makeService(
  overrides: Partial<typeof duel> = {},
  scores: Record<string, number> = { alice: 3, bob: 4 },
) {
  const challenge = { ...duel, ...overrides };
  const challenges = {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([challenge]) }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const posts = {
    aggregate: jest
      .fn()
      .mockResolvedValue(Object.entries(scores).map(([_id, score]) => ({ _id, score }))),
  };
  const pushDevices = { notify: jest.fn().mockResolvedValue('sent') };
  const service = new DuelAlertsService(
    challenges as never,
    posts as never,
    pushDevices as never,
  );
  return { service, challenges, pushDevices };
}

describe('DuelAlertsService', () => {
  it('pushes a time-sensitive lead change to the side that lost the lead', async () => {
    const { service, pushDevices, challenges } = makeService();

    await service.checkDuels(['bob'], now);

    expect(challenges.updateOne).toHaveBeenCalledWith(
      { _id: duel._id, 'notifiedScores.challenger': 3, 'notifiedScores.opponent': 3 },
      { $set: { notifiedScores: { challenger: 3, opponent: 4 }, challengerPostAlertAt: now } },
    );
    expect(pushDevices.notify).toHaveBeenCalledTimes(1);
    expect(pushDevices.notify).toHaveBeenCalledWith(
      duel.challengerInstallId,
      'alice',
      expect.objectContaining({
        title: '@bob took the lead',
        interruptionLevel: 'time-sensitive',
        collapseId: `duel-${duel._id}`,
        category: 'postlock.duel',
        expiresAt: duel.endsAt,
        data: { challengeId: duel._id, kind: 'lead_taken' },
      }),
    );
  });

  it('sends nothing when another check already moved the baseline', async () => {
    const { service, pushDevices, challenges } = makeService();
    challenges.updateOne.mockResolvedValue({ modifiedCount: 0 });

    await service.checkDuels(['bob'], now);

    expect(pushDevices.notify).not.toHaveBeenCalled();
  });

  it('records a first baseline without pushing', async () => {
    const { service, pushDevices, challenges } = makeService({ notifiedScores: null });

    await service.checkDuels(['bob'], now);

    expect(challenges.updateOne).toHaveBeenCalledWith(
      { _id: duel._id, notifiedScores: null },
      { $set: { notifiedScores: { challenger: 3, opponent: 4 } } },
    );
    expect(pushDevices.notify).not.toHaveBeenCalled();
  });

  it('skips the write entirely when scores have not moved', async () => {
    const { service, challenges } = makeService({}, { alice: 3, bob: 3 });

    await service.checkDuels(['alice'], now);

    expect(challenges.updateOne).not.toHaveBeenCalled();
  });

  it('skips an opponent who never installed POSTLOCK', async () => {
    const { service, pushDevices } = makeService({ opponentInstallId: null }, { alice: 4, bob: 3 });

    await service.checkDuels(['alice'], now);

    expect(pushDevices.notify).not.toHaveBeenCalled();
  });

  it('does nothing for an empty username list', async () => {
    const { service, challenges } = makeService();

    await service.checkDuels([], now);

    expect(challenges.find).not.toHaveBeenCalled();
  });

  it('swallows lookup failures so polling keeps going', async () => {
    const { service, challenges } = makeService();
    challenges.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('down')) });

    await expect(service.checkDuels(['bob'], now)).resolves.toBeUndefined();
  });
});

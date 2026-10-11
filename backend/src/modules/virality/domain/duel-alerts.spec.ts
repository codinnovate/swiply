import { duelAlerts, POST_ALERT_COOLDOWN_MS, type DuelAlertInput } from './duel-alerts';

const now = new Date('2026-09-26T12:00:00.000Z');

function input(overrides: Partial<DuelAlertInput>): DuelAlertInput {
  return {
    previous: { challenger: 0, opponent: 0 },
    current: { challenger: 0, opponent: 0 },
    usernames: { challenger: 'alice', opponent: 'bob' },
    endsAt: new Date(now.getTime() + 6 * 3_600_000),
    now,
    lastPostAlertAt: { challenger: null, opponent: null },
    ...overrides,
  };
}

describe('duelAlerts', () => {
  it('only records a baseline the first time a duel is checked', () => {
    expect(duelAlerts(input({ previous: null, current: { challenger: 3, opponent: 5 } }))).toEqual(
      [],
    );
  });

  it('tells you when your rival breaks a tie and takes the lead', () => {
    const alerts = duelAlerts(
      input({ previous: { challenger: 3, opponent: 3 }, current: { challenger: 3, opponent: 4 } }),
    );

    expect(alerts).toEqual([
      {
        recipient: 'challenger',
        kind: 'lead_taken',
        title: '@bob took the lead',
        body: "You're down 3–4 with 6h left. Post to take it back.",
      },
    ]);
  });

  it('tells you your rival posted when you still lead', () => {
    const [alert] = duelAlerts(
      input({ previous: { challenger: 5, opponent: 3 }, current: { challenger: 5, opponent: 4 } }),
    );

    expect(alert).toMatchObject({
      recipient: 'challenger',
      kind: 'rival_posted',
      title: '@bob just posted',
      body: 'You still lead 5–4 with 6h left. Keep it that way.',
    });
  });

  it('calls it a tie when your rival catches up', () => {
    const [alert] = duelAlerts(
      input({ previous: { challenger: 2, opponent: 1 }, current: { challenger: 2, opponent: 2 } }),
    );

    expect(alert).toMatchObject({ kind: 'rival_posted', body: 'Tied 2–2 with 6h left. Your move.' });
  });

  it('does not re-announce a lead your rival already had', () => {
    const [alert] = duelAlerts(
      input({ previous: { challenger: 1, opponent: 2 }, current: { challenger: 1, opponent: 3 } }),
    );

    expect(alert).toMatchObject({ kind: 'rival_posted', body: "They're up 3–1 with 6h left. Your move." });
  });

  it('folds several new posts into one alert with the final score', () => {
    const alerts = duelAlerts(
      input({ previous: { challenger: 4, opponent: 1 }, current: { challenger: 4, opponent: 3 } }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe('@bob posted 2 times');
  });

  it('holds back a second "posted" alert inside the cooldown', () => {
    const recent = new Date(now.getTime() - POST_ALERT_COOLDOWN_MS + 1_000);
    const alerts = duelAlerts(
      input({
        previous: { challenger: 5, opponent: 3 },
        current: { challenger: 5, opponent: 4 },
        lastPostAlertAt: { challenger: recent, opponent: null },
      }),
    );

    expect(alerts).toEqual([]);
  });

  it('always sends a lead change, even inside the cooldown', () => {
    const recent = new Date(now.getTime() - 60_000);
    const alerts = duelAlerts(
      input({
        previous: { challenger: 3, opponent: 3 },
        current: { challenger: 3, opponent: 4 },
        lastPostAlertAt: { challenger: recent, opponent: null },
      }),
    );

    expect(alerts).toEqual([expect.objectContaining({ kind: 'lead_taken' })]);
  });

  it('alerts each side about the other when both posted since the last check', () => {
    const alerts = duelAlerts(
      input({ previous: { challenger: 2, opponent: 2 }, current: { challenger: 3, opponent: 4 } }),
    );

    expect(alerts).toEqual([
      expect.objectContaining({ recipient: 'challenger', kind: 'lead_taken' }),
      expect.objectContaining({ recipient: 'opponent', kind: 'rival_posted', title: '@alice just posted' }),
    ]);
  });

  it('stays quiet about your own posts', () => {
    expect(
      duelAlerts(
        input({ previous: { challenger: 2, opponent: 2 }, current: { challenger: 3, opponent: 2 } }),
      ),
    ).toEqual([expect.objectContaining({ recipient: 'opponent' })]);
  });

  it('stays quiet once the duel has ended', () => {
    expect(
      duelAlerts(
        input({
          previous: { challenger: 0, opponent: 0 },
          current: { challenger: 0, opponent: 1 },
          endsAt: new Date(now.getTime() - 1),
        }),
      ),
    ).toEqual([]);
  });

  it('switches to minutes and days for the time left', () => {
    const scores = { previous: { challenger: 1, opponent: 0 }, current: { challenger: 1, opponent: 1 } };
    const soon = duelAlerts(input({ ...scores, endsAt: new Date(now.getTime() + 45 * 60_000) }));
    const later = duelAlerts(input({ ...scores, endsAt: new Date(now.getTime() + 5 * 86_400_000) }));

    expect(soon[0].body).toContain('45m left');
    expect(later[0].body).toContain('5d left');
  });
});

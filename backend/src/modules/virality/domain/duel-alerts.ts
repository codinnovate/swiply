export type DuelSide = 'challenger' | 'opponent';
export type DuelAlertKind = 'lead_taken' | 'rival_posted';

export interface DuelScores {
  challenger: number;
  opponent: number;
}

export interface DuelAlertInput {
  /** Scores at the last check; null until a baseline has been recorded. */
  previous: DuelScores | null;
  current: DuelScores;
  usernames: Record<DuelSide, string>;
  endsAt: Date;
  now: Date;
  /** When each side last got any alert for this duel. */
  lastPostAlertAt: Record<DuelSide, Date | null>;
}

export interface DuelAlert {
  recipient: DuelSide;
  kind: DuelAlertKind;
  title: string;
  body: string;
}

/** A rival who posts in bursts produces one "posted" alert per window; lead changes always go out. */
export const POST_ALERT_COOLDOWN_MS = 10 * 60_000;

const SIDES: DuelSide[] = ['challenger', 'opponent'];

/**
 * Decides who hears about a change in duel scores. Each person gets at most
 * one alert per check: losing the lead outranks "your rival posted", and
 * several posts found at once become a single alert with the final score.
 */
export function duelAlerts(input: DuelAlertInput): DuelAlert[] {
  const { previous, current, now, endsAt } = input;
  if (!previous || endsAt.getTime() <= now.getTime()) return [];
  const remaining = timeLeft(endsAt.getTime() - now.getTime());

  return SIDES.flatMap((side): DuelAlert[] => {
    const rival: DuelSide = side === 'challenger' ? 'opponent' : 'challenger';
    const gained = current[rival] - previous[rival];
    if (gained <= 0) return [];

    const handle = `@${input.usernames[rival]}`;
    const mine = current[side];
    const theirs = current[rival];
    if (previous[side] >= previous[rival] && theirs > mine) {
      return [
        {
          recipient: side,
          kind: 'lead_taken',
          title: `${handle} took the lead`,
          body: `You're down ${mine}–${theirs} with ${remaining}. Post to take it back.`,
        },
      ];
    }

    const lastAlert = input.lastPostAlertAt[side];
    if (lastAlert && now.getTime() - lastAlert.getTime() < POST_ALERT_COOLDOWN_MS) return [];
    const standing =
      theirs > mine
        ? `They're up ${theirs}–${mine} with ${remaining}. Your move.`
        : theirs === mine
          ? `Tied ${mine}–${theirs} with ${remaining}. Your move.`
          : `You still lead ${mine}–${theirs} with ${remaining}. Keep it that way.`;
    return [
      {
        recipient: side,
        kind: 'rival_posted',
        title: gained === 1 ? `${handle} just posted` : `${handle} posted ${gained} times`,
        body: standing,
      },
    ];
  });
}

function timeLeft(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

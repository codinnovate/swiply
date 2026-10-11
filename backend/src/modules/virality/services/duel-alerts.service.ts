import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { duelAlerts, type DuelAlert } from '../domain/duel-alerts';
import { PostingChallenge } from '../schemas/posting-challenge.schema';
import { ScoredPost } from '../schemas/scored-post.schema';
import { challengeScores } from './challenge-scores';
import { PushDevicesService } from './push-devices.service';

export const DUEL_ALERT_CATEGORY = 'postlock.duel';

type ActiveChallenge = PostingChallenge & { _id: unknown };

/** Turns new posts in active duels into push alerts for the other side. */
@Injectable()
export class DuelAlertsService {
  private readonly logger = new Logger(DuelAlertsService.name);

  constructor(
    @InjectModel(PostingChallenge.name) private readonly challenges: Model<PostingChallenge>,
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    private readonly pushDevices: PushDevicesService,
  ) {}

  /** Checks every active duel involving these usernames. Never throws. */
  async checkDuels(usernames: string[], now = new Date()): Promise<void> {
    if (usernames.length === 0) return;
    try {
      const active = await this.challenges
        .find({
          status: 'active',
          endsAt: { $gt: now },
          $or: [
            { challengerUsername: { $in: usernames } },
            { opponentUsername: { $in: usernames } },
          ],
        })
        .lean();
      await Promise.allSettled(active.map((challenge) => this.check(challenge, now)));
    } catch (error) {
      this.logger.warn(`Duel alert check failed: ${String(error)}`);
    }
  }

  private async check(challenge: ActiveChallenge, now: Date): Promise<void> {
    const current = await challengeScores(this.posts, challenge);
    const previous = challenge.notifiedScores ?? null;
    if (previous?.challenger === current.challenger && previous.opponent === current.opponent) {
      return;
    }
    const alerts = duelAlerts({
      previous,
      current,
      usernames: { challenger: challenge.challengerUsername, opponent: challenge.opponentUsername },
      endsAt: challenge.endsAt,
      now,
      lastPostAlertAt: {
        challenger: challenge.challengerPostAlertAt ?? null,
        opponent: challenge.opponentPostAlertAt ?? null,
      },
    });
    const update: Record<string, unknown> = { notifiedScores: current };
    for (const alert of alerts) update[`${alert.recipient}PostAlertAt`] = now;
    // Only the check that moves the baseline sends, so an overlapping poll and
    // list sync can't both announce the same post.
    const claimed = await this.challenges.updateOne(
      {
        _id: challenge._id,
        ...(previous
          ? {
              'notifiedScores.challenger': previous.challenger,
              'notifiedScores.opponent': previous.opponent,
            }
          : { notifiedScores: null }),
      },
      { $set: update },
    );
    if (claimed.modifiedCount === 0) return;
    await Promise.allSettled(alerts.map((alert) => this.deliver(challenge, alert)));
  }

  private async deliver(challenge: ActiveChallenge, alert: DuelAlert): Promise<void> {
    const installId =
      alert.recipient === 'challenger' ? challenge.challengerInstallId : challenge.opponentInstallId;
    // An opponent who never installed POSTLOCK has nowhere to receive it.
    if (!installId) return;
    const username =
      alert.recipient === 'challenger' ? challenge.challengerUsername : challenge.opponentUsername;
    const id = String(challenge._id);
    await this.pushDevices.notify(installId, username, {
      title: alert.title,
      body: alert.body,
      threadId: `duel-${id}`,
      collapseId: `duel-${id}`,
      interruptionLevel: alert.kind === 'lead_taken' ? 'time-sensitive' : 'active',
      relevanceScore: alert.kind === 'lead_taken' ? 1 : 0.6,
      category: DUEL_ALERT_CATEGORY,
      expiresAt: challenge.endsAt,
      data: { challengeId: id, kind: alert.kind },
    });
  }
}

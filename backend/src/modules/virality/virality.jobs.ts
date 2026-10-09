import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LeaderboardService } from './services/leaderboard.service';
import { PostingChallengesService } from './services/posting-challenges.service';

const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
/** Let the app finish booting before the first refresh after a deploy. */
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;
/** How often duels with an open stream check X for new posts. */
const CHALLENGE_POLL_MS = 30 * 1000;

/**
 * Refreshes the leaderboard every three hours — rankings are recomputed on a
 * schedule rather than live, to keep scoring cost bounded. Watched posting
 * challenges are polled every 30 seconds so their streams stay live. A plain timer: the
 * installed @nestjs/schedule is ESM-only and this backend is CommonJS.
 */
@Injectable()
export class ViralityJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ViralityJobs.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly challenges: PostingChallengesService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get<boolean>('virality.jobsEnabled', true)) return;
    const first = setTimeout(() => void this.refreshLeaderboard(), FIRST_RUN_DELAY_MS);
    const recurring = setInterval(() => void this.refreshLeaderboard(), REFRESH_INTERVAL_MS);
    const challenges = setInterval(() => void this.pollChallenges(), CHALLENGE_POLL_MS);
    first.unref();
    recurring.unref();
    challenges.unref();
    this.timers = [first, recurring, challenges];
  }

  onModuleDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  async refreshLeaderboard(): Promise<void> {
    const started = Date.now();
    try {
      await this.leaderboard.refreshAll();
      this.logger.log(`Leaderboard refreshed in ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (error) {
      this.logger.error(`Leaderboard refresh failed: ${String(error)}`);
    }
  }

  async pollChallenges(): Promise<void> {
    try {
      await this.challenges.pollWatched();
    } catch (error) {
      this.logger.error(`Challenge poll failed: ${String(error)}`);
    }
  }
}

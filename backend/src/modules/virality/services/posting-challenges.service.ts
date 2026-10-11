import { Inject, Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import { concatMap, defer, finalize, interval, map, merge, startWith, type Observable } from 'rxjs';

import { ApiException } from '../../../common/errors/api.exception';
import {
  X_POST_PROVIDER,
  type XPostProvider,
} from '../../posting-consistency/domain/x-post-provider.interface';
import type {
  CreatePostingChallengeDto,
  PostingChallengesQueryDto,
  RespondPostingChallengeDto,
} from '../dto/virality.dto';
import { LeaderboardParticipant } from '../schemas/leaderboard-participant.schema';
import { PostingChallenge } from '../schemas/posting-challenge.schema';
import { ScoredPost } from '../schemas/scored-post.schema';
import { ChallengeEventsService } from './challenge-events.service';
import { challengeScores } from './challenge-scores';
import { DuelAlertsService } from './duel-alerts.service';
import { PostHistoryService } from './post-history.service';

/** Keeps idle proxies (Railway, carriers) from closing an open stream. */
const HEARTBEAT_MS = 25_000;
/** A duel that starts now alerts on its first post instead of just recording a baseline. */
const FRESH_BASELINE = { challenger: 0, opponent: 0 };

@Injectable()
export class PostingChallengesService {
  private readonly logger = new Logger(PostingChallengesService.name);
  private polling: Promise<void> | null = null;

  constructor(
    @InjectModel(PostingChallenge.name) private readonly challenges: Model<PostingChallenge>,
    @InjectModel(LeaderboardParticipant.name)
    private readonly participants: Model<LeaderboardParticipant>,
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly history: PostHistoryService,
    private readonly events: ChallengeEventsService,
    private readonly alerts: DuelAlertsService,
  ) {}

  async create(dto: CreatePostingChallengeDto) {
    if (dto.challengerUsername === dto.opponentUsername) {
      throw new ApiException('INVALID_CHALLENGE', 'Pick someone other than yourself.');
    }
    await this.finishExpired();
    const pairKey = this.pairKey(dto.challengerUsername, dto.opponentUsername);
    const existing = await this.challenges.findOne({
      pairKey,
      status: { $in: ['pending', 'active'] },
    });
    if (existing) {
      throw new ApiException('CHALLENGE_EXISTS', 'You already have a live challenge together.');
    }
    const [challenger, opponent, participant] = await Promise.all([
      this.provider.getProfile(dto.challengerUsername),
      this.provider.getProfile(dto.opponentUsername),
      this.participants.findOne({ username: dto.opponentUsername, optedIn: true }).lean(),
    ]);
    if (!challenger.isPublic || !opponent.isPublic) {
      throw new ApiException('PRIVATE_PROFILE', 'Challenges require public X profiles.');
    }
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + (dto.duration === 'day' ? 1 : 7) * 86_400_000);
    try {
      const challenge = await this.challenges.create({
        pairKey,
        challengerUsername: dto.challengerUsername,
        challengerInstallId: dto.challengerInstallId,
        challengerDisplayName: challenger.displayName,
        challengerAvatarUrl: challenger.avatarUrl ?? null,
        opponentUsername: dto.opponentUsername,
        opponentDisplayName: opponent.displayName,
        opponentAvatarUrl: opponent.avatarUrl ?? null,
        opponentInstallId: participant?.installId ?? null,
        duration: dto.duration,
        status: participant ? 'pending' : 'active',
        startsAt,
        endsAt,
        notifiedScores: participant ? null : FRESH_BASELINE,
      });
      this.events.changed(dto.challengerUsername, dto.opponentUsername);
      return this.present(challenge.toObject(), dto.challengerUsername);
    } catch (error) {
      if (this.mongoErrorCode(error) === 11000) {
        throw new ApiException('CHALLENGE_EXISTS', 'You already have a live challenge together.');
      }
      throw error;
    }
  }

  async list(query: PostingChallengesQueryDto) {
    await this.finishExpired();
    const visible = await this.visibleTo(query);
    const activeUsernames = [
      ...new Set(
        visible
          .filter((item) => item.status === 'active')
          .flatMap((item) => [item.challengerUsername, item.opponentUsername]),
      ),
    ];
    await Promise.allSettled(
      activeUsernames.map((username) => this.history.syncAndScore(username, {})),
    );
    await this.alerts.checkDuels(activeUsernames);
    // The sync may have found new posts; the rival's open stream should see them too.
    this.events.changed(...activeUsernames);
    return Promise.all(visible.map((item) => this.present(item, query.username)));
  }

  /**
   * Server-sent events for one install: the full visible challenge list on
   * connect and again whenever one of its challenges changes, plus a heartbeat.
   */
  stream(query: PostingChallengesQueryDto): Observable<MessageEvent> {
    return defer(() => {
      const release = this.events.watch(query.username);
      const snapshots = this.events.changesFor(query.username).pipe(
        startWith(undefined),
        concatMap(async () => {
          const visible = await this.visibleTo(query);
          return Promise.all(visible.map((item) => this.present(item, query.username)));
        }),
        map((data): MessageEvent => ({ type: 'challenges', data })),
      );
      const heartbeat = interval(HEARTBEAT_MS).pipe(
        map((): MessageEvent => ({ type: 'ping', data: '' })),
      );
      return merge(snapshots, heartbeat).pipe(finalize(release));
    });
  }

  /**
   * Pulls the newest timeline page for everyone in an active challenge that
   * has an open stream, sends duel alerts, and announces the usernames whose
   * posts changed. Overlapping calls share one run.
   */
  pollWatched(): Promise<void> {
    return this.startPoll('watched');
  }

  /**
   * The same for every active duel, so alerts reach people without the app
   * open. Waits out a poll already in flight rather than skipping this round.
   */
  async pollActive(): Promise<void> {
    await this.polling?.catch(() => undefined);
    return this.startPoll('all');
  }

  private startPoll(scope: 'watched' | 'all'): Promise<void> {
    this.polling ??= this.runPoll(scope).finally(() => {
      this.polling = null;
    });
    return this.polling;
  }

  private async runPoll(scope: 'watched' | 'all'): Promise<void> {
    await this.finishExpired();
    const watched = this.events.watchedUsernames();
    if (scope === 'watched' && watched.length === 0) return;
    const active = await this.challenges
      .find(
        scope === 'watched'
          ? {
              status: 'active',
              $or: [
                { challengerUsername: { $in: watched } },
                { opponentUsername: { $in: watched } },
              ],
            }
          : { status: 'active' },
      )
      .select('challengerUsername opponentUsername')
      .lean();
    const usernames = [
      ...new Set(active.flatMap((item) => [item.challengerUsername, item.opponentUsername])),
    ];
    const changed = await Promise.all(
      usernames.map(async (username) => {
        try {
          const before = await this.posts.countDocuments({ username });
          await this.history.ingest(username, { pages: 1 });
          return (await this.posts.countDocuments({ username })) !== before ? username : null;
        } catch (error) {
          this.logger.warn(`Challenge poll for @${username} failed: ${String(error)}`);
          return null;
        }
      }),
    );
    const posted = changed.filter((username): username is string => username !== null);
    await this.alerts.checkDuels(posted);
    this.events.changed(...posted);
  }

  private async visibleTo(query: PostingChallengesQueryDto) {
    const challenges = await this.challenges
      .find({ $or: [{ challengerUsername: query.username }, { opponentUsername: query.username }] })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return challenges.filter(
      (item) =>
        (item.challengerUsername === query.username &&
          item.challengerInstallId === query.installId) ||
        (item.opponentUsername === query.username &&
          (!item.opponentInstallId || item.opponentInstallId === query.installId)),
    );
  }

  async respond(id: string, dto: RespondPostingChallengeDto) {
    if (!isValidObjectId(id)) throw ApiException.notFound('Challenge', { id });
    const challenge = await this.challenges.findById(id);
    if (!challenge) throw ApiException.notFound('Challenge', { id });
    if (
      challenge.opponentUsername !== dto.username ||
      challenge.opponentInstallId !== dto.installId ||
      challenge.status !== 'pending'
    ) {
      throw ApiException.forbidden('FORBIDDEN', 'This invitation is not available.');
    }
    challenge.status = dto.action === 'accept' ? 'active' : 'declined';
    challenge.respondedAt = new Date();
    if (dto.action === 'accept') {
      challenge.notifiedScores = FRESH_BASELINE;
      challenge.startsAt = new Date();
      challenge.endsAt = new Date(
        challenge.startsAt.getTime() + (challenge.duration === 'day' ? 1 : 7) * 86_400_000,
      );
    }
    await challenge.save();
    this.events.changed(challenge.challengerUsername, challenge.opponentUsername);
    return this.present(challenge.toObject(), dto.username);
  }

  private async finishExpired() {
    const expired = await this.challenges
      .find({ status: 'active', endsAt: { $lte: new Date() } })
      .select('challengerUsername opponentUsername')
      .lean();
    if (expired.length === 0) return;
    await this.challenges.updateMany(
      { _id: { $in: expired.map((item) => item._id) }, status: 'active' },
      { $set: { status: 'completed' } },
    );
    this.events.changed(
      ...expired.flatMap((item) => [item.challengerUsername, item.opponentUsername]),
    );
  }

  private async present(challenge: PostingChallenge & { _id: unknown }, viewerUsername: string) {
    const scores = await challengeScores(this.posts, challenge);
    return {
      id: String(challenge._id),
      challenger: {
        username: challenge.challengerUsername,
        displayName: challenge.challengerDisplayName,
        avatarUrl: challenge.challengerAvatarUrl,
        score: scores.challenger,
      },
      opponent: {
        username: challenge.opponentUsername,
        displayName: challenge.opponentDisplayName,
        avatarUrl: challenge.opponentAvatarUrl,
        score: scores.opponent,
      },
      duration: challenge.duration,
      status: challenge.status,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      requiresResponse:
        challenge.status === 'pending' && challenge.opponentUsername === viewerUsername,
    };
  }

  private pairKey(firstUsername: string, secondUsername: string) {
    return [firstUsername, secondUsername].sort((a, b) => a.localeCompare(b)).join(':');
  }

  private mongoErrorCode(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? Number((error as { code: unknown }).code)
      : undefined;
  }
}

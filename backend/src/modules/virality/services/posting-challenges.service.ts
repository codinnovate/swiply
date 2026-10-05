import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';

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
import { PostHistoryService } from './post-history.service';

@Injectable()
export class PostingChallengesService {
  constructor(
    @InjectModel(PostingChallenge.name) private readonly challenges: Model<PostingChallenge>,
    @InjectModel(LeaderboardParticipant.name)
    private readonly participants: Model<LeaderboardParticipant>,
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly history: PostHistoryService,
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
      });
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
    const challenges = await this.challenges
      .find({ $or: [{ challengerUsername: query.username }, { opponentUsername: query.username }] })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    const visible = challenges.filter(
      (item) =>
        (item.challengerUsername === query.username &&
          item.challengerInstallId === query.installId) ||
        (item.opponentUsername === query.username &&
          (!item.opponentInstallId || item.opponentInstallId === query.installId)),
    );
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
    return Promise.all(visible.map((item) => this.present(item, query.username)));
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
      challenge.startsAt = new Date();
      challenge.endsAt = new Date(
        challenge.startsAt.getTime() + (challenge.duration === 'day' ? 1 : 7) * 86_400_000,
      );
    }
    await challenge.save();
    return this.present(challenge.toObject(), dto.username);
  }

  private async finishExpired() {
    await this.challenges.updateMany(
      { status: 'active', endsAt: { $lte: new Date() } },
      { $set: { status: 'completed' } },
    );
  }

  private async present(challenge: PostingChallenge & { _id: unknown }, viewerUsername: string) {
    const counts = await this.posts.aggregate<{ _id: string; score: number }>([
      {
        $match: {
          username: { $in: [challenge.challengerUsername, challenge.opponentUsername] },
          postedAt: { $gte: challenge.startsAt, $lte: challenge.endsAt },
        },
      },
      { $group: { _id: '$username', score: { $sum: 1 } } },
    ]);
    const score = new Map(counts.map((item) => [item._id, item.score]));
    return {
      id: String(challenge._id),
      challenger: {
        username: challenge.challengerUsername,
        displayName: challenge.challengerDisplayName,
        avatarUrl: challenge.challengerAvatarUrl,
        score: score.get(challenge.challengerUsername) ?? 0,
      },
      opponent: {
        username: challenge.opponentUsername,
        displayName: challenge.opponentDisplayName,
        avatarUrl: challenge.opponentAvatarUrl,
        score: score.get(challenge.opponentUsername) ?? 0,
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

import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ApiException } from '../../../common/errors/api.exception';
import {
  X_POST_PROVIDER,
  type XPostProvider,
} from '../../posting-consistency/domain/x-post-provider.interface';
import {
  assignRanks,
  LEADERBOARD_WINDOW,
  rankLeaderboard,
  type LeaderboardCandidate,
  type LeaderboardEntry,
} from '../domain/leaderboard-ranking';
import type {
  FeaturedAccountDto,
  LeaderboardParticipationDto,
  LeaderboardQueryDto,
} from '../dto/virality.dto';
import { FeaturedAccount } from '../schemas/featured-account.schema';
import { LeaderboardParticipant } from '../schemas/leaderboard-participant.schema';
import { LeaderboardSnapshot } from '../schemas/leaderboard-snapshot.schema';
import { ScoredPost } from '../schemas/scored-post.schema';
import { PostHistoryService } from './post-history.service';

const SNAPSHOTS_KEPT = 5;
const ENTRIES_RETURNED = 100;

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private refreshing: Promise<void> | null = null;

  constructor(
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    @InjectModel(FeaturedAccount.name) private readonly featured: Model<FeaturedAccount>,
    @InjectModel(LeaderboardParticipant.name)
    private readonly participants: Model<LeaderboardParticipant>,
    @InjectModel(LeaderboardSnapshot.name) private readonly snapshots: Model<LeaderboardSnapshot>,
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly history: PostHistoryService,
  ) {}

  async getLeaderboard(query: LeaderboardQueryDto) {
    const snapshot =
      (await this.snapshots.findOne().sort({ computedAt: -1 }).lean()) ?? (await this.recompute());
    const category = query.category ?? 'all';
    const niche = query.niche?.toLowerCase();
    const filtered = snapshot.entries.filter(
      (entry) =>
        (category === 'all' || (category === 'featured') === (entry.category === 'featured')) &&
        (!niche || entry.niche?.toLowerCase() === niche),
    );
    const ranked = niche || category !== 'all' ? assignRanks(filtered) : filtered;
    const niches = [
      ...new Set(
        snapshot.entries.map((entry) => entry.niche).filter((value): value is string => !!value),
      ),
    ].sort((a, b) => a.localeCompare(b));
    return {
      computedAt: snapshot.computedAt,
      window: LEADERBOARD_WINDOW,
      entries: ranked.slice(0, ENTRIES_RETURNED),
      niches,
      me: query.username
        ? (ranked.find((entry) => entry.username === query.username) ?? null)
        : null,
    };
  }

  async setParticipation(dto: LeaderboardParticipationDto) {
    const existing = await this.participants.findOne({ username: dto.username });
    if (existing?.optedIn && existing.installId !== dto.installId) {
      throw ApiException.forbidden(
        'LEADERBOARD_USERNAME_CLAIMED',
        'This username is already on the leaderboard from another device.',
      );
    }

    if (!dto.optedIn) {
      if (existing) {
        await this.participants.updateOne(
          { _id: existing._id },
          { $set: { optedIn: false, installId: dto.installId } },
        );
        // Consent withdrawn: leave the published ranking now, not at the next refresh.
        await this.recompute();
      }
      return { optedIn: false, niche: existing?.niche ?? null };
    }

    const profile = await this.provider.getProfile(dto.username);
    if (!profile.isPublic) {
      throw ApiException.forbidden('FORBIDDEN', 'Only public X accounts can join the leaderboard.');
    }
    await this.participants.updateOne(
      { username: dto.username },
      {
        $set: {
          installId: dto.installId,
          optedIn: true,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl ?? null,
          niche: dto.niche ?? null,
          timezone: dto.timezone ?? null,
        },
      },
      { upsert: true },
    );
    // Score what's there now so the user can appear without waiting for the next refresh.
    void this.history
      .syncAndScore(dto.username, { niche: dto.niche, timezone: dto.timezone })
      .then(() => this.recompute())
      .catch((error: unknown) =>
        this.logger.warn(`Opt-in sync for @${dto.username} failed: ${String(error)}`),
      );
    return { optedIn: true, niche: dto.niche ?? null };
  }

  listFeatured() {
    return this.featured.find().sort({ username: 1 }).lean();
  }

  async addFeatured(dto: FeaturedAccountDto) {
    const profile = await this.provider.getProfile(dto.username);
    return this.featured
      .findOneAndUpdate(
        { username: dto.username },
        {
          $set: {
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl ?? null,
            niche: dto.niche ?? null,
            active: true,
          },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  async removeFeatured(username: string) {
    const result = await this.featured.updateOne({ username }, { $set: { active: false } });
    if (result.matchedCount === 0) throw ApiException.notFound('Featured account', { username });
    await this.recompute();
    return { removed: true };
  }

  /**
   * Pulls and scores recent posts for every featured account and opted-in
   * user, then re-ranks. Runs on a schedule; overlapping calls share one run.
   */
  refreshAll(): Promise<void> {
    this.refreshing ??= this.runRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async runRefresh(): Promise<void> {
    const [featured, participants] = await Promise.all([
      this.featured.find({ active: true }).lean(),
      this.participants.find({ optedIn: true }).lean(),
    ]);
    const stamp = { $set: { lastSyncedAt: new Date() } };
    const accounts = [
      ...featured.map((account) => ({
        account,
        timezone: undefined,
        markSynced: () => this.featured.updateOne({ _id: account._id }, stamp),
      })),
      ...participants.map((account) => ({
        account,
        timezone: account.timezone ?? undefined,
        markSynced: () => this.participants.updateOne({ _id: account._id }, stamp),
      })),
    ];
    for (const { account, timezone, markSynced } of accounts) {
      try {
        await this.history.syncAndScore(account.username, {
          niche: account.niche ?? undefined,
          timezone,
        });
        await markSynced();
      } catch (error) {
        this.logger.warn(`Leaderboard refresh for @${account.username} failed: ${String(error)}`);
      }
    }
    await this.recompute();
  }

  /** Re-ranks from stored scores; no X or model calls. */
  async recompute() {
    const [featured, participants] = await Promise.all([
      this.featured.find({ active: true }).lean(),
      this.participants.find({ optedIn: true }).lean(),
    ]);
    // An account that's both featured and a PostLock user is listed once, as featured.
    const candidates = new Map<string, LeaderboardCandidate>();
    for (const account of participants) {
      candidates.set(account.username, { ...this.candidateBase(account), category: 'user' });
    }
    for (const account of featured) {
      candidates.set(account.username, { ...this.candidateBase(account), category: 'featured' });
    }

    const cutoff = new Date(Date.now() - LEADERBOARD_WINDOW.days * 86_400_000);
    const posts = await this.posts
      .find({
        username: { $in: [...candidates.keys()] },
        scoreStatus: 'scored',
        postedAt: { $gte: cutoff },
      })
      .select('username postedAt score.total_score engagement.replies')
      .lean();
    for (const post of posts) {
      candidates.get(post.username)?.posts.push({
        postedAt: post.postedAt,
        totalScore: post.score?.total_score ?? 0,
        replies: post.engagement?.replies ?? 0,
      });
    }

    const entries: LeaderboardEntry[] = rankLeaderboard([...candidates.values()]);
    const snapshot = await this.snapshots.create({ computedAt: new Date(), entries });
    const stale = await this.snapshots
      .find()
      .sort({ computedAt: -1 })
      .skip(SNAPSHOTS_KEPT)
      .select('_id')
      .lean();
    if (stale.length > 0) {
      await this.snapshots.deleteMany({ _id: { $in: stale.map((doc) => doc._id) } });
    }
    return snapshot.toObject();
  }

  private candidateBase(account: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    niche: string | null;
  }) {
    return {
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl ?? undefined,
      niche: account.niche ?? undefined,
      posts: [] as LeaderboardCandidate['posts'],
    };
  }
}

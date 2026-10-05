import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ApiException } from '../../../common/errors/api.exception';
import {
  X_POST_PROVIDER,
  type XPostProvider,
} from '../../posting-consistency/domain/x-post-provider.interface';
import {
  LEADERBOARD_WINDOW,
  rankByPeriod,
  rankLeaderboard,
  type LeaderboardCandidate,
  type LeaderboardEntry,
} from '../domain/leaderboard-ranking';
import type {
  FeaturedAccountDto,
  LeaderboardBreakdownQueryDto,
  LeaderboardParticipationDto,
  LeaderboardQueryDto,
} from '../dto/virality.dto';
import { FeaturedAccount } from '../schemas/featured-account.schema';
import { LeaderboardParticipant } from '../schemas/leaderboard-participant.schema';
import { LeaderboardSnapshot } from '../schemas/leaderboard-snapshot.schema';
import { ScoredPost } from '../schemas/scored-post.schema';
import { XComment } from '../schemas/x-comment.schema';
import { levelForXp, type XpConfig } from '../domain/xp';
import { PostHistoryService } from './post-history.service';
import { XpService } from './xp.service';

const SNAPSHOTS_KEPT = 5;
const ENTRIES_RETURNED = 100;
/**
 * FxTwitter timeline pages per refresh. An account's first sync backfills as
 * far as the timeline pages back; later ones only need to cover the gap since
 * the last refresh, with margin for pages that overlap.
 */
const BACKFILL_PAGES = 15;
const REFRESH_PAGES = 4;
/** Posts listed in an account's XP breakdown; the totals still cover every post. */
const BREAKDOWN_POSTS_LIMIT = 100;
const PERIOD_MS = { day: 86_400_000, week: 7 * 86_400_000, all: Number.POSITIVE_INFINITY };

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private refreshing: Promise<void> | null = null;

  constructor(
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    @InjectModel(XComment.name) private readonly comments: Model<XComment>,
    @InjectModel(FeaturedAccount.name) private readonly featured: Model<FeaturedAccount>,
    @InjectModel(LeaderboardParticipant.name)
    private readonly participants: Model<LeaderboardParticipant>,
    @InjectModel(LeaderboardSnapshot.name) private readonly snapshots: Model<LeaderboardSnapshot>,
    @Inject(X_POST_PROVIDER) private readonly provider: XPostProvider,
    private readonly history: PostHistoryService,
    private readonly xp: XpService,
  ) {}

  async getLeaderboard(query: LeaderboardQueryDto) {
    const xpConfig = await this.xp.config();
    const snapshot = await this.currentSnapshot(xpConfig);
    const category = query.category ?? 'all';
    const niche = query.niche?.toLowerCase();
    const period = query.period ?? 'all';
    const filtered = snapshot.entries.filter(
      (entry) =>
        (category === 'all' || (category === 'featured') === (entry.category === 'featured')) &&
        (!niche || entry.niche?.toLowerCase() === niche),
    );
    // Re-ranked for the requested period; the response carries only that
    // period's activity, so the client only ever reads one set of fields.
    const ranked = rankByPeriod(filtered, period).map(({ periods, ...entry }) => ({
      ...entry,
      level: levelForXp(periods.all.xp, xpConfig).level,
      xp: periods[period].xp,
      postsCounted: periods[period].posts,
      commentsCounted: periods[period].comments,
      repliesReceived: periods[period].repliesReceived,
    }));
    const niches = [
      ...new Set(
        snapshot.entries.map((entry) => entry.niche).filter((value): value is string => !!value),
      ),
    ].sort((a, b) => a.localeCompare(b));
    return {
      computedAt: snapshot.computedAt,
      window: LEADERBOARD_WINDOW,
      xpRules: this.xp.rules(xpConfig),
      entries: ranked.slice(0, ENTRIES_RETURNED),
      niches,
      me: query.username
        ? (ranked.find((entry) => entry.username === query.username) ?? null)
        : null,
    };
  }

  /**
   * How one ranked account's XP for a period adds up: every post in that
   * period with its engagement and per-signal XP. Computed as of the ranking's
   * snapshot time, so the total matches the XP the leaderboard ranked on.
   */
  async getBreakdown(query: LeaderboardBreakdownQueryDto) {
    const xpConfig = await this.xp.config();
    const snapshot = await this.currentSnapshot(xpConfig);
    const entry = snapshot.entries.find((candidate) => candidate.username === query.username);
    if (!entry) throw ApiException.notFound('Leaderboard entry', { username: query.username });

    const period = query.period ?? 'day';
    const now = new Date(snapshot.computedAt);
    const since = now.getTime() - PERIOD_MS[period];
    const postedAt = {
      $lte: now,
      ...(Number.isFinite(since) ? { $gt: new Date(since) } : {}),
    };
    const [xp, posts, totalPosts] = await Promise.all([
      this.xp.forAccount(entry.username, xpConfig, now),
      this.posts
        .find({ username: entry.username, postedAt })
        .sort({ postedAt: -1 })
        .limit(BREAKDOWN_POSTS_LIMIT)
        .select(
          'postId url kind text threadTexts quotedUsername quotedText postedAt mediaType engagement',
        )
        .lean(),
      this.posts.countDocuments({ username: entry.username, postedAt }),
    ]);
    return {
      computedAt: snapshot.computedAt,
      period,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl ?? null,
      category: entry.category,
      level: levelForXp(entry.periods.all.xp, xpConfig).level,
      xp: entry.periods[period].xp,
      postsCounted: totalPosts,
      xpRules: this.xp.rules(xpConfig),
      posts: posts.map((post) => {
        const postXp = xp.posts.get(post.postId);
        return {
          postId: post.postId,
          url: post.url,
          kind: post.kind,
          text: post.text,
          threadTexts: post.threadTexts,
          quotedUsername: post.quotedUsername,
          quotedText: post.quotedText,
          postedAt: post.postedAt,
          mediaType: post.mediaType,
          engagement: post.engagement,
          xp: postXp
            ? {
                xp: postXp.xp,
                earnedXp: postXp.earnedXp,
                penaltyXp: postXp.penaltyXp,
                breakdown: postXp.breakdown,
                duplicateOf: postXp.duplicateOf,
                history: postXp.history,
              }
            : null,
        };
      }),
    };
  }

  /** The newest ranking, rebuilt when it was computed under other XP weights (or none). */
  private async currentSnapshot(xpConfig: XpConfig) {
    const latest = await this.snapshots.findOne().sort({ computedAt: -1 }).lean();
    return latest && latest.xpConfigVersion === xpConfig.version ? latest : this.recompute();
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
      .syncAndScore(
        dto.username,
        { niche: dto.niche, timezone: dto.timezone },
        { pages: existing?.lastSyncedAt ? REFRESH_PAGES : BACKFILL_PAGES },
      )
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
        await this.history.syncAndScore(
          account.username,
          { niche: account.niche ?? undefined, timezone },
          { pages: account.lastSyncedAt ? REFRESH_PAGES : BACKFILL_PAGES },
        );
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

    // Not gated on scoreStatus: XP is earned from engagement, and a post
    // counts the moment it's ingested, whether or not it has been (or ever
    // gets) scored. No date cutoff — "all time" is everything recorded.
    const usernames = [...candidates.keys()];
    const xpConfig = await this.xp.config();
    // One clock for the whole ranking, stored as computedAt, so a breakdown
    // recomputed "as of" the snapshot reproduces its XP exactly.
    const now = new Date();
    const [posts, comments, xp] = await Promise.all([
      this.posts
        .find({ username: { $in: usernames } })
        .select('postId username postedAt score.total_score engagement.replies')
        .lean(),
      this.comments
        .find({ username: { $in: usernames } })
        .select('username postedAt')
        .lean(),
      this.xp.forAccounts(usernames, xpConfig, now),
    ]);
    for (const comment of comments) {
      candidates.get(comment.username)?.comments.push({ postedAt: comment.postedAt });
    }
    for (const post of posts) {
      candidates.get(post.username)?.posts.push({
        postedAt: post.postedAt,
        totalScore: post.score?.total_score ?? 0,
        replies: post.engagement?.replies ?? 0,
        xp: xp.get(post.username)?.posts.get(post.postId)?.xp ?? 0,
      });
    }

    const entries: LeaderboardEntry[] = rankLeaderboard([...candidates.values()], now);
    const snapshot = await this.snapshots.create({
      computedAt: now,
      entries,
      xpConfigVersion: xpConfig.version,
    });
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
      comments: [] as LeaderboardCandidate['comments'],
    };
  }
}

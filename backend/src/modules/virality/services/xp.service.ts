import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  FXTWITTER_SIGNAL_AVAILABILITY,
  XP_AVAILABILITY_NOTE,
  buildAccountXp,
  type AccountXp,
  type PostXpResult,
  type XpConfig,
  type XpPostInput,
} from '../domain/xp';
import { ScoredPost } from '../schemas/scored-post.schema';
import { XpConfigService } from './xp-config.service';

export interface AccountXpResult {
  account: AccountXp;
  posts: Map<string, PostXpResult>;
}

const MILESTONES = ['h1', 'h24', 'd7'] as const;

@Injectable()
export class XpService {
  constructor(
    @InjectModel(ScoredPost.name) private readonly posts: Model<ScoredPost>,
    private readonly configs: XpConfigService,
  ) {}

  config(): Promise<XpConfig> {
    return this.configs.get();
  }

  /** The weights and data caveats the app shows next to XP; never shipped in the binary. */
  rules(config: XpConfig) {
    return {
      version: config.version,
      weights: config.weights,
      availability: FXTWITTER_SIGNAL_AVAILABILITY,
      note: XP_AVAILABILITY_NOTE,
      levelBaseXp: config.levelBaseXp,
      replierDecayWindowDays: config.replierDecayWindowDays,
      duplicateWindowDays: config.duplicateWindowDays,
    };
  }

  /** XP for every recorded post of each account, and their totals. */
  async forAccounts(
    usernames: string[],
    config?: XpConfig,
    now = new Date(),
  ): Promise<Map<string, AccountXpResult>> {
    const settings = config ?? (await this.configs.get());
    const posts = await this.posts
      .find({ username: { $in: usernames } })
      .select(
        'postId username postedAt text contentHash engagement engagementSnapshots authorDirectReplies authorReplies',
      )
      .lean();
    const byAccount = new Map<string, XpPostInput[]>(usernames.map((name) => [name, []]));
    for (const post of posts) {
      byAccount.get(post.username)?.push(this.toInput(post));
    }
    return new Map(
      [...byAccount].map(([username, inputs]) => {
        const { account, posts: results } = buildAccountXp(inputs, settings, now);
        return [
          username,
          { account, posts: new Map(results.map((result) => [result.postId, result])) },
        ];
      }),
    );
  }

  async forAccount(
    username: string,
    config?: XpConfig,
    now = new Date(),
  ): Promise<AccountXpResult> {
    const results = await this.forAccounts([username], config, now);
    return results.get(username) as AccountXpResult;
  }

  private toInput(
    post: Pick<
      ScoredPost,
      | 'postId'
      | 'postedAt'
      | 'text'
      | 'contentHash'
      | 'engagement'
      | 'engagementSnapshots'
      | 'authorDirectReplies'
      | 'authorReplies'
    >,
  ): XpPostInput {
    const snapshots = post.engagementSnapshots ?? {};
    return {
      postId: post.postId,
      postedAt: post.postedAt,
      text: post.text,
      contentHash: post.contentHash,
      engagement: post.engagement,
      readings: [
        ...MILESTONES.flatMap((milestone) => {
          const reading = snapshots[milestone];
          return reading
            ? [{ milestone, capturedAt: new Date(reading.capturedAt), engagement: reading }]
            : [];
        }),
        {
          milestone: 'latest' as const,
          capturedAt: new Date(post.engagement.capturedAt),
          engagement: post.engagement,
        },
      ],
      authorDirectReplies: post.authorDirectReplies ?? 0,
      authorReplies: post.authorReplies ?? {},
    };
  }
}

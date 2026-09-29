import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { PostingConsistencyModule } from '../posting-consistency/posting-consistency.module';
import { AdminTokenGuard } from './guards/admin-token.guard';
import { FeaturedAccount, FeaturedAccountSchema } from './schemas/featured-account.schema';
import {
  LeaderboardParticipant,
  LeaderboardParticipantSchema,
} from './schemas/leaderboard-participant.schema';
import {
  LeaderboardSnapshot,
  LeaderboardSnapshotSchema,
} from './schemas/leaderboard-snapshot.schema';
import { ScoredPost, ScoredPostSchema } from './schemas/scored-post.schema';
import { LeaderboardService } from './services/leaderboard.service';
import { PostHistoryService } from './services/post-history.service';
import { createViralityLlm, VIRALITY_LLM } from './services/llm-providers';
import { ViralityScorerService } from './services/virality-scorer.service';
import { ViralityAdminController, ViralityController } from './virality.controller';
import { ViralityJobs } from './virality.jobs';

/** POSTLOCK virality scores, pattern insights, and the leaderboard. */
@Module({
  imports: [
    PostingConsistencyModule,
    MongooseModule.forFeature([
      { name: ScoredPost.name, schema: ScoredPostSchema },
      { name: FeaturedAccount.name, schema: FeaturedAccountSchema },
      { name: LeaderboardParticipant.name, schema: LeaderboardParticipantSchema },
      { name: LeaderboardSnapshot.name, schema: LeaderboardSnapshotSchema },
    ]),
  ],
  controllers: [ViralityController, ViralityAdminController],
  providers: [
    { provide: VIRALITY_LLM, inject: [ConfigService], useFactory: createViralityLlm },
    ViralityScorerService,
    PostHistoryService,
    LeaderboardService,
    AdminTokenGuard,
    ViralityJobs,
  ],
})
export class ViralityModule {}

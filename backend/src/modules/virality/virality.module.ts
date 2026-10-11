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
import { XComment, XCommentSchema } from './schemas/x-comment.schema';
import { PostingChallenge, PostingChallengeSchema } from './schemas/posting-challenge.schema';
import { PushDevice, PushDeviceSchema } from './schemas/push-device.schema';
import { XpSettings, XpSettingsSchema } from './schemas/xp-settings.schema';
import { LeaderboardService } from './services/leaderboard.service';
import { PostHistoryService } from './services/post-history.service';
import { createViralityLlm, VIRALITY_LLM } from './services/llm-providers';
import { ViralityScorerService } from './services/virality-scorer.service';
import { ApnsService } from './services/apns.service';
import { ChallengeEventsService } from './services/challenge-events.service';
import { DuelAlertsService } from './services/duel-alerts.service';
import { PostingChallengesService } from './services/posting-challenges.service';
import { PushDevicesService } from './services/push-devices.service';
import { XpConfigService } from './services/xp-config.service';
import { XpService } from './services/xp.service';
import { ViralityAdminController, ViralityController } from './virality.controller';
import { ViralityJobs } from './virality.jobs';
// import { PostSuggestionsService } from './services/post-suggestions.service';

/** POSTLOCK virality scores, pattern insights, the leaderboard, and duel alerts. */
@Module({
  imports: [
    PostingConsistencyModule,
    MongooseModule.forFeature([
      { name: ScoredPost.name, schema: ScoredPostSchema },
      { name: PostingChallenge.name, schema: PostingChallengeSchema },
      { name: PushDevice.name, schema: PushDeviceSchema },
      { name: FeaturedAccount.name, schema: FeaturedAccountSchema },
      { name: LeaderboardParticipant.name, schema: LeaderboardParticipantSchema },
      { name: LeaderboardSnapshot.name, schema: LeaderboardSnapshotSchema },
      { name: XComment.name, schema: XCommentSchema },
      { name: XpSettings.name, schema: XpSettingsSchema },
    ]),
  ],
  controllers: [ViralityController, ViralityAdminController],
  providers: [
    { provide: VIRALITY_LLM, inject: [ConfigService], useFactory: createViralityLlm },
    ViralityScorerService,
    XpConfigService,
    XpService,
    PostHistoryService,
    LeaderboardService,
    ChallengeEventsService,
    ApnsService,
    PushDevicesService,
    DuelAlertsService,
    PostingChallengesService,
    AdminTokenGuard,
    ViralityJobs,
    // PostSuggestionsService, // Paused until live X research is available.
  ],
})
export class ViralityModule {}

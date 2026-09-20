import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  SocialAccount,
  SocialAccountSchema,
} from '../social-accounts/schemas/social-account.schema';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { PlatformsModule } from '../../platforms/platforms.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SourcePost, SourcePostSchema } from './schemas/source-post.schema';
import { VoiceProfile, VoiceProfileSchema } from './schemas/voice-profile.schema';
import { VoiceAnalysisService } from './voice-analysis.service';
import { VoiceProfilesController } from './voice-profiles.controller';
import { VoiceProfilesService } from './voice-profiles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourcePost.name, schema: SourcePostSchema },
      { name: VoiceProfile.name, schema: VoiceProfileSchema },
      { name: SocialAccount.name, schema: SocialAccountSchema },
    ]),
    SocialAccountsModule,
    PlatformsModule,
    WorkspacesModule,
  ],
  controllers: [VoiceProfilesController],
  providers: [VoiceAnalysisService, VoiceProfilesService],
  exports: [VoiceProfilesService],
})
export class VoiceProfilesModule {}

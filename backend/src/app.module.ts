import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CryptoModule } from './common/crypto/crypto.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { SocialAccountsModule } from './modules/social-accounts/social-accounts.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { VoiceProfilesModule } from './modules/voice-profiles/voice-profiles.module';
import { ContentModule } from './modules/content/content.module';
import { MediaModule } from './modules/media/media.module';
import { PostsModule } from './modules/posts/posts.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { AiModule } from './ai/ai.module';
import { AutomationModule } from './modules/automation/automation.module';
import { PublishingProvidersModule } from './modules/publishing-providers/publishing-providers.module';
import { PostingConsistencyModule } from './modules/posting-consistency/posting-consistency.module';
import { ViralityModule } from './modules/virality/virality.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CryptoModule,
    // A conservative baseline for the whole app; the public Developer API gets
    // its own per-plan, Redis-backed limits in build step 13.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    UsersModule,
    WorkspacesModule,
    AuthModule,
    SocialAccountsModule,
    AiModule,
    VoiceProfilesModule,
    MediaModule,
    ContentModule,
    PostsModule,
    SchedulesModule,
    EngagementModule,
    AutomationModule,
    PublishingProvidersModule,
    PostingConsistencyModule,
    ViralityModule,
  ],
  providers: [
    // Authenticated by default — routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}

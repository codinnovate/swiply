import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformsModule } from '../../platforms/platforms.module';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import {
  SocialAccount,
  SocialAccountSchema,
} from '../social-accounts/schemas/social-account.schema';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PostMetric, PostMetricSchema } from './schemas/post-metric.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostMetric.name, schema: PostMetricSchema },
      { name: SocialAccount.name, schema: SocialAccountSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    SocialAccountsModule,
    PlatformsModule,
    WorkspacesModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

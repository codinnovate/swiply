import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostMetric, PostMetricSchema } from '../analytics/schemas/post-metric.schema';

import { PlatformsModule } from '../../platforms/platforms.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MediaModule } from '../media/media.module';
import { SocialAccount, SocialAccountSchema } from './schemas/social-account.schema';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';
import { Post, PostSchema } from '../posts/schemas/post.schema';

/**
 * WorkspacesModule is imported for WorkspaceGuard and for the WorkspaceMember
 * model, which the callback needs to re-prove membership without a bearer token.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialAccount.name, schema: SocialAccountSchema },
      { name: Post.name, schema: PostSchema },
      { name: PostMetric.name, schema: PostMetricSchema },
    ]),
    WorkspacesModule,
    PlatformsModule,
    MediaModule,
  ],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}

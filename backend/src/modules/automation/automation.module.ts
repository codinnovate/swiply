import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ContentModule } from '../content/content.module';
import { MediaModule } from '../media/media.module';
import { PostsModule } from '../posts/posts.module';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { Schedule, ScheduleSchema } from '../schedules/schemas/schedule.schema';
import { EngagementRule, EngagementRuleSchema } from '../engagement/schemas/engagement-rule.schema';
import { SocialAccount, SocialAccountSchema } from '../social-accounts/schemas/social-account.schema';
import { AutomationAuditLog, AutomationAuditLogSchema } from './schemas/automation-audit-log.schema';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { BrandResearchService } from './brand-research.service';

@Module({
  imports: [
    WorkspacesModule,
    ContentModule,
    MediaModule,
    PostsModule,
    SocialAccountsModule,
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: EngagementRule.name, schema: EngagementRuleSchema },
      { name: SocialAccount.name, schema: SocialAccountSchema },
      { name: AutomationAuditLog.name, schema: AutomationAuditLogSchema },
    ]),
  ],
  controllers: [AutomationController],
  providers: [AutomationService, BrandResearchService],
  exports: [AutomationService],
})
export class AutomationModule {}

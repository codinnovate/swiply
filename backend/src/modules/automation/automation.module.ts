import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { Schedule, ScheduleSchema } from '../schedules/schemas/schedule.schema';
import { EngagementRule, EngagementRuleSchema } from '../engagement/schemas/engagement-rule.schema';
import { SocialAccount, SocialAccountSchema } from '../social-accounts/schemas/social-account.schema';
import { AutomationAuditLog, AutomationAuditLogSchema } from './schemas/automation-audit-log.schema';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({ imports: [WorkspacesModule, MongooseModule.forFeature([{ name: Schedule.name, schema: ScheduleSchema }, { name: EngagementRule.name, schema: EngagementRuleSchema }, { name: SocialAccount.name, schema: SocialAccountSchema }, { name: AutomationAuditLog.name, schema: AutomationAuditLogSchema }])], controllers: [AutomationController], providers: [AutomationService], exports: [AutomationService] })
export class AutomationModule {}

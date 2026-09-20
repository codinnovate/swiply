import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EngagementRule, EngagementRuleSchema } from './schemas/engagement-rule.schema';
import { InboundInteraction, InboundInteractionSchema } from './schemas/inbound-interaction.schema';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
@Module({ imports: [MongooseModule.forFeature([{ name: EngagementRule.name, schema: EngagementRuleSchema }, { name: InboundInteraction.name, schema: InboundInteractionSchema }]), WorkspacesModule], controllers: [EngagementController], providers: [EngagementService], exports: [MongooseModule, EngagementService] })
export class EngagementModule {}

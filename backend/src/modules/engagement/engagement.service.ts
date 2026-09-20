import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { ApiException } from '../../common/errors/api.exception';
import { EngagementRule, EngagementRuleDocument } from './schemas/engagement-rule.schema';
import { InboundInteraction, InboundInteractionDocument } from './schemas/inbound-interaction.schema';
import { UpsertEngagementRuleDto } from './dto/upsert-engagement-rule.dto';

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(EngagementRule.name) private readonly rules: Model<EngagementRuleDocument>,
    @InjectModel(InboundInteraction.name) private readonly interactions: Model<InboundInteractionDocument>,
  ) {}

  listRules(workspaceId: string) { return this.rules.find({ workspaceId: new Types.ObjectId(workspaceId) }).sort({ createdAt: -1 }).exec(); }
  createRule(workspaceId: string, dto: UpsertEngagementRuleDto) { return this.rules.create({ ...dto, workspaceId: new Types.ObjectId(workspaceId), socialAccountId: new Types.ObjectId(dto.socialAccountId), enabled: dto.enabled ?? false }); }
  async updateRule(workspaceId: string, id: string, dto: Partial<UpsertEngagementRuleDto>) { const rule = await this.findRule(workspaceId, id); Object.assign(rule, dto, dto.socialAccountId ? { socialAccountId: new Types.ObjectId(dto.socialAccountId) } : {}); return rule.save(); }
  async pauseRule(workspaceId: string, id: string) { const rule = await this.findRule(workspaceId, id); rule.enabled = false; return rule.save(); }
  listInteractions(workspaceId: string, status?: string, socialAccountId?: string) { return this.interactions.find({ workspaceId: new Types.ObjectId(workspaceId), ...(status ? { status } : {}), ...(socialAccountId ? { socialAccountId: new Types.ObjectId(socialAccountId) } : {}) }).sort({ createdAt: -1 }).limit(100).exec(); }
  async updateInteraction(workspaceId: string, id: string, generatedReplyText: string) { const item = await this.findInteraction(workspaceId, id); if (!['reply_generated', 'pending_review', 'flagged'].includes(item.status)) throw ApiException.unprocessable('ENGAGEMENT_CONFIGURATION_INVALID', 'This interaction can no longer be edited'); item.generatedReplyText = generatedReplyText; item.status = 'pending_review'; return item.save(); }
  async approveInteraction(workspaceId: string, id: string) { const item = await this.findInteraction(workspaceId, id); if (!item.generatedReplyText) throw ApiException.unprocessable('ENGAGEMENT_CONFIGURATION_INVALID', 'Generate or write a reply before approving'); item.status = 'replied'; return item.save(); }
  async skipInteraction(workspaceId: string, id: string) { const item = await this.findInteraction(workspaceId, id); item.status = 'skipped'; item.skipReason = 'user'; return item.save(); }
  private async findRule(workspaceId: string, id: string) { if (!isValidObjectId(id)) throw ApiException.notFound('Engagement rule'); const item = await this.rules.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).exec(); if (!item) throw ApiException.notFound('Engagement rule'); return item; }
  private async findInteraction(workspaceId: string, id: string) { if (!isValidObjectId(id)) throw ApiException.notFound('Interaction'); const item = await this.interactions.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).exec(); if (!item) throw ApiException.notFound('Interaction'); return item; }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from '../schedules/schemas/schedule.schema';
import { EngagementRule, EngagementRuleDocument } from '../engagement/schemas/engagement-rule.schema';
import { SocialAccount, SocialAccountDocument } from '../social-accounts/schemas/social-account.schema';
import { AutomationAuditLog, AutomationAuditLogDocument } from './schemas/automation-audit-log.schema';

@Injectable()
export class AutomationService {
  constructor(
    @InjectModel(Schedule.name) private readonly schedules: Model<ScheduleDocument>,
    @InjectModel(EngagementRule.name) private readonly rules: Model<EngagementRuleDocument>,
    @InjectModel(SocialAccount.name) private readonly accounts: Model<SocialAccountDocument>,
    @InjectModel(AutomationAuditLog.name) private readonly audit: Model<AutomationAuditLogDocument>,
  ) {}
  async status(workspaceId: string) { const id = new Types.ObjectId(workspaceId); const [activeSchedules, pausedSchedules, activeRules, needsReauth] = await Promise.all([this.schedules.countDocuments({ workspaceId: id, status: 'active' }), this.schedules.countDocuments({ workspaceId: id, status: 'paused' }), this.rules.countDocuments({ workspaceId: id, enabled: true }), this.accounts.countDocuments({ workspaceId: id, status: { $ne: 'active' } })]); return { activeSchedules, pausedSchedules, activeRules, needsReauth, paused: false }; }
  list(workspaceId: string, socialAccountId?: string, from?: string, to?: string) { const createdAt: Record<string, Date> = {}; if (from) createdAt.$gte = new Date(from); if (to) createdAt.$lte = new Date(to); return this.audit.find({ workspaceId: new Types.ObjectId(workspaceId), ...(socialAccountId ? { socialAccountId: new Types.ObjectId(socialAccountId) } : {}), ...(Object.keys(createdAt).length ? { createdAt } : {}) }).sort({ createdAt: -1 }).limit(200).exec(); }
  async pauseAll(workspaceId: string, userId: string) { const id = new Types.ObjectId(workspaceId); const [schedules, rules] = await Promise.all([this.schedules.updateMany({ workspaceId: id, status: 'active' }, { $set: { status: 'paused' } }), this.rules.updateMany({ workspaceId: id, enabled: true }, { $set: { enabled: false } })]); await this.audit.create({ workspaceId: id, socialAccountId: null, action: 'automation.paused', summary: 'All workspace automation was paused by a user', details: { schedules: schedules.modifiedCount, engagementRules: rules.modifiedCount }, actorUserId: new Types.ObjectId(userId) }); return { schedulesPaused: schedules.modifiedCount, engagementRulesPaused: rules.modifiedCount }; }
}

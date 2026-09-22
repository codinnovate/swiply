import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import { ContentService } from '../content/content.service';
import { EngagementRule, EngagementRuleDocument } from '../engagement/schemas/engagement-rule.schema';
import { MediaService } from '../media/media.service';
import { PostsService } from '../posts/posts.service';
import { Schedule, ScheduleDocument } from '../schedules/schemas/schedule.schema';
import { SocialAccount, SocialAccountDocument } from '../social-accounts/schemas/social-account.schema';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BrandResearchService } from './brand-research.service';
import { ResearchBrandDto, SaveAutomationDraftDto, StartAutomationDto, SuggestPostingTimesDto } from './dto/start-automation.dto';
import { buildPostingSlots } from './posting-slots';
import { isValidTimeZone, resizePostingTimes, timezoneForCountry } from './posting-times';
import { AutomationAuditLog, AutomationAuditLogDocument } from './schemas/automation-audit-log.schema';

@Injectable()
export class AutomationService {
  constructor(
    @InjectModel(Schedule.name) private readonly schedules: Model<ScheduleDocument>,
    @InjectModel(EngagementRule.name) private readonly rules: Model<EngagementRuleDocument>,
    @InjectModel(SocialAccount.name) private readonly accounts: Model<SocialAccountDocument>,
    @InjectModel(AutomationAuditLog.name) private readonly audit: Model<AutomationAuditLogDocument>,
    private readonly research: BrandResearchService,
    private readonly content: ContentService,
    private readonly media: MediaService,
    private readonly posts: PostsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async status(workspaceId: string) {
    const id = new Types.ObjectId(workspaceId);
    const [activeSchedules, pausedSchedules, activeRules, needsReauth] = await Promise.all([
      this.schedules.countDocuments({ workspaceId: id, status: 'active' }),
      this.schedules.countDocuments({ workspaceId: id, status: 'paused' }),
      this.rules.countDocuments({ workspaceId: id, enabled: true }),
      this.accounts.countDocuments({ workspaceId: id, status: { $ne: 'active' } }),
    ]);
    return { activeSchedules, pausedSchedules, activeRules, needsReauth, paused: false };
  }

  list(workspaceId: string, socialAccountId?: string, from?: string, to?: string) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    return this.audit
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        ...(socialAccountId ? { socialAccountId: new Types.ObjectId(socialAccountId) } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
  }

  async pauseAll(workspaceId: string, userId: string) {
    const id = new Types.ObjectId(workspaceId);
    const [schedules, rules] = await Promise.all([
      this.schedules.updateMany({ workspaceId: id, status: 'active' }, { $set: { status: 'paused' } }),
      this.rules.updateMany({ workspaceId: id, enabled: true }, { $set: { enabled: false } }),
    ]);
    await this.audit.create({
      workspaceId: id,
      socialAccountId: null,
      action: 'automation.paused',
      summary: 'All workspace automation was paused by a user',
      details: { schedules: schedules.modifiedCount, engagementRules: rules.modifiedCount },
      actorUserId: new Types.ObjectId(userId),
    });
    return { schedulesPaused: schedules.modifiedCount, engagementRulesPaused: rules.modifiedCount };
  }

  async get(workspaceId: string, id: string) {
    const schedule = await this.schedules
      .findOne({ _id: new Types.ObjectId(id), workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!schedule) throw ApiException.notFound('Automation');
    return schedule;
  }

  async saveDraft(workspaceId: string, userId: string, dto: SaveAutomationDraftDto) {
    const schedule = await this.upsertSchedule(workspaceId, dto, 'draft');
    await this.audit.create({
      workspaceId: new Types.ObjectId(workspaceId),
      socialAccountId: schedule.socialAccountIds[0] || null,
      action: 'automation.draft',
      summary: `Saved draft for ${schedule.websiteUrl || dto.websiteUrl}`,
      details: { scheduleId: schedule.id },
      actorUserId: new Types.ObjectId(userId),
    });
    return schedule;
  }

  researchBrand(workspaceId: string, userId: string, dto: ResearchBrandDto) {
    return this.research.research(workspaceId, userId, dto.websiteUrl);
  }

  async suggestPostingTimes(workspaceId: string, userId: string, dto: SuggestPostingTimesDto) {
    const workspace = await this.workspaces.findByIdOrFail(workspaceId);
    return this.research.suggestPostingTimes(userId, {
      ...dto,
      timeZone: dto.timeZone || workspace.timezone || 'UTC',
    });
  }

  async start(workspaceId: string, userId: string, dto: StartAutomationDto) {
    const account = await this.requireTiktokAccount(workspaceId, dto.socialAccountId);
    const researched = await this.resolveResearch(workspaceId, userId, dto);
    const assets = await this.media.listImages(workspaceId);
    if (assets.length < 2) {
      throw ApiException.unprocessable(
        'AUTOMATION_ASSETS_REQUIRED',
        'Upload at least two images to the media library. Slideshows are picked from those automatically.',
      );
    }

    const workspace = await this.workspaces.findByIdOrFail(workspaceId);
    const timesOfDay = resizePostingTimes(dto.timesOfDay, dto.postsPerPeriod);
    const timeZone = isValidTimeZone(dto.timeZone || '')
      ? dto.timeZone!
      : timezoneForCountry(dto.targetCountry, workspace.timezone || 'UTC');
    const slots = buildPostingSlots({
      cadence: dto.cadence,
      timesOfDay,
      postsPerPeriod: dto.postsPerPeriod,
      timeZone,
    }).slice(0, 7);
    if (!slots.length) {
      throw ApiException.unprocessable(
        'SCHEDULE_CONFIGURATION_INVALID',
        'Those times do not produce a future posting slot. Pick a later time.',
      );
    }

    const existing = dto.scheduleId ? await this.get(workspaceId, dto.scheduleId) : null;
    const wasDraft = !existing || existing.status === 'draft';
    const schedule = await this.upsertSchedule(
      workspaceId,
      { ...dto, productName: researched.productName, websiteBrief: researched.websiteBrief, tiktokInsights: researched.tiktokInsights },
      'active',
      researched,
    );

    const queued = [];
    if (wasDraft) {
      for (const [index, scheduledFor] of slots.entries()) {
        const angle = researched.suggestedAngles[index % Math.max(1, researched.suggestedAngles.length)];
        const topic = [researched.productName, angle || researched.oneLiner].filter(Boolean).join(': ');
        const item = await this.content.generate(workspaceId, userId, {
          type: 'slideshow',
          goal: 'traffic',
          topic,
          socialAccountId: dto.socialAccountId,
          aiModel: dto.aiModel,
          imageSource: 'user_provided',
          randomizeSlides: true,
          websiteBrief: researched.websiteBrief,
          tiktokInsights: researched.tiktokInsights,
          targetCountry: dto.targetCountry?.trim() || undefined,
          language: dto.language?.trim() || 'English',
          providedImageUrls: assets.map((asset) => asset.url),
          providedMediaAssetIds: assets.map((asset) => asset.id),
        });
        const post = await this.posts.create(workspaceId, {
          contentId: String(item.id || item._id),
          socialAccountId: dto.socialAccountId,
          scheduledFor: scheduledFor.toISOString(),
        });
        queued.push({
          contentId: String(item.id || item._id),
          postId: String(post.id || post._id),
          scheduledFor,
        });
      }
    }

    await this.audit.create({
      workspaceId: new Types.ObjectId(workspaceId),
      socialAccountId: account._id,
      action: wasDraft ? 'content_published' : 'automation.updated',
      summary: wasDraft
        ? `Queued ${queued.length} TikTok slideshows from ${dto.websiteUrl}`
        : `Updated automation for ${dto.websiteUrl}`,
      details: { scheduleId: schedule.id, posts: queued.length },
      actorUserId: new Types.ObjectId(userId),
    });

    return {
      schedule,
      queued: queued.length,
      posts: queued,
      research: {
        productName: researched.productName,
        websiteBrief: researched.websiteBrief,
        tiktokInsights: researched.tiktokInsights,
      },
    };
  }

  async sendTestPost(workspaceId: string, userId: string, scheduleId: string) {
    const schedule = await this.get(workspaceId, scheduleId);
    const socialAccountId = String(schedule.socialAccountIds[0] || '');
    if (!socialAccountId) {
      throw ApiException.unprocessable(
        'AUTOMATION_TIKTOK_REQUIRED',
        'Choose a TikTok account on this automation before sending a test post',
      );
    }
    const account = await this.requireTiktokAccount(workspaceId, socialAccountId);
    const researched = this.researchFromSchedule(schedule);
    if (!researched || !schedule.websiteUrl) {
      throw ApiException.unprocessable(
        'BRAND_RESEARCH_FAILED',
        'Save website research on this automation before sending a test post',
      );
    }
    const assets = await this.media.listImages(workspaceId);
    if (assets.length < 2) {
      throw ApiException.unprocessable(
        'AUTOMATION_ASSETS_REQUIRED',
        'Upload at least two images to the media library. Slideshows are picked from those automatically.',
      );
    }
    const angle = researched.suggestedAngles[0] || researched.oneLiner;
    const topic = [researched.productName, angle].filter(Boolean).join(': ');
    const item = await this.content.generate(workspaceId, userId, {
      type: 'slideshow',
      goal: 'traffic',
      topic,
      socialAccountId,
      imageSource: 'user_provided',
      randomizeSlides: true,
      websiteBrief: researched.websiteBrief,
      tiktokInsights: researched.tiktokInsights,
      targetCountry: schedule.targetCountry || undefined,
      language: schedule.language || 'English',
      providedImageUrls: assets.map((asset) => asset.url),
      providedMediaAssetIds: assets.map((asset) => asset.id),
    });
    const post = await this.posts.create(workspaceId, {
      contentId: String(item.id || item._id),
      socialAccountId,
      scheduleId: String(schedule._id),
      scheduledFor: new Date(Date.now() + 90_000).toISOString(),
      publishNow: true,
    });
    await this.audit.create({
      workspaceId: new Types.ObjectId(workspaceId),
      socialAccountId: account._id,
      action: 'automation.test_post',
      summary: `Sent a test TikTok slideshow for ${schedule.websiteUrl}`,
      details: { scheduleId: String(schedule._id), contentId: String(item.id || item._id) },
      actorUserId: new Types.ObjectId(userId),
    });
    return { content: item, post };
  }

  private researchFromSchedule(schedule: ScheduleDocument) {
    const stored = schedule.brandResearch || {};
    const websiteBrief = String(stored.websiteBrief || schedule.websiteBrief || '');
    const tiktokInsights = String(stored.tiktokInsights || schedule.tiktokInsights || '');
    if (!websiteBrief || !tiktokInsights) return null;
    return {
      productName: String(stored.productName || schedule.name || ''),
      oneLiner: String(stored.oneLiner || websiteBrief.slice(0, 180)),
      audience: String(stored.audience || ''),
      valueProps: Array.isArray(stored.valueProps) ? stored.valueProps.map(String) : [],
      suggestedAngles: Array.isArray(stored.suggestedAngles) ? stored.suggestedAngles.map(String) : [],
      competitors: Array.isArray(stored.competitors) ? stored.competitors.map(String) : [],
      competitorAccounts: Array.isArray(stored.competitorAccounts)
        ? stored.competitorAccounts.map(String)
        : [],
      websiteBrief,
      tiktokInsights,
    };
  }

  private async requireTiktokAccount(workspaceId: string, socialAccountId: string) {
    const account = await this.accounts
      .findOne({
        _id: new Types.ObjectId(socialAccountId),
        workspaceId: new Types.ObjectId(workspaceId),
        status: 'active',
      })
      .exec();
    if (!account) throw ApiException.notFound('Social account');
    if (account.platform !== 'tiktok') {
      throw ApiException.unprocessable(
        'AUTOMATION_TIKTOK_REQUIRED',
        'TikTok automation posts slideshows to a connected TikTok account',
      );
    }
    return account;
  }

  private async resolveResearch(workspaceId: string, userId: string, dto: StartAutomationDto | SaveAutomationDraftDto) {
    if (dto.websiteBrief && dto.tiktokInsights) {
      return {
        productName: dto.productName || new URL(dto.websiteUrl).hostname.replace(/^www\./, ''),
        oneLiner: 'oneLiner' in dto && dto.oneLiner ? dto.oneLiner : dto.websiteBrief.slice(0, 180),
        audience: 'audience' in dto ? dto.audience || '' : '',
        valueProps: 'valueProps' in dto ? dto.valueProps || [] : [],
        suggestedAngles: 'suggestedAngles' in dto ? dto.suggestedAngles || [] : [],
        competitors: 'competitors' in dto ? dto.competitors || [] : [],
        competitorAccounts: 'competitorAccounts' in dto ? dto.competitorAccounts || [] : [],
        websiteBrief: dto.websiteBrief,
        tiktokInsights: dto.tiktokInsights,
      };
    }
    return this.research.research(workspaceId, userId, dto.websiteUrl);
  }

  private async upsertSchedule(
    workspaceId: string,
    dto: SaveAutomationDraftDto | StartAutomationDto,
    status: 'draft' | 'active',
    researched?: {
      productName: string;
      oneLiner: string;
      websiteBrief: string;
      tiktokInsights: string;
      suggestedAngles?: string[];
      competitors?: string[];
      competitorAccounts?: string[];
      audience?: string;
      valueProps?: string[];
    },
  ) {
    const workspace = await this.workspaces.findByIdOrFail(workspaceId);
    const cadence = dto.cadence || 'daily';
    const postsPerPeriod = dto.postsPerPeriod || 1;
    const timesOfDay = resizePostingTimes(dto.timesOfDay || [], postsPerPeriod);
    const timeZone = isValidTimeZone(dto.timeZone || '')
      ? dto.timeZone!
      : timezoneForCountry(dto.targetCountry, workspace.timezone || 'UTC');
    const productName =
      researched?.productName ||
      dto.productName ||
      new URL(dto.websiteUrl).hostname.replace(/^www\./, '');
    let socialAccountIds: Types.ObjectId[] = [];
    if (dto.socialAccountId) {
      const account = await this.accounts
        .findOne({
          _id: new Types.ObjectId(dto.socialAccountId),
          workspaceId: new Types.ObjectId(workspaceId),
        })
        .exec();
      if (account) socialAccountIds = [account._id];
    }
    const brandResearch = researched
      ? {
          productName,
          oneLiner: researched.oneLiner,
          audience: researched.audience || '',
          valueProps: researched.valueProps || [],
          websiteBrief: researched.websiteBrief,
          tiktokInsights: researched.tiktokInsights,
          suggestedAngles: researched.suggestedAngles || [],
          competitors: researched.competitors || [],
          competitorAccounts: researched.competitorAccounts || [],
          websiteUrl: dto.websiteUrl,
        }
      : dto.websiteBrief && dto.tiktokInsights
        ? {
            productName,
            oneLiner: dto.oneLiner || dto.websiteBrief.slice(0, 180),
            audience: dto.audience || '',
            valueProps: dto.valueProps || [],
            websiteBrief: dto.websiteBrief,
            tiktokInsights: dto.tiktokInsights,
            suggestedAngles: dto.suggestedAngles || [],
            competitors: dto.competitors || [],
            competitorAccounts: dto.competitorAccounts || [],
            websiteUrl: dto.websiteUrl,
          }
        : null;
    const fields = {
      name: `${productName} TikTok slideshows`,
      ...(socialAccountIds.length ? { socialAccountIds } : {}),
      contentTypeMix: { slideshow: 1, video: 0, post: 0 },
      mode: cadence === 'daily' ? 'volume' : 'fixed_days',
      fixedDays:
        cadence === 'weekly'
          ? {
              postsPerWeek: postsPerPeriod,
              daysOfWeek: postsPerPeriod === 7 ? [0, 1, 2, 3, 4, 5, 6] : [1, 3, 5].slice(0, postsPerPeriod),
              timeOfDay: timesOfDay[0],
            }
          : null,
      volume:
        cadence === 'daily'
          ? {
              postsPerMonth: postsPerPeriod * 30,
              postingWindows: timesOfDay.map((time) => {
                const hour = Number(time.split(':')[0]);
                return { startHour: hour, endHour: Math.min(24, hour + 1) };
              }),
              minGapMinutes: postsPerPeriod >= 4 ? 45 : 180,
              jitterMinutes: 20,
            }
          : null,
      endDate: null,
      contentSource: 'ai_autogenerate',
      autoGeneratePrompt: researched?.websiteBrief || dto.websiteBrief || null,
      websiteUrl: dto.websiteUrl,
      websiteBrief: researched?.websiteBrief || dto.websiteBrief || null,
      tiktokInsights: researched?.tiktokInsights || dto.tiktokInsights || null,
      cadence,
      timesOfDay,
      postsPerPeriod,
      targetCountry: dto.targetCountry?.trim() || null,
      language: dto.language?.trim() || 'English',
      postingTimeZone: timeZone,
      brandResearch,
      defaultGoal: 'traffic',
      defaultImageSource: 'user_provided',
      autopilot: true,
      status,
    };

    if (dto.scheduleId) {
      const current = await this.get(workspaceId, dto.scheduleId);
      if (status === 'draft' && current.status !== 'draft') {
        delete (fields as { status?: string }).status;
      }
      current.set(fields);
      return current.save();
    }
    return this.schedules.create({
      workspaceId: new Types.ObjectId(workspaceId),
      socialAccountIds,
      ...fields,
    });
  }
}

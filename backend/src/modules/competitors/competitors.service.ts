import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import { ApiException } from '../../common/errors/api.exception';
import {
  hashtagStats,
  rankAdsForCompany,
  resolveTiktokHandle,
  summarize,
  weeklyPerformance,
} from './domain/competitor-analysis';
import {
  CompetitorProfileNotFoundError,
  SUPPORTED_NETWORKS,
  TIKTOK_AD_SOURCE,
  TIKTOK_VIDEO_SOURCE,
  type CompetitorAd,
  type CompetitorAdSource,
  type CompetitorReportData,
  type CompetitorVideoSource,
  type ProfileVideos,
  type SourceStatus,
} from './domain/competitor.types';
import type { ResearchCompetitorDto } from './dto/research-competitor.dto';
import { CompetitorReport, CompetitorReportDocument } from './schemas/competitor-report.schema';

/** Reports younger than this are served from Mongo so repeat views don't spend Apify credit. */
export const REPORT_CACHE_MS = 6 * 60 * 60 * 1000;

export type CompetitorReportView = CompetitorReportData & { id: string; cached: boolean };

export interface CompetitorListItem {
  id: string;
  network: string;
  company: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number | null;
  videosAnalyzed: number;
  adsFound: number;
  fetchedAt: string;
}

export interface CompetitorSourceAvailability {
  network: string;
  videos: boolean;
  ads: boolean;
}

@Injectable()
export class CompetitorsService {
  private readonly logger = new Logger(CompetitorsService.name);

  constructor(
    @InjectModel(CompetitorReport.name) private readonly reports: Model<CompetitorReportDocument>,
    @Inject(TIKTOK_VIDEO_SOURCE) private readonly videoSource: CompetitorVideoSource,
    @Inject(TIKTOK_AD_SOURCE) private readonly adSource: CompetitorAdSource,
    private readonly config: ConfigService,
  ) {}

  sources(): CompetitorSourceAvailability[] {
    return [{ network: 'tiktok', videos: this.videoSource.isConfigured(), ads: this.adSource.isConfigured() }];
  }

  async list(workspaceId: string): Promise<CompetitorListItem[]> {
    const docs = await this.reports
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return docs.map((doc) => ({
      id: String(doc._id),
      network: doc.network,
      company: doc.company,
      handle: doc.handle,
      displayName: doc.report.profile?.displayName ?? doc.company,
      avatarUrl: doc.report.profile?.avatarUrl ?? null,
      followers: doc.report.profile?.followers ?? null,
      videosAnalyzed: doc.report.summary.videosAnalyzed,
      adsFound: doc.report.ads.length,
      fetchedAt: doc.fetchedAt.toISOString(),
    }));
  }

  async get(workspaceId: string, id: string): Promise<CompetitorReportView> {
    const doc = isValidObjectId(id)
      ? await this.reports.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).lean().exec()
      : null;
    if (!doc) throw ApiException.notFound('Competitor report', { id });
    return { ...doc.report, id: String(doc._id), cached: true };
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const result = isValidObjectId(id)
      ? await this.reports.deleteOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).exec()
      : { deletedCount: 0 };
    if (!result.deletedCount) throw ApiException.notFound('Competitor report', { id });
  }

  async research(
    workspaceId: string,
    userId: string,
    dto: ResearchCompetitorDto,
    now = new Date(),
  ): Promise<CompetitorReportView> {
    const network = dto.network ?? 'tiktok';
    if (!SUPPORTED_NETWORKS.includes(network)) {
      throw ApiException.unprocessable(
        'COMPETITOR_NETWORK_UNSUPPORTED',
        `Competitor analysis for ${network} isn't available yet. TikTok is supported today.`,
        { network },
      );
    }
    const handle = resolveTiktokHandle(dto.company, dto.handle);
    if (!handle) {
      throw ApiException.unprocessable(
        'COMPETITOR_HANDLE_INVALID',
        'Enter the TikTok username for this company (letters, numbers, dots and underscores).',
        { company: dto.company, handle: dto.handle ?? null },
      );
    }
    const videosReady = this.videoSource.isConfigured();
    const adsReady = this.adSource.isConfigured();
    if (!videosReady && !adsReady) {
      throw new ApiException(
        'COMPETITOR_RESEARCH_NOT_CONFIGURED',
        'Competitor analysis needs APIFY_TOKEN (TikTok videos) or TikTok Ad Library credentials on the server.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const workspace = new Types.ObjectId(workspaceId);
    if (!dto.refresh) {
      const cached = await this.reports.findOne({ workspaceId: workspace, network, handle }).lean().exec();
      if (cached && now.getTime() - cached.fetchedAt.getTime() < REPORT_CACHE_MS) {
        return { ...cached.report, id: String(cached._id), cached: true };
      }
    }

    // An @handle or URL typed as the "company" is a poor Ad Library search term.
    const looksLikeHandle = /^@|tiktok\.com\//i.test(dto.company);
    const company = looksLikeHandle ? handle : dto.company;
    const limit = this.config.get<number>('research.competitorVideoLimit', 40);
    const [videoResult, adResult] = await Promise.allSettled([
      videosReady ? this.videoSource.fetchProfileVideos(handle, limit) : Promise.resolve(null),
      adsReady ? this.adSource.searchAds(company) : Promise.resolve(null),
    ]);

    const videoStatus = statusOf(videoResult, videosReady, (value) => value.videos.length > 0);
    const adStatus = statusOf(adResult, adsReady, (value) => value.length > 0);
    const profileVideos: ProfileVideos | null = videoResult.status === 'fulfilled' ? videoResult.value : null;
    const ads: CompetitorAd[] = adResult.status === 'fulfilled' && adResult.value ? rankAdsForCompany(adResult.value, company) : [];
    for (const [name, result] of [['videos', videoResult], ['ads', adResult]] as const) {
      if (result.status === 'rejected' && !(result.reason instanceof CompetitorProfileNotFoundError)) {
        this.logger.warn(`Competitor ${name} source failed for @${handle}: ${describe(result.reason)}`);
      }
    }

    const profileMissing = videoResult.status === 'rejected' && videoResult.reason instanceof CompetitorProfileNotFoundError;
    if (profileMissing && !ads.length) {
      throw new ApiException(
        'COMPETITOR_PROFILE_NOT_FOUND',
        `We couldn't find a public TikTok profile at @${handle}. Enter the company's exact TikTok username.`,
        HttpStatus.NOT_FOUND,
        { handle },
      );
    }
    if (![videoStatus, adStatus].some((status) => status.state === 'ok' || status.state === 'empty')) {
      throw new ApiException(
        'COMPETITOR_RESEARCH_FAILED',
        videoStatus.message || adStatus.message || 'Competitor research failed. Try again in a minute.',
        HttpStatus.BAD_GATEWAY,
        { videos: videoStatus, ads: adStatus },
      );
    }

    const videos = profileVideos?.videos ?? [];
    const hashtags = hashtagStats(videos);
    const report: CompetitorReportData = {
      network,
      company: looksLikeHandle ? profileVideos?.profile?.displayName || handle : dto.company,
      handle,
      profile: profileVideos?.profile ?? null,
      summary: summarize(videos, hashtags),
      hashtags,
      videos,
      ads,
      performance: weeklyPerformance(videos),
      sources: { videos: videoStatus, ads: adStatus },
      fetchedAt: now.toISOString(),
    };
    const saved = await this.reports
      .findOneAndUpdate(
        { workspaceId: workspace, network, handle },
        {
          $set: {
            company: report.company,
            report,
            fetchedAt: now,
            requestedBy: isValidObjectId(userId) ? new Types.ObjectId(userId) : null,
          },
        },
        { upsert: true, new: true, lean: true },
      )
      .exec();
    return { ...report, id: String(saved?._id), cached: false };
  }
}

function statusOf<T>(
  result: PromiseSettledResult<T | null>,
  configured: boolean,
  hasData: (value: T) => boolean,
): SourceStatus {
  if (!configured) return { state: 'not_configured' };
  if (result.status === 'rejected') {
    if (result.reason instanceof CompetitorProfileNotFoundError) {
      return { state: 'failed', message: result.reason.message };
    }
    return { state: 'failed', message: describe(result.reason) };
  }
  return result.value && hasData(result.value) ? { state: 'ok' } : { state: 'empty' };
}

function describe(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.name === 'TimeoutError' ? 'The source took too long to respond.' : reason.message;
  }
  return 'Unknown error';
}

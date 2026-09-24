import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { AiCredentialsService } from '../../ai/ai-credentials.service';
import { AiProviderRegistry } from '../../ai/ai-provider-registry.service';
import { ApiException } from '../../common/errors/api.exception';
import { formatTiktokEvidence, searchTiktokViaApi } from './competitor-search';
import { SuggestPostingTimesDto } from './dto/start-automation.dto';
import {
  isValidTimeZone,
  normalizeHhmm,
  resizePostingTimes,
  timezoneForCountry,
} from './posting-times';
import {
  assertPublicHttpUrl,
  extractWebsiteText,
  formatWebsiteCorpus,
} from './website-text';

const researchSchema = z.object({
  productName: z.string().min(1),
  oneLiner: z.string().min(1),
  audience: z.string().min(1),
  valueProps: z.array(z.string()).max(8),
  websiteBrief: z.string().min(1),
  competitors: z.array(z.string()).max(8),
  tiktokInsights: z.string().min(1),
  suggestedAngles: z.array(z.string()).max(8),
  competitorAccounts: z.array(z.string()).max(8),
});

const postingTimesSchema = z.object({
  times: z.array(z.string().min(4).max(8)).min(1).max(7),
  timeZone: z.string().min(1),
  rationale: z.string().min(1),
});

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function clipList(values: string[], max: number) {
  return values.map((item) => clip(item, max)).filter(Boolean);
}

@Injectable()
export class BrandResearchService {
  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly providers: AiProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  async research(_workspaceId: string, userId: string, websiteUrl: string) {
    const url = assertPublicHttpUrl(websiteUrl);
    const [{ corpus, extracted }, credential] = await Promise.all([
      this.fetchWebsite(url),
      this.credentials.resolve(userId),
    ]);
    const evidence = await this.scanTiktokCompetitors(url.hostname, extracted.title, extracted.headings);
    const researched = await this.providers.completeStructured(
      credential.provider,
      credential.apiKey,
      userId,
      credential.model,
      {
        maxTokens: 8192,
        system:
          'You are researching a product so Swiply can post TikTok Photo Mode slideshows. ' +
          'First learn the business from the website copy. Then use the TikTok posts (captions, accounts, play/like counts) to describe how competitors in that niche post — hooks, listicles, before/after, wait-for-it closes — and how this product can beat them without copying captions. ' +
          'Name real @accounts from the evidence. Do not invent view counts. If evidence is thin, say so. ' +
          'Keep suggestedAngles to one punchy sentence each (under 140 characters). Keep valueProps short. ' +
          'Return JSON with keys: productName, oneLiner, audience, valueProps (string[]), websiteBrief, competitors (string[]), tiktokInsights, suggestedAngles (string[]), competitorAccounts (string[] of @handles). Use empty arrays when unknown.',
        user:
          'Website URL: ' +
          url.toString() +
          '\n\nExtracted website copy:\n' +
          corpus +
          '\n\nTikTok posts currently ranking in this niche:\n' +
          (evidence || 'No TikTok posts were returned for this niche.'),
      },
      researchSchema,
    );

    return {
      ...researched,
      productName: clip(researched.productName, 160),
      oneLiner: clip(researched.oneLiner, 400),
      audience: clip(researched.audience, 2000),
      websiteBrief: clip(researched.websiteBrief, 8000),
      tiktokInsights: clip(researched.tiktokInsights, 4000),
      valueProps: clipList(researched.valueProps, 400),
      competitors: clipList(researched.competitors, 120),
      suggestedAngles: clipList(researched.suggestedAngles, 500),
      competitorAccounts: clipList(researched.competitorAccounts, 80),
      websiteUrl: url.toString(),
      model: credential.model,
    };
  }

  async suggestPostingTimes(userId: string, dto: SuggestPostingTimesDto) {
    const fallbackZone = timezoneForCountry(dto.targetCountry, dto.timeZone || 'UTC');
    const fallback = {
      times: resizePostingTimes([], dto.postsPerPeriod),
      timeZone: fallbackZone,
      rationale: `Peak TikTok windows in ${dto.targetCountry} — morning commute, lunch, after work, and evening scroll.`,
    };
    try {
      const credential = await this.credentials.resolve(userId);
      const researched = await this.providers.completeStructured(
        credential.provider,
        credential.apiKey,
        userId,
        credential.model,
        {
          maxTokens: 800,
          system:
            'You pick TikTok Photo Mode posting times for a specific country. ' +
            'Times are local wall-clock in 24-hour HH:mm. Spread them so they do not collide. ' +
            'Prefer proven short-form peaks for that market (commute, lunch, after school/work, prime evening). ' +
            'Return JSON with times (string[]), timeZone (IANA), rationale (one sentence).',
          user: [
            `Country: ${dto.targetCountry}`,
            `Cadence: ${dto.postsPerPeriod}× ${dto.cadence}`,
            `Workspace timezone hint: ${dto.timeZone || 'unknown'}`,
            dto.tiktokInsights ? `Competitor TikTok patterns:\n${dto.tiktokInsights}` : '',
            `Return exactly ${dto.postsPerPeriod} times.`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
        postingTimesSchema,
      );
      const times = resizePostingTimes(
        researched.times.map((time) => normalizeHhmm(time) ?? '').filter(Boolean),
        dto.postsPerPeriod,
      );
      return {
        times,
        timeZone: isValidTimeZone(researched.timeZone) ? researched.timeZone : fallbackZone,
        rationale: researched.rationale.trim(),
      };
    } catch {
      return fallback;
    }
  }

  private async scanTiktokCompetitors(hostname: string, title: string, headings: string[]) {
    const apiKey = this.config.get<string>('research.tikapiKey')?.trim();
    if (!apiKey) {
      throw ApiException.unprocessable(
        'TIKTOK_RESEARCH_NOT_CONFIGURED',
        'Add a TikAPI key (TIKAPI_KEY) so Swiply can search TikTok for competitors. Official TikTok APIs cannot do this.',
      );
    }
    const host = hostname.replace(/^www\./, '');
    const query = [title, headings[0], host.replace(/\.[a-z]{2,}$/i, '')]
      .map((value) => value?.replace(/\s+/g, ' ').trim())
      .find((value) => value && value.length > 2);
    if (!query) return '';
    const hashtag = query.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
    const posts = await searchTiktokViaApi({
      apiKey,
      query,
      hashtag: hashtag.length >= 3 ? hashtag : undefined,
      sandbox: this.config.get<boolean>('research.tikapiSandbox') === true,
    });
    return formatTiktokEvidence(posts);
  }

  private async fetchWebsite(url: URL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'SwiplyBot/1.0 (+https://swiply.app)' },
      });
      if (!response.ok) {
        throw ApiException.unprocessable(
          'BRAND_RESEARCH_FAILED',
          'Could not read that website. Check the URL and try again.',
        );
      }
      const html = (await response.text()).slice(0, 500_000);
      const extracted = extractWebsiteText(html);
      const corpus = formatWebsiteCorpus(extracted);
      if (corpus.length < 40) {
        throw ApiException.unprocessable(
          'BRAND_RESEARCH_FAILED',
          'That page did not have enough text to learn the product.',
        );
      }
      return { corpus, extracted };
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw ApiException.unprocessable(
        'BRAND_RESEARCH_FAILED',
        'Could not read that website. Check the URL and try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

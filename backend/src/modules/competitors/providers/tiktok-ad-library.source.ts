import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { CompetitorAd, CompetitorAdSource } from '../domain/competitor.types';

const TIKTOK_API = 'https://open.tiktokapis.com';
const AD_FIELDS = [
  'ad.id',
  'ad.first_shown_date',
  'ad.last_shown_date',
  'ad.status',
  'ad.videos',
  'ad.image_urls',
  'ad.reach',
  'advertiser.business_id',
  'advertiser.business_name',
  'advertiser.paid_for_by',
].join(',');
/** How far back to look. The library itself starts on 2022-10-01. */
const LOOKBACK_DAYS = 365;
const PAGE_SIZE = 50;
const MAX_PAGES = 2;

export interface TiktokAdLibraryAd {
  ad?: {
    id?: number | string;
    first_shown_date?: string;
    last_shown_date?: string;
    status?: string;
    videos?: Array<{ url?: string }>;
    image_urls?: string[];
    reach?: { unique_users_seen?: string };
  };
  advertiser?: {
    business_id?: number | string;
    business_name?: string;
    paid_by?: string;
    paid_for_by?: string;
  };
}

interface QueryResponse {
  data?: { ads?: TiktokAdLibraryAd[]; has_more?: boolean; search_id?: string };
  error?: { code?: string; message?: string };
}

/**
 * TikTok's official Ad Library (Commercial Content API). Free once TikTok
 * approves a research client; it covers ads shown in the EEA, Switzerland and
 * the UK, which is where the DSA requires TikTok to publish them.
 */
@Injectable()
export class TiktokAdLibrarySource implements CompetitorAdSource {
  private readonly logger = new Logger(TiktokAdLibrarySource.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('research.tiktokAdLibraryClientKey') &&
        this.config.get<string>('research.tiktokAdLibraryClientSecret'),
    );
  }

  async searchAds(company: string, now = new Date()): Promise<CompetitorAd[]> {
    const token = await this.accessToken();
    const countries = this.config.get<string[]>('research.tiktokAdLibraryCountries', []);
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
    const ads: CompetitorAd[] = [];
    let searchId: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL('/v2/research/adlib/ad/query/', TIKTOK_API);
      url.searchParams.set('fields', AD_FIELDS);
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: {
            ad_published_date_range: { min: yyyymmdd(since), max: yyyymmdd(now) },
            ...(countries.length ? { country_code_list: countries } : {}),
          },
          search_term: company,
          search_type: 'fuzzy_phrase',
          max_count: PAGE_SIZE,
          ...(searchId ? { search_id: searchId } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as QueryResponse;
      if (!response.ok || (body.error?.code && body.error.code !== 'ok')) {
        this.logger.warn(`Ad Library query failed with ${response.status}: ${body.error?.code} ${body.error?.message}`);
        if (response.status === 401) this.token = null;
        throw new Error(body.error?.message || `The TikTok Ad Library failed (HTTP ${response.status}).`);
      }
      ads.push(...(body.data?.ads ?? []).map(toAd).filter((ad): ad is CompetitorAd => ad !== null));
      if (!body.data?.has_more || !body.data.search_id) break;
      searchId = body.data.search_id;
    }
    return ads;
  }

  /** Client-credentials token, reused until a minute before it expires. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const response = await fetch(new URL('/v2/oauth/token/', TIKTOK_API), {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.config.get<string>('research.tiktokAdLibraryClientKey') ?? '',
        client_secret: this.config.get<string>('research.tiktokAdLibraryClientSecret') ?? '',
        grant_type: 'client_credentials',
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(body.error_description || 'TikTok rejected the Ad Library client credentials.');
    }
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 7200) * 1000 };
    return body.access_token;
  }
}

export function toAd(raw: TiktokAdLibraryAd): CompetitorAd | null {
  const id = raw.ad?.id;
  if (id === undefined || id === null || id === '') return null;
  return {
    id: String(id),
    advertiserName: raw.advertiser?.business_name ?? 'Unknown advertiser',
    paidFor: raw.advertiser?.paid_for_by ?? raw.advertiser?.paid_by ?? null,
    firstShownAt: isoDate(raw.ad?.first_shown_date),
    lastShownAt: isoDate(raw.ad?.last_shown_date),
    status: raw.ad?.status ?? null,
    reach: raw.ad?.reach?.unique_users_seen ?? null,
    videoUrls: (raw.ad?.videos ?? []).map((video) => video.url).filter((url): url is string => Boolean(url)),
    imageUrls: raw.ad?.image_urls ?? [],
    libraryUrl: `https://library.tiktok.com/ads/detail/?ad_id=${encodeURIComponent(String(id))}`,
  };
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function isoDate(value?: string): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

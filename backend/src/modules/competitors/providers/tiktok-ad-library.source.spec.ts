import type { ConfigService } from '@nestjs/config';

import { TiktokAdLibrarySource, toAd } from './tiktok-ad-library.source';

const credentials = {
  'research.tiktokAdLibraryClientKey': 'key',
  'research.tiktokAdLibraryClientSecret': 'secret',
};

function config(values: Record<string, unknown>): ConfigService {
  return { get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback) } as unknown as ConfigService;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tokenResponse = () => json({ access_token: 'clt.token', expires_in: 7200 });
const rawAd = (id: number) => ({
  ad: {
    id,
    first_shown_date: '20260801',
    last_shown_date: '20260920',
    status: 'active',
    videos: [{ url: `https://cdn.example.com/${id}.mp4` }],
    image_urls: [],
    reach: { unique_users_seen: '10K-100K' },
  },
  advertiser: { business_id: 1, business_name: 'Gymshark Ltd', paid_for_by: 'Gymshark' },
});

describe('toAd', () => {
  it('maps an Ad Library row and builds its public library link', () => {
    expect(toAd(rawAd(123))).toEqual({
      id: '123',
      advertiserName: 'Gymshark Ltd',
      paidFor: 'Gymshark',
      firstShownAt: '2026-08-01',
      lastShownAt: '2026-09-20',
      status: 'active',
      reach: '10K-100K',
      videoUrls: ['https://cdn.example.com/123.mp4'],
      imageUrls: [],
      libraryUrl: 'https://library.tiktok.com/ads/detail/?ad_id=123',
    });
  });

  it('skips rows without an id and tolerates missing fields', () => {
    expect(toAd({ advertiser: { business_name: 'x' } })).toBeNull();
    expect(toAd({ ad: { id: '7', first_shown_date: 'bad' } })).toMatchObject({
      advertiserName: 'Unknown advertiser',
      firstShownAt: null,
      videoUrls: [],
    });
  });
});

describe('TiktokAdLibrarySource', () => {
  afterEach(() => jest.restoreAllMocks());

  it('needs both the research client key and secret', () => {
    expect(new TiktokAdLibrarySource(config({ 'research.tiktokAdLibraryClientKey': 'k' })).isConfigured()).toBe(false);
    expect(new TiktokAdLibrarySource(config(credentials)).isConfigured()).toBe(true);
  });

  it('gets a client token, then pages through the last year of ads', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ data: { ads: [rawAd(1)], has_more: true, search_id: 'page-2' }, error: { code: 'ok' } }))
      .mockResolvedValueOnce(json({ data: { ads: [rawAd(2)], has_more: false }, error: { code: 'ok' } }));
    const source = new TiktokAdLibrarySource(config({ ...credentials, 'research.tiktokAdLibraryCountries': ['GB', 'FR'] }));

    const ads = await source.searchAds('Gymshark', new Date('2026-09-28T12:00:00Z'));

    expect(ads.map((item) => item.id)).toEqual(['1', '2']);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(tokenUrl.toString()).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    expect(String(tokenInit.body)).toBe('client_key=key&client_secret=secret&grant_type=client_credentials');

    const [queryUrl, queryInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(queryUrl.pathname).toBe('/v2/research/adlib/ad/query/');
    expect(queryUrl.searchParams.get('fields')).toContain('advertiser.business_name');
    expect(queryInit.headers).toMatchObject({ Authorization: 'Bearer clt.token' });
    expect(JSON.parse(queryInit.body as string)).toEqual({
      filters: {
        ad_published_date_range: { min: '20250928', max: '20260928' },
        country_code_list: ['GB', 'FR'],
      },
      search_term: 'Gymshark',
      search_type: 'fuzzy_phrase',
      max_count: 50,
    });
    expect(JSON.parse((fetchMock.mock.calls[2] as [URL, RequestInit])[1].body as string).search_id).toBe('page-2');
  });

  it('reuses the token and omits countries when none are configured', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValue(json({ data: { ads: [], has_more: false }, error: { code: 'ok' } }));
    const source = new TiktokAdLibrarySource(config(credentials));

    await source.searchAds('A');
    await source.searchAds('B');

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/token/'));
    expect(tokenCalls).toHaveLength(1);
    expect(JSON.parse((fetchMock.mock.calls[1] as [URL, RequestInit])[1].body as string).filters).not.toHaveProperty(
      'country_code_list',
    );
  });

  it('surfaces API errors and rejected credentials', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json({ error: { code: 'scope_not_authorized', message: 'Scope not authorized' } }, 403));
    await expect(new TiktokAdLibrarySource(config(credentials)).searchAds('x')).rejects.toThrow('Scope not authorized');

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json({ error_description: 'Client key is invalid' }, 400));
    await expect(new TiktokAdLibrarySource(config(credentials)).searchAds('x')).rejects.toThrow('Client key is invalid');
  });
});

export interface SearchSnippet {
  title: string;
  snippet: string;
  url: string;
}

export interface TiktokPost {
  author: string;
  caption: string;
  plays: number;
  likes: number;
  url: string;
  photoMode: boolean;
}

export function extractTiktokPosts(payload: unknown, limit = 12): TiktokPost[] {
  const found: TiktokPost[] = [];
  const seen = new Set<string>();
  walk(payload, found, seen);
  return found
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

export function formatTiktokEvidence(posts: TiktokPost[]): string {
  if (!posts.length) return '';
  return posts
    .map((post, index) => {
      const stats = [compact(post.plays) + ' plays', compact(post.likes) + ' likes'].join(', ');
      const kind = post.photoMode ? 'Photo Mode' : 'video';
      return `${index + 1}. @${post.author} (${kind}, ${stats}) — ${post.caption}${post.url ? ' — ' + post.url : ''}`;
    })
    .join('\n');
}

export async function searchTiktokViaApi(options: {
  apiKey: string;
  query: string;
  hashtag?: string;
  sandbox?: boolean;
}): Promise<TiktokPost[]> {
  const origin = options.sandbox ? 'https://sandbox.tikapi.io' : 'https://api.tikapi.io';
  const [videos, tagged] = await Promise.all([
    tikapiGet(origin, options.apiKey, '/public/search/videos', { query: options.query, country: 'us' }),
    options.hashtag
      ? tikapiGet(origin, options.apiKey, '/public/hashtag', { name: options.hashtag, count: '20', country: 'us' })
      : Promise.resolve(null),
  ]);
  return extractTiktokPosts([videos, tagged]);
}

export function extractSearchSnippets(html: string, limit = 8): SearchSnippet[] {
  const results: SearchSnippet[] = [];
  const parts = html.split(/class="result__a"/i);
  for (const part of parts.slice(1)) {
    const title = decode(first(part, /^[^>]*>\s*([\s\S]*?)<\/a>/i));
    const snippet = decode(
      first(part, /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
        first(part, /class="result__snippet"[^>]*>([\s\S]*?)<\//i),
    );
    const href =
      first(part, /uddg=([^"&]+)/i) ||
      first(part, /href="(https?:\/\/[^"]*tiktok\.com[^"]*)"/i) ||
      first(part, /href="(\/\/[^"]+)"/i) ||
      first(part, /href="(https?:\/\/[^"]+)"/i);
    const url = decodeUrl(href.startsWith('//') ? `https:${href}` : href);
    if (!title && !snippet) continue;
    results.push({ title, snippet, url });
    if (results.length >= limit) break;
  }
  return results;
}

export function formatSearchEvidence(snippets: SearchSnippet[]): string {
  if (!snippets.length) return '';
  return snippets
    .map((item, index) => {
      const parts = [`${index + 1}. ${item.title || 'Untitled'}`];
      if (item.snippet) parts.push(item.snippet);
      if (item.url) parts.push(item.url);
      return parts.join(' — ');
    })
    .join('\n');
}

async function tikapiGet(origin: string, apiKey: string, path: string, params: Record<string, string>) {
  const target = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function walk(node: unknown, found: TiktokPost[], seen: Set<string>) {
  if (!node || found.length >= 40) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, found, seen);
    return;
  }
  if (typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const post = asPost(record);
  if (post) {
    const key = post.url || `${post.author}:${post.caption}`;
    if (!seen.has(key)) {
      seen.add(key);
      found.push(post);
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') walk(value, found, seen);
  }
}

function asPost(record: Record<string, unknown>): TiktokPost | null {
  const authorRecord = asRecord(record.author);
  const author =
    str(authorRecord?.uniqueId) ||
    str(authorRecord?.unique_id) ||
    str(authorRecord?.nickname);
  const caption = str(record.desc) || str(record.description) || str(record.title);
  if (!author || !caption) return null;
  const stats = asRecord(record.stats) || asRecord(record.statistics);
  const id = str(record.id) || str(record.aweme_id);
  const url = id ? `https://www.tiktok.com/@${author}/video/${id}` : '';
  const photoMode = Boolean(record.imagePost) || /photomode/i.test(JSON.stringify(record.video ?? ''));
  return {
    author,
    caption: caption.slice(0, 240),
    plays: num(stats?.playCount ?? stats?.play_count),
    likes: num(stats?.diggCount ?? stats?.digg_count ?? stats?.heartCount),
    url,
    photoMode,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

function first(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function decode(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeUrl(value: string) {
  if (!value) return '';
  try {
    return decodeURIComponent(value.replace(/&amp;/g, '&'));
  } catch {
    return value;
  }
}

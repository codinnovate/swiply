import { ApiException } from '../../common/errors/api.exception';

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal']);
const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw ApiException.unprocessable('BRAND_URL_INVALID', 'Enter a valid http(s) website URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw ApiException.unprocessable('BRAND_URL_INVALID', 'Website URL must start with https://');
  }
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw ApiException.unprocessable('BRAND_URL_UNSAFE', 'That URL cannot be fetched from Swiply');
  }
  if (isPrivateIp(host)) {
    throw ApiException.unprocessable('BRAND_URL_UNSAFE', 'That URL cannot be fetched from Swiply');
  }
  return url;
}

export function extractWebsiteText(html: string, limit = 6000): {
  title: string;
  description: string;
  headings: string[];
  body: string;
} {
  const withoutChrome = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const title = decode(firstMatch(withoutChrome, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decode(
    firstMatch(withoutChrome, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      firstMatch(withoutChrome, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i),
  );
  const headings = [...withoutChrome.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decode(match[1] ?? ''))
    .filter(Boolean)
    .slice(0, 12);
  const body = collapse(stripTags(withoutChrome)).slice(0, limit);
  return { title, description, headings, body };
}

export function formatWebsiteCorpus(extracted: ReturnType<typeof extractWebsiteText>): string {
  return [
    extracted.title && `Title: ${extracted.title}`,
    extracted.description && `Description: ${extracted.description}`,
    extracted.headings.length ? `Headings: ${extracted.headings.join(' | ')}` : '',
    extracted.body && `Page text: ${extracted.body}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function isPrivateIp(host: string) {
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^127\./.test(host)) return true;
  const match = /^172\.(\d+)\./.exec(host);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return false;
}

function firstMatch(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, ' ');
}

function decode(value: string) {
  return collapse(
    value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  );
}

function collapse(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

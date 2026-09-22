/** TikTok Photo Mode rejects images whose width×height exceeds 1920×1080. */
export const TIKTOK_MAX_PIXELS = 1_920 * 1_080;
export const TIKTOK_MAX_SIDE = 1_920;
export const TIKTOK_ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/webp']);

export function needsTikTokFit(
  width: number | null | undefined,
  height: number | null | undefined,
  mimeType?: string | null,
): boolean {
  if (!width || !height) return true;
  if (mimeType && !TIKTOK_ALLOWED_MIME.has(mimeType.toLowerCase())) return true;
  return width * height > TIKTOK_MAX_PIXELS || Math.max(width, height) > TIKTOK_MAX_SIDE;
}

export function fitTikTokDimensions(width: number, height: number): { width: number; height: number } {
  if (width < 1 || height < 1) return { width: 2, height: 2 };
  let nextWidth = width;
  let nextHeight = height;
  const longest = Math.max(nextWidth, nextHeight);
  if (longest > TIKTOK_MAX_SIDE) {
    const scale = TIKTOK_MAX_SIDE / longest;
    nextWidth *= scale;
    nextHeight *= scale;
  }
  const pixels = nextWidth * nextHeight;
  if (pixels > TIKTOK_MAX_PIXELS) {
    const scale = Math.sqrt(TIKTOK_MAX_PIXELS / pixels);
    nextWidth *= scale;
    nextHeight *= scale;
  }
  let widthEven = even(nextWidth);
  let heightEven = even(nextHeight);
  while (widthEven * heightEven > TIKTOK_MAX_PIXELS) {
    if (widthEven >= heightEven) widthEven -= 2;
    else heightEven -= 2;
  }
  return { width: Math.max(2, widthEven), height: Math.max(2, heightEven) };
}

export function parseFfmpegSize(stderr: string): { width: number; height: number } | null {
  const match = stderr.match(/,\s(\d{2,5})x(\d{2,5})(?:\s|\[|,|$)/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
}

export function tiktokFitStorageKey(originalKey: string): string {
  const slash = originalKey.lastIndexOf('/');
  const dir = slash >= 0 ? originalKey.slice(0, slash + 1) : '';
  const file = slash >= 0 ? originalKey.slice(slash + 1) : originalKey;
  const base = file.replace(/\.[^.]+$/, '') || 'image';
  if (base.endsWith('.tiktok')) return `${dir}${base}.jpg`;
  return `${dir}${base}.tiktok.jpg`;
}

function even(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

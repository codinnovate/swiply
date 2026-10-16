import { ApiException } from '../../common/errors/api.exception';

const DOWNLOAD_TIMEOUT_MS = 20_000;
const DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Fetches a public HTTPS image into memory for FFmpeg, refusing redirects and oversized bodies. */
export async function downloadRemoteImage(imageUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image URL is not valid');
  }
  if (url.protocol !== 'https:') {
    throw ApiException.unprocessable('REMOTE_MEDIA_UNSAFE', 'TikTok images must be fetched over HTTPS');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { Accept: 'image/*' },
    });
  } catch {
    throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Could not download the image');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Could not download the image');
  }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > DOWNLOAD_MAX_BYTES) {
    throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image is too large to process');
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > DOWNLOAD_MAX_BYTES) {
    throw ApiException.unprocessable('MEDIA_TRANSCODE_FAILED', 'Image is too large to process');
  }
  return body;
}

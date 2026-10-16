import { createHash } from 'node:crypto';

// TikTok's native vertical frame. Slides keep their aspect ratio and are
// letterboxed onto it rather than cropped, so no slide text is cut off.
export const SLIDESHOW_VIDEO_WIDTH = 1080;
export const SLIDESHOW_VIDEO_HEIGHT = 1920;
export const SLIDESHOW_SECONDS_PER_SLIDE = 3;
const FRAME_RATE = 30;
const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_FADE_OUT_SECONDS = 1.5;

export function slideshowDurationSeconds(slideCount: number): number {
  return slideCount * SLIDESHOW_SECONDS_PER_SLIDE;
}

/**
 * FFmpeg arguments that play each slide for a fixed time over a music track.
 * The track loops if it is shorter than the slideshow and fades out at the end.
 */
export function slideshowVideoArgs(
  imagePaths: string[],
  audioPath: string,
  outputPath: string,
): string[] {
  const duration = slideshowDurationSeconds(imagePaths.length);
  const inputs = imagePaths.flatMap((path) => [
    '-loop',
    '1',
    '-t',
    String(SLIDESHOW_SECONDS_PER_SLIDE),
    '-i',
    path,
  ]);
  const frames = imagePaths.map(
    (_, index) =>
      `[${index}:v]scale=${SLIDESHOW_VIDEO_WIDTH}:${SLIDESHOW_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${SLIDESHOW_VIDEO_WIDTH}:${SLIDESHOW_VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,` +
      `setsar=1,fps=${FRAME_RATE},format=yuv420p[v${index}]`,
  );
  const joined = `${imagePaths.map((_, index) => `[v${index}]`).join('')}concat=n=${imagePaths.length}:v=1:a=0[video]`;
  const fadeStart = Math.max(0, duration - AUDIO_FADE_OUT_SECONDS);
  // Loop inside the filter graph: `-stream_loop` on an MP3 input deadlocks the
  // FFmpeg 6.0 build ffmpeg-static ships. Resampling first makes the loop buffer
  // exactly one slideshow long whatever the track's own sample rate.
  const audio =
    `[${imagePaths.length}:a]aresample=${AUDIO_SAMPLE_RATE},` +
    `aloop=loop=-1:size=${AUDIO_SAMPLE_RATE * duration},asetpts=N/SR/TB,atrim=0:${duration},` +
    `afade=t=out:st=${fadeStart}:d=${AUDIO_FADE_OUT_SECONDS}[audio]`;
  return [
    '-nostdin',
    '-y',
    ...inputs,
    '-i',
    audioPath,
    '-filter_complex',
    [...frames, joined, audio].join(';'),
    '-map',
    '[video]',
    '-map',
    '[audio]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-r',
    String(FRAME_RATE),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-t',
    String(duration),
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

/** Spreads tracks across slideshows while keeping one slideshow's choice stable across retries. */
export function pickSlideshowTrack(trackKeys: string[], imageUrls: string[]): string {
  const digest = createHash('sha256').update(imageUrls.join('\n')).digest();
  return trackKeys[digest.readUInt32BE(0) % trackKeys.length];
}

export function slideshowVideoStorageKey(
  workspaceId: string,
  imageUrls: string[],
  trackKey: string,
): string {
  const digest = createHash('sha256')
    .update([...imageUrls, trackKey, SLIDESHOW_SECONDS_PER_SLIDE].join('\n'))
    .digest('hex')
    .slice(0, 24);
  return `workspaces/${workspaceId}/tiktok-music/${digest}.mp4`;
}

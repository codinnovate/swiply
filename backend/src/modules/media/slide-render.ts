import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Burns a slideshow slide's caption into its image and crops it to the frame
 * the platform displays, so what gets posted matches the dashboard preview
 * (tiktok-slideshow-preview.tsx: object-cover crop, 25% black scrim, centered
 * ExtraBold white caption with a drop shadow).
 */

export interface SlideFrame {
  width: number;
  height: number;
}

/** TikTok photo mode is 9:16 (1080×1920 is also TikTok's pixel ceiling). */
export const TIKTOK_SLIDE_FRAME: SlideFrame = { width: 1080, height: 1920 };
/** Instagram rejects carousel images taller than 4:5. */
const PORTRAIT_4_5: SlideFrame = { width: 1080, height: 1350 };
const PINTEREST_2_3: SlideFrame = { width: 1000, height: 1500 };

export function slideFrameFor(platform: string): SlideFrame {
  if (platform === 'tiktok') return TIKTOK_SLIDE_FRAME;
  if (platform === 'pinterest') return PINTEREST_2_3;
  return PORTRAIT_4_5;
}

/** Bump when the look changes so previously rendered slides are not reused. */
export const SLIDE_RENDER_VERSION = 'v1';

// Bricolage Grotesque ExtraBold is the preview's `font-display`. Bundled
// because production hosts have no fonts installed. Resolves the same from
// src/ (ts-jest) and dist/ (nest build): both sit three levels below backend/.
export const SLIDE_CAPTION_FONT = resolve(__dirname, '../../../assets/fonts/BricolageGrotesque-ExtraBold.ttf');

// The preview draws 1.85rem text on a 280px-wide phone with 20px side insets.
// Scaled to the frame width that is ~41% of width per em and ~7% margins.
const FONT_SIZE_PER_WIDTH = 29.6 / 280;
const MIN_FONT_SIZE_PER_WIDTH = 0.06;
const SIDE_MARGIN_PER_WIDTH = 20 / 280;
const LINE_HEIGHT = 1.1;
/** Average advance of this font's ExtraBold glyphs, in ems — measured, slightly generous. */
const AVERAGE_GLYPH_EM = 0.56;
const MAX_LINES = 7;

export interface CaptionLayout {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  /** Top y of each line's text box, centering the block vertically. */
  lineTops: number[];
}

/**
 * The bundled font has no emoji glyphs; FFmpeg would draw them as boxes.
 * Drops emoji, keycaps, variation selectors and joiners, then tidies spacing.
 */
export function cleanCaption(caption: string | null | undefined): string {
  return (caption ?? '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\u{1F1E6}-\u{1F1FF}]|[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\u{FE0E}|\u{FE0F}|\u{200D}|\u{20E3}/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Word-wraps the caption, shrinking the font until it fits in MAX_LINES. */
export function layoutCaption(caption: string, frame: SlideFrame): CaptionLayout | null {
  const text = cleanCaption(caption);
  if (!text) return null;
  const maxWidth = frame.width * (1 - 2 * SIDE_MARGIN_PER_WIDTH);
  const largest = Math.round(frame.width * FONT_SIZE_PER_WIDTH);
  const smallest = Math.round(frame.width * MIN_FONT_SIZE_PER_WIDTH);
  let fontSize = largest;
  let lines = wrap(text, Math.floor(maxWidth / (fontSize * AVERAGE_GLYPH_EM)));
  while (lines.length > MAX_LINES && fontSize > smallest) {
    fontSize = Math.max(smallest, fontSize - 4);
    lines = wrap(text, Math.floor(maxWidth / (fontSize * AVERAGE_GLYPH_EM)));
  }
  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
    lines[MAX_LINES - 1] = `${lines[MAX_LINES - 1].replace(/[\s.,;:!?-]+$/, '')}…`;
  }
  const lineHeight = Math.round(fontSize * LINE_HEIGHT);
  const top = Math.round((frame.height - lines.length * lineHeight) / 2);
  return { fontSize, lineHeight, lines, lineTops: lines.map((_, index) => top + index * lineHeight) };
}

/** Greedy word wrap; words longer than a line are split. Author line breaks are kept. */
export function wrap(text: string, maxChars: number): string[] {
  const limit = Math.max(4, maxChars);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ').filter(Boolean)) {
      const chunks = word.length > limit ? (word.match(new RegExp(`.{1,${limit}}`, 'gu')) ?? [word]) : [word];
      for (const chunk of chunks) {
        if (!line) line = chunk;
        else if (line.length + 1 + chunk.length <= limit) line = `${line} ${chunk}`;
        else {
          lines.push(line);
          line = chunk;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * FFmpeg arguments for one slide: cover-scale and center-crop to the frame,
 * then, when there is a caption, the scrim and one centered drawtext per line.
 * Each line's text is read from its own file so no caption character can
 * break out of the filter graph.
 */
export function slideRenderArgs(options: {
  inputPath: string;
  outputPath: string;
  frame: SlideFrame;
  caption: CaptionLayout | null;
  lineFiles: string[];
  fontPath: string;
}): string[] {
  const { width, height } = options.frame;
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    'setsar=1',
  ];
  if (options.caption) {
    const { fontSize } = options.caption;
    filters.push('drawbox=x=0:y=0:w=iw:h=ih:color=black@0.25:t=fill');
    options.caption.lineTops.forEach((top, index) => {
      filters.push(
        [
          `drawtext=fontfile=${filterPath(options.fontPath)}`,
          `textfile=${filterPath(options.lineFiles[index])}`,
          'expansion=none',
          `fontsize=${fontSize}`,
          'fontcolor=white',
          'x=(w-text_w)/2',
          `y=${top}`,
          'shadowcolor=black@0.7',
          'shadowx=0',
          `shadowy=${Math.max(2, Math.round(fontSize / 24))}`,
          `borderw=${Math.max(1, Math.round(fontSize / 40))}`,
          'bordercolor=black@0.35',
        ].join(':'),
      );
    });
  }
  return [
    '-nostdin',
    '-y',
    '-i',
    options.inputPath,
    '-vf',
    filters.join(','),
    '-frames:v',
    '1',
    '-q:v',
    '2',
    options.outputPath,
  ];
}

/** Stable per image + caption + frame + look, so re-publishing reuses the render. */
export function slideRenderStorageKey(
  workspaceId: string,
  imageUrl: string,
  caption: string | null | undefined,
  frame: SlideFrame,
): string {
  const digest = createHash('sha256')
    .update([SLIDE_RENDER_VERSION, imageUrl, cleanCaption(caption), frame.width, frame.height].join('\n'))
    .digest('hex')
    .slice(0, 24);
  // `.tiktok.jpg` tells TikTokMediaFitService the file already meets TikTok's limits.
  return `workspaces/${workspaceId}/slides/${digest}.tiktok.jpg`;
}

/**
 * FFmpeg filter values have two levels of escaping. The paths used here (temp
 * dir, bundled font) never need it, so only plain paths are accepted.
 */
function filterPath(path: string): string {
  if (!/^[\w./-]+$/.test(path)) throw new Error(`Unsupported characters in FFmpeg filter path: ${path}`);
  return path;
}

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

import { FfmpegService } from './ffmpeg.service';
import {
  SLIDE_CAPTION_FONT,
  TIKTOK_SLIDE_FRAME,
  cleanCaption,
  layoutCaption,
  slideFrameFor,
  slideRenderArgs,
  slideRenderStorageKey,
  wrap,
} from './slide-render';

describe('slide frames', () => {
  it('uses 9:16 for TikTok and each platform’s tallest accepted ratio elsewhere', () => {
    expect(slideFrameFor('tiktok')).toEqual({ width: 1080, height: 1920 });
    expect(slideFrameFor('instagram')).toEqual({ width: 1080, height: 1350 });
    expect(slideFrameFor('pinterest')).toEqual({ width: 1000, height: 1500 });
  });
});

describe('cleanCaption', () => {
  it('drops emoji the bundled font cannot draw and tidies whitespace', () => {
    expect(cleanCaption('  Glow up 🔥✨  in 3 steps 👇🏽 ')).toBe('Glow up in 3 steps');
    expect(cleanCaption('Step 1\n\n\n  Cleanse')).toBe('Step 1\nCleanse');
    expect(cleanCaption('🇳🇬 ❤️')).toBe('');
    expect(cleanCaption(null)).toBe('');
  });

  it('keeps accents, punctuation and non-Latin letters', () => {
    expect(cleanCaption('Café — 50% off! ¿Listo? 日本')).toBe('Café — 50% off! ¿Listo? 日本');
  });
});

describe('wrap', () => {
  it('breaks on words, keeps author line breaks and splits overlong words', () => {
    expect(wrap('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
    expect(wrap('Title\nbody text here', 20)).toEqual(['Title', 'body text here']);
    expect(wrap('supercalifragilistic', 8)).toEqual(['supercal', 'ifragili', 'stic']);
  });
});

describe('layoutCaption', () => {
  it('matches the preview’s type scale and centers the block', () => {
    const layout = layoutCaption('Stop scrolling', TIKTOK_SLIDE_FRAME);
    expect(layout).toEqual({ fontSize: 114, lineHeight: 125, lines: ['Stop scrolling'], lineTops: [898] });
  });

  it('shrinks long captions to fit and never exceeds seven lines', () => {
    const long = 'This is the one skincare routine dermatologists keep recommending to everyone with dry winter skin';
    const layout = layoutCaption(long, TIKTOK_SLIDE_FRAME);
    expect(layout!.fontSize).toBeLessThan(114);
    expect(layout!.lines.length).toBeLessThanOrEqual(7);
    expect(layout!.lines.join(' ')).toBe(long);

    const huge = layoutCaption('word '.repeat(200), TIKTOK_SLIDE_FRAME)!;
    expect(huge.lines).toHaveLength(7);
    expect(huge.lines[6].endsWith('…')).toBe(true);
  });

  it('returns null for empty or emoji-only captions', () => {
    expect(layoutCaption('', TIKTOK_SLIDE_FRAME)).toBeNull();
    expect(layoutCaption('🔥🔥', TIKTOK_SLIDE_FRAME)).toBeNull();
  });
});

describe('slideRenderArgs', () => {
  const base = { inputPath: '/tmp/w/in.bin', outputPath: '/tmp/w/out.jpg', frame: TIKTOK_SLIDE_FRAME, fontPath: '/app/font.ttf' };

  it('cover-crops to the frame without a scrim when there is no caption', () => {
    const args = slideRenderArgs({ ...base, caption: null, lineFiles: [] });
    expect(args[args.indexOf('-vf') + 1]).toBe('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1');
  });

  it('adds the scrim and one centered drawtext per line, reading text from files', () => {
    const caption = layoutCaption('First line\nSecond', TIKTOK_SLIDE_FRAME)!;
    const vf = slideRenderArgs({ ...base, caption, lineFiles: ['/tmp/w/line-0.txt', '/tmp/w/line-1.txt'] });
    const filter = vf[vf.indexOf('-vf') + 1];
    expect(filter).toContain('drawbox=x=0:y=0:w=iw:h=ih:color=black@0.25:t=fill');
    expect(filter.match(/drawtext=/g)).toHaveLength(2);
    expect(filter).toContain('textfile=/tmp/w/line-1.txt:expansion=none:fontsize=114');
    expect(filter).toContain(`y=${caption.lineTops[1]}`);
    expect(filter).not.toContain('First line');
  });

  it('refuses paths that would need filter escaping', () => {
    expect(() => slideRenderArgs({ ...base, fontPath: "/tmp/it's:bad.ttf", caption: layoutCaption('x y', TIKTOK_SLIDE_FRAME), lineFiles: ['/tmp/w/l.txt'] })).toThrow(
      /Unsupported characters/,
    );
  });
});

describe('slideRenderStorageKey', () => {
  it('changes with the caption and frame and is marked TikTok-ready', () => {
    const a = slideRenderStorageKey('ws', 'https://cdn/a.jpg', 'Hello', TIKTOK_SLIDE_FRAME);
    expect(a).toMatch(/^workspaces\/ws\/slides\/[0-9a-f]{24}\.tiktok\.jpg$/);
    expect(slideRenderStorageKey('ws', 'https://cdn/a.jpg', 'Hello 🔥', TIKTOK_SLIDE_FRAME)).toBe(a);
    expect(slideRenderStorageKey('ws', 'https://cdn/a.jpg', 'Bye', TIKTOK_SLIDE_FRAME)).not.toBe(a);
    expect(slideRenderStorageKey('ws', 'https://cdn/a.jpg', 'Hello', slideFrameFor('instagram'))).not.toBe(a);
  });
});

describe('rendering with the bundled FFmpeg', () => {
  jest.setTimeout(60_000);
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'slide-render-spec-'));
  });
  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  /** Mean brightness of a horizontal band of a grayscale frame. */
  function bandBrightness(pixels: Buffer, width: number, fromRow: number, toRow: number): { mean: number; max: number } {
    const band = pixels.subarray(fromRow * width, toRow * width);
    let total = 0;
    let max = 0;
    for (const value of band) {
      total += value;
      max = Math.max(max, value);
    }
    return { mean: total / band.length, max };
  }

  it('ships the caption font', () => {
    expect(existsSync(SLIDE_CAPTION_FONT)).toBe(true);
  });

  it('turns a landscape photo into a 1080×1920 slide with the caption burned in', async () => {
    const input = join(workDir, 'landscape.png');
    const generated = spawnSync(ffmpegPath as string, ['-y', '-f', 'lavfi', '-i', 'color=c=0x808080:s=1600x900', '-frames:v', '1', input]);
    expect(generated.status).toBe(0);

    const caption = layoutCaption('Three steps to glass skin', TIKTOK_SLIDE_FRAME)!;
    const lineFiles = caption.lines.map((_, index) => join(workDir, `line-${index}.txt`));
    await Promise.all(lineFiles.map((file, index) => writeFile(file, caption.lines[index])));
    const output = join(workDir, 'slide.jpg');
    const ffmpeg = new FfmpegService();

    await ffmpeg.renderSlideImage({ inputPath: input, outputPath: output, frame: TIKTOK_SLIDE_FRAME, caption, lineFiles, fontPath: SLIDE_CAPTION_FONT });

    await expect(ffmpeg.probeSize(output)).resolves.toEqual({ width: 1080, height: 1920 });
    const raw = join(workDir, 'slide.gray');
    expect(spawnSync(ffmpegPath as string, ['-y', '-i', output, '-f', 'rawvideo', '-pix_fmt', 'gray', raw]).status).toBe(0);
    const pixels = await readFile(raw);
    const top = caption.lineTops[0];
    const bottom = caption.lineTops.at(-1)! + caption.lineHeight;
    // Scrim darkens the 128-gray background; white caption glyphs sit only in the text band.
    expect(bandBrightness(pixels, 1080, 0, 200).mean).toBeLessThan(110);
    expect(bandBrightness(pixels, 1080, 0, 200).max).toBeLessThan(130);
    expect(bandBrightness(pixels, 1080, top, bottom).max).toBeGreaterThan(235);
  });
});

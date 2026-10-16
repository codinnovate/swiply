import {
  pickSlideshowTrack,
  slideshowDurationSeconds,
  slideshowVideoArgs,
  slideshowVideoStorageKey,
} from './slideshow-video';

describe('slideshowVideoArgs', () => {
  const args = slideshowVideoArgs(['/w/slide-0', '/w/slide-1', '/w/slide-2'], '/w/track.mp3', '/w/out.mp4');
  const filter = args[args.indexOf('-filter_complex') + 1];

  it('holds every slide for the same time, in order, before the track', () => {
    const inputs = args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1]] : []));
    expect(inputs).toEqual(['/w/slide-0', '/w/slide-1', '/w/slide-2', '/w/track.mp3']);
    expect(args.filter((arg) => arg === '-loop')).toHaveLength(3);
    // -stream_loop on an MP3 deadlocks FFmpeg 6.0; the loop lives in the filter graph instead.
    expect(args).not.toContain('-stream_loop');
  });

  it('letterboxes slides onto a 1080x1920 frame and concatenates them', () => {
    expect(filter).toContain('scale=1080:1920:force_original_aspect_ratio=decrease');
    expect(filter).toContain('pad=1080:1920');
    expect(filter).toContain('[v0][v1][v2]concat=n=3:v=1:a=0[video]');
  });

  it('loops and trims the track to the slideshow and fades it out', () => {
    expect(slideshowDurationSeconds(3)).toBe(9);
    expect(filter).toContain('[3:a]aresample=48000,aloop=loop=-1:size=432000,');
    expect(filter).toContain('atrim=0:9');
    expect(filter).toContain('afade=t=out:st=7.5:d=1.5');
    expect(args[args.indexOf('-t', args.indexOf('-map')) + 1]).toBe('9');
    expect(args.at(-1)).toBe('/w/out.mp4');
  });
});

describe('pickSlideshowTrack', () => {
  const tracks = ['music/a.mp3', 'music/b.mp3', 'music/c.mp3'];

  it('keeps the same track for the same slideshow', () => {
    const slides = ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'];
    expect(pickSlideshowTrack(tracks, slides)).toBe(pickSlideshowTrack(tracks, [...slides]));
    expect(tracks).toContain(pickSlideshowTrack(tracks, slides));
  });

  it('spreads different slideshows across the library', () => {
    const picked = new Set(
      Array.from({ length: 30 }, (_, index) =>
        pickSlideshowTrack(tracks, [`https://cdn.example/${index}.jpg`]),
      ),
    );
    expect(picked.size).toBeGreaterThan(1);
  });
});

describe('slideshowVideoStorageKey', () => {
  it('is stable for a slideshow and track, and changes when either changes', () => {
    const slides = ['https://cdn.example/1.jpg'];
    const key = slideshowVideoStorageKey('ws1', slides, 'music/a.mp3');
    expect(key).toMatch(/^workspaces\/ws1\/tiktok-music\/[0-9a-f]{24}\.mp4$/);
    expect(slideshowVideoStorageKey('ws1', slides, 'music/a.mp3')).toBe(key);
    expect(slideshowVideoStorageKey('ws1', slides, 'music/b.mp3')).not.toBe(key);
    expect(slideshowVideoStorageKey('ws1', ['https://cdn.example/2.jpg'], 'music/a.mp3')).not.toBe(key);
  });
});

import { readFile } from 'node:fs/promises';

import { ApiException } from '../../common/errors/api.exception';
import { SlideshowVideoService } from './slideshow-video.service';

const WORKSPACE = '64b0a1c2d3e4f5a6b7c8d9e0';
const SLIDES = ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'];

function build(trackKeys: string[]) {
  const storage = {
    objectExists: jest.fn().mockResolvedValue(false),
    getObject: jest.fn().mockResolvedValue(Buffer.from('mp3-bytes')),
    putObject: jest.fn().mockResolvedValue(undefined),
    publicUrl: jest.fn((key: string) => `https://cdn.example/${key}`),
  };
  const ffmpeg = {
    renderSlideshowVideo: jest.fn(async (_images: string[], _audio: string, output: string) => {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(output, 'mp4-bytes');
    }),
  };
  const config = { get: jest.fn().mockReturnValue(trackKeys) };
  const service = new SlideshowVideoService(storage as never, ffmpeg as never, config as never);
  return { service, storage, ffmpeg };
}

describe('SlideshowVideoService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async (url) =>
        new Response(`image:${String(url)}`, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    );
  });

  afterEach(() => fetchMock.mockRestore());

  it('refuses to publish without a configured music library', async () => {
    const { service, ffmpeg } = build([]);
    await expect(service.renderWithMusic(WORKSPACE, SLIDES)).rejects.toMatchObject({
      code: 'SLIDESHOW_MUSIC_NOT_CONFIGURED',
    });
    expect(ffmpeg.renderSlideshowVideo).not.toHaveBeenCalled();
  });

  it('reuses a video already rendered for the same slides and track', async () => {
    const { service, storage, ffmpeg } = build(['music/a.mp3']);
    storage.objectExists.mockResolvedValue(true);

    const url = await service.renderWithMusic(WORKSPACE, SLIDES);

    expect(url).toMatch(new RegExp(`^https://cdn.example/workspaces/${WORKSPACE}/tiktok-music/.+\\.mp4$`));
    expect(ffmpeg.renderSlideshowVideo).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the slides in order over a library track and uploads the mp4', async () => {
    const { service, storage, ffmpeg } = build(['music/a.mp3']);
    let slideBytes: string[] = [];
    ffmpeg.renderSlideshowVideo.mockImplementation(async (images, audio, output) => {
      slideBytes = await Promise.all(images.map((path) => readFile(path, 'utf8')));
      expect(await readFile(audio, 'utf8')).toBe('mp3-bytes');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(output, 'mp4-bytes');
    });

    const url = await service.renderWithMusic(WORKSPACE, SLIDES);

    expect(slideBytes).toEqual(SLIDES.map((slide) => `image:${slide}`));
    expect(storage.getObject).toHaveBeenCalledWith('music/a.mp3');
    const [key, body, mimeType, workspace] = storage.putObject.mock.calls[0];
    expect(key).toMatch(/^workspaces\/.+\/tiktok-music\/[0-9a-f]{24}\.mp4$/);
    expect(body.toString()).toBe('mp4-bytes');
    expect(mimeType).toBe('video/mp4');
    expect(workspace).toBe(WORKSPACE);
    expect(url).toBe(`https://cdn.example/${key}`);
  });

  it('surfaces a failed slide download instead of rendering a partial video', async () => {
    const { service, ffmpeg, storage } = build(['music/a.mp3']);
    fetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }));

    const error = await service.renderWithMusic(WORKSPACE, SLIDES).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect(error.code).toBe('MEDIA_TRANSCODE_FAILED');
    expect(ffmpeg.renderSlideshowVideo).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});

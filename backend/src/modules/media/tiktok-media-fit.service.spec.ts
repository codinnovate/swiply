import { TikTokMediaFitService } from './tiktok-media-fit.service';

describe('TikTokMediaFitService', () => {
  it('reuses a cached TikTok jpeg and skips originals that already fit', async () => {
    const assets = {
      findOne: jest.fn().mockReturnValue({
        exec: () =>
          Promise.resolve({
            url: 'https://cdn.example/hero.jpg',
            storageKey: 'workspaces/ws/uuid/hero.jpg',
            mimeType: 'image/jpeg',
            width: 1080,
            height: 1350,
          }),
      }),
    };
    const storage = {
      objectExists: jest.fn(),
      publicUrl: jest.fn(),
      getObject: jest.fn(),
      putObject: jest.fn(),
    };
    const ffmpeg = { fitToTikTokJpeg: jest.fn() };
    const service = new TikTokMediaFitService(assets as never, storage as never, ffmpeg as never);

    await expect(
      service.fitOne('64b0a1c2d3e4f5a6b7c8d9e0', 'https://cdn.example/hero.jpg'),
    ).resolves.toBe('https://cdn.example/hero.jpg');
    expect(ffmpeg.fitToTikTokJpeg).not.toHaveBeenCalled();
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('returns an already-fitted object when present in storage', async () => {
    const assets = {
      findOne: jest.fn().mockReturnValue({
        exec: () =>
          Promise.resolve({
            url: 'https://cdn.example/hero.png',
            storageKey: 'workspaces/ws/uuid/hero.png',
            mimeType: 'image/png',
            width: 1536,
            height: 1536,
          }),
      }),
    };
    const storage = {
      objectExists: jest.fn().mockResolvedValue(true),
      publicUrl: jest.fn().mockReturnValue('https://cdn.example/hero.tiktok.jpg'),
      getObject: jest.fn(),
      putObject: jest.fn(),
    };
    const ffmpeg = { fitToTikTokJpeg: jest.fn() };
    const service = new TikTokMediaFitService(assets as never, storage as never, ffmpeg as never);

    await expect(
      service.fitOne('64b0a1c2d3e4f5a6b7c8d9e0', 'https://cdn.example/hero.png'),
    ).resolves.toBe('https://cdn.example/hero.tiktok.jpg');
    expect(storage.objectExists).toHaveBeenCalledWith('workspaces/ws/uuid/hero.tiktok.jpg');
    expect(ffmpeg.fitToTikTokJpeg).not.toHaveBeenCalled();
  });

  it('falls back to the public image URL when S3 cannot read the original', async () => {
    const assets = {
      findOne: jest.fn().mockReturnValue({
        exec: () =>
          Promise.resolve({
            url: 'https://cdn.example/hero.png',
            storageKey: 'workspaces/ws/uuid/hero.png',
            mimeType: 'image/png',
            width: 800,
            height: 800,
          }),
      }),
    };
    const storage = {
      objectExists: jest.fn().mockResolvedValue(false),
      publicUrl: jest.fn().mockReturnValue('https://cdn.example/hero.tiktok.jpg'),
      getObject: jest.fn().mockRejectedValue(new Error('UnknownError')),
      putObject: jest.fn(),
    };
    const ffmpeg = {
      fitToTikTokJpeg: jest.fn().mockImplementation(async (_input: string, output: string) => {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(output, Buffer.from('jpeg'));
      }),
    };
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => '4' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as unknown as Response);
    const service = new TikTokMediaFitService(assets as never, storage as never, ffmpeg as never);

    await expect(
      service.fitOne('64b0a1c2d3e4f5a6b7c8d9e0', 'https://cdn.example/hero.png'),
    ).resolves.toBe('https://cdn.example/hero.tiktok.jpg');
    expect(fetchMock).toHaveBeenCalled();
    expect(storage.putObject).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});

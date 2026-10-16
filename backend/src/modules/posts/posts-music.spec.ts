import { needsRenderedMusic, PostsService } from './posts.service';

const bufferTikTok = {
  platform: 'tiktok' as const,
  connectionProvider: 'buffer' as const,
  publishingDefaults: { autoAddMusic: 'yes' as const },
};
const slides = ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'];

describe('needsRenderedMusic', () => {
  it('renders music only for Buffer TikTok slideshows that asked for it', () => {
    expect(needsRenderedMusic(bufferTikTok, slides)).toBe(true);
  });

  it.each([
    ['music is off', { ...bufferTikTok, publishingDefaults: { autoAddMusic: 'no' } }, slides, null],
    ['Postiz adds music itself', { ...bufferTikTok, connectionProvider: 'postiz' as const }, slides, null],
    ['the channel is not TikTok', { ...bufferTikTok, platform: 'instagram' }, slides, null],
    ['there are no slides', bufferTikTok, [], null],
    ['the content is already a video', bufferTikTok, slides, 'https://cdn.example/v.mp4'],
  ])('leaves the post alone when %s', (_, account, images, videoUrl) => {
    expect(needsRenderedMusic(account as never, images, videoUrl)).toBe(false);
  });
});

describe('PostsService provider submission', () => {
  function build() {
    const publishingProviders = {
      createPost: jest.fn().mockResolvedValue({ id: 'buf_1', url: null, status: 'scheduled' }),
    };
    const tiktokMediaFit = { fitAll: jest.fn(async (_ws: string, urls: string[]) => urls) };
    const slideshowVideo = {
      renderWithMusic: jest.fn().mockResolvedValue('https://cdn.example/rendered.mp4'),
    };
    const service = new PostsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      publishingProviders as never,
      tiktokMediaFit as never,
      slideshowVideo as never,
    );
    return { service, publishingProviders, slideshowVideo };
  }
  const content = {
    type: 'slideshow',
    postCaption: 'Caption',
    hashtags: ['#tag'],
    slideshow: { slides: slides.map((imageUrl) => ({ imageUrl })) },
    video: null,
  };
  const when = new Date('2026-10-20T10:00:00Z');

  it('sends a Buffer TikTok slideshow with music as a rendered video', async () => {
    const { service, publishingProviders, slideshowVideo } = build();

    await service['submitToProvider']('ws1', bufferTikTok as never, content as never, when, false);

    expect(slideshowVideo.renderWithMusic).toHaveBeenCalledWith('ws1', slides);
    expect(publishingProviders.createPost).toHaveBeenCalledWith('ws1', bufferTikTok, {
      text: 'Caption\n\n#tag',
      imageUrls: [],
      videoUrl: 'https://cdn.example/rendered.mp4',
      scheduledFor: when,
      publishNow: false,
    });
  });

  it('keeps the photo carousel when music is off', async () => {
    const { service, publishingProviders, slideshowVideo } = build();
    const account = { ...bufferTikTok, publishingDefaults: { autoAddMusic: 'no' } };

    await service['submitToProvider']('ws1', account as never, content as never, when, true);

    expect(slideshowVideo.renderWithMusic).not.toHaveBeenCalled();
    expect(publishingProviders.createPost).toHaveBeenCalledWith(
      'ws1',
      account,
      expect.objectContaining({ imageUrls: slides, videoUrl: undefined, publishNow: true }),
    );
  });
});

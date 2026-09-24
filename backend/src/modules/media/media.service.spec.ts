import { ApiException, ApiErrorBody } from '../../common/errors/api.exception';
import { MediaService } from './media.service';

function service(): MediaService {
  return new MediaService({} as never, {} as never, {
    assertConfigured() {
      return undefined;
    },
  } as never);
}

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error.code;
  }
  throw new Error('expected throw');
}

describe('MediaService.remove', () => {
  it('removes the library record even when S3 delete is denied', async () => {
    const asset = {
      storageProvider: 's3',
      storageKey: 'workspaces/w/a.jpg',
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    const media = new MediaService(
      {
        findOne: () => ({ exec: async () => asset }),
      } as never,
      {} as never,
      {
        deleteObjectAndInvalidate: jest.fn().mockRejectedValue(
          new ApiException('MEDIA_UPLOAD_FAILED', 'Could not read or write media in storage', 502, {
            status: 403,
            name: 'AccessDenied',
          }),
        ),
      } as never,
    );

    await media.remove('64b0f1c2a1b2c3d4e5f60789', '64b0f1c2a1b2c3d4e5f60788');
    expect(asset.deleteOne).toHaveBeenCalled();
  });
});

describe('MediaService Pinterest URL safety', () => {
  const media = service();

  it('allows Pinterest CDN hosts', () => {
    expect(() => media.assertSafePinImageUrl('https://i.pinimg.com/originals/ab/cd.jpg')).not.toThrow();
    expect(() => media.assertSafePinImageUrl('https://s.pinimg.com/564x/ab.jpg')).not.toThrow();
  });

  it('rejects non-https and non-Pinterest hosts', () => {
    expect(codeOf(() => media.assertSafePinImageUrl('http://i.pinimg.com/x.jpg'))).toBe('REMOTE_MEDIA_UNSAFE');
    expect(codeOf(() => media.assertSafePinImageUrl('https://evil.example/x.jpg'))).toBe('REMOTE_MEDIA_UNSAFE');
    expect(codeOf(() => media.assertSafePinImageUrl('https://pinimg.com.evil.test/x.jpg'))).toBe(
      'REMOTE_MEDIA_UNSAFE',
    );
  });
});

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';

import { FxTwitterXPostProvider } from './fxtwitter-x-post.provider';

describe('FxTwitterXPostProvider', () => {
  it('maps the public API profile into the POSTLOCK domain model', async () => {
    const response = {
      data: {
        code: 200,
        user: {
          id: '44196397',
          screen_name: 'ElonMusk',
          name: 'Elon Musk',
          avatar_url: 'https://pbs.twimg.com/profile_images/example_normal.jpg',
          protected: false,
          verification: { verified: true, type: 'individual' },
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as AxiosResponse;
    const http = { get: jest.fn().mockReturnValue(of(response)) } as unknown as HttpService;
    const config = {
      get: jest.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService;
    const provider = new FxTwitterXPostProvider(http, config);

    await expect(provider.getProfile('elonmusk')).resolves.toEqual({
      providerUserId: '44196397',
      username: 'elonmusk',
      displayName: 'Elon Musk',
      avatarUrl: 'https://pbs.twimg.com/profile_images/example_400x400.jpg',
      isPublic: true,
      isVerified: true,
      verificationType: 'individual',
    });
    expect(http.get).toHaveBeenCalledWith(
      'https://api.fxtwitter.com/2/profile/elonmusk',
      expect.objectContaining({ timeout: 8_000 }),
    );
  });
});

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { ApiException, ApiErrorBody } from '../common/errors/api.exception';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { TwitterAdapter } from './adapters/twitter.adapter';
import { PlatformRegistry } from './platform-registry.service';

function registryWith(config: Record<string, string | undefined>): PlatformRegistry {
  const configService = { get: (key: string) => config[key] } as unknown as ConfigService;
  return new PlatformRegistry(
    new TikTokAdapter(new HttpService(), configService),
    new InstagramAdapter(new HttpService(), configService),
    new TwitterAdapter(new HttpService(), configService),
  );
}

const ALL_CONFIGURED = {
  'platforms.tiktok.clientKey': 'k',
  'platforms.tiktok.clientSecret': 's',
  'platforms.meta.appId': 'i',
  'platforms.meta.appSecret': 's',
  'platforms.twitter.clientId': 'i',
  'platforms.twitter.clientSecret': 's',
};

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return ((error as ApiException).getResponse() as ApiErrorBody).error.code;
  }
  throw new Error('expected the call to throw');
}

describe('PlatformRegistry', () => {
  it('resolves the adapters build step 2 ships', () => {
    const registry = registryWith(ALL_CONFIGURED);

    for (const platform of ['tiktok', 'instagram', 'twitter']) {
      expect(registry.get(platform).capabilities.platform).toBe(platform);
    }
  });

  it('tells an unknown slug apart from a platform that lands in step 9', () => {
    const registry = registryWith(ALL_CONFIGURED);

    // Both are "you can't connect this", but only one is a typo.
    expect(codeOf(() => registry.get('myspace'))).toBe('PLATFORM_NOT_SUPPORTED');
    expect(codeOf(() => registry.get('pinterest'))).toBe('PLATFORM_NOT_SUPPORTED');
    expect(codeOf(() => registry.get('pinterest'))).not.toBe('PLATFORM_NOT_CONFIGURED');
  });

  it('separates missing credentials from a missing adapter', () => {
    // Implemented, but this deployment has no TikTok keys.
    expect(codeOf(() => registryWith({}).get('tiktok'))).toBe('PLATFORM_NOT_CONFIGURED');
  });

  it('lists every platform with its implemented and configured state', () => {
    const listed = registryWith({
      'platforms.meta.appId': 'i',
      'platforms.meta.appSecret': 's',
    }).list();

    expect(listed).toHaveLength(6);
    expect(listed.find((p) => p.platform === 'instagram')).toMatchObject({
      implemented: true,
      configured: true,
    });
    expect(listed.find((p) => p.platform === 'tiktok')).toMatchObject({
      implemented: true,
      configured: false,
    });
    expect(listed.find((p) => p.platform === 'linkedin')).toMatchObject({
      implemented: false,
      configured: false,
      capabilities: null,
    });
  });
});

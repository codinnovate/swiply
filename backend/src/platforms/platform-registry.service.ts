import { Injectable } from '@nestjs/common';

import { ApiException } from '../common/errors/api.exception';
import {
  PLATFORMS,
  type Platform,
} from '../modules/social-accounts/schemas/social-account.schema';
import { InstagramAdapter } from './adapters/instagram.adapter';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { TwitterAdapter } from './adapters/twitter.adapter';
import type { PlatformAdapter } from './platform-adapter.interface';

export interface PlatformAvailability {
  platform: Platform;
  /** An adapter exists in this build (Section 15 lands the rest in step 9). */
  implemented: boolean;
  /** Credentials are present, so connecting will actually work. */
  configured: boolean;
  capabilities: PlatformAdapter['capabilities'] | null;
}

/**
 * Resolves a platform slug to its adapter. Build step 2 ships TikTok,
 * Instagram, and X; Facebook, Pinterest, and LinkedIn arrive in step 9 and
 * report as unimplemented until then rather than 404ing as unknown, which
 * would be indistinguishable from a typo.
 */
@Injectable()
export class PlatformRegistry {
  private readonly adapters: Partial<Record<Platform, PlatformAdapter>>;

  constructor(
    tiktok: TikTokAdapter,
    instagram: InstagramAdapter,
    twitter: TwitterAdapter,
  ) {
    this.adapters = { tiktok, instagram, twitter };
  }

  /** Throws unless the platform has an adapter *and* usable credentials. */
  get(platform: string): PlatformAdapter {
    if (!this.isPlatform(platform)) {
      throw ApiException.unprocessable(
        'PLATFORM_NOT_SUPPORTED',
        `Unknown platform "${platform}"`,
        { supported: [...PLATFORMS] },
      );
    }

    const adapter = this.adapters[platform];
    if (!adapter) {
      throw ApiException.unprocessable(
        'PLATFORM_NOT_SUPPORTED',
        `${platform} connections are not available yet`,
        { platform },
      );
    }

    if (!adapter.isConfigured()) {
      throw ApiException.unprocessable(
        'PLATFORM_NOT_CONFIGURED',
        `${platform} is not configured on this deployment`,
        { platform },
      );
    }

    return adapter;
  }

  /**
   * Every platform with its current state, so the dashboard can grey out what
   * this deployment cannot connect instead of failing on click.
   */
  list(): PlatformAvailability[] {
    return PLATFORMS.map((platform) => {
      const adapter = this.adapters[platform];
      return {
        platform,
        implemented: Boolean(adapter),
        configured: Boolean(adapter?.isConfigured()),
        capabilities: adapter?.capabilities ?? null,
      };
    });
  }

  private isPlatform(value: string): value is Platform {
    return (PLATFORMS as readonly string[]).includes(value);
  }
}

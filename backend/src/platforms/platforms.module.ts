import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { InstagramAdapter } from './adapters/instagram.adapter';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { TwitterAdapter } from './adapters/twitter.adapter';
import { OAuthStateService } from './oauth-state.service';
import { PlatformRegistry } from './platform-registry.service';

const ADAPTERS = [TikTokAdapter, InstagramAdapter, TwitterAdapter];

@Module({
  imports: [
    // Platform APIs are the slowest thing in the request path and the most
    // likely to hang; a bounded timeout keeps a stalled provider from pinning
    // a Nest worker until the client gives up.
    HttpModule.register({ timeout: 10_000, maxRedirects: 3 }),
  ],
  providers: [...ADAPTERS, PlatformRegistry, OAuthStateService],
  exports: [PlatformRegistry, OAuthStateService],
})
export class PlatformsModule {}

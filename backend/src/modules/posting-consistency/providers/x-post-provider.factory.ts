import { ConfigService } from '@nestjs/config';

import type { XPostProvider } from '../domain/x-post-provider.interface';
import { DevelopmentXPostProvider } from './development-x-post.provider';
import { FxTwitterXPostProvider } from './fxtwitter-x-post.provider';
import { HttpXPostProvider } from './http-x-post.provider';

export function createXPostProvider(
  config: ConfigService,
  developmentProvider: DevelopmentXPostProvider,
  fxTwitterProvider: FxTwitterXPostProvider,
  httpProvider: HttpXPostProvider,
): XPostProvider {
  const provider = config.get<string>('postingConsistency.provider', 'fxtwitter');
  if (provider === 'http') return httpProvider;
  if (provider === 'fxtwitter') return fxTwitterProvider;

  if (config.get<string>('app.nodeEnv', 'development') === 'production') {
    throw new Error('The development X data provider cannot be used in production');
  }
  return developmentProvider;
}

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { X_POST_PROVIDER } from './domain/x-post-provider.interface';
import { PostingConsistencyController } from './posting-consistency.controller';
import { PostingConsistencyService } from './posting-consistency.service';
import { DevelopmentXPostProvider } from './providers/development-x-post.provider';
import { FxTwitterXPostProvider } from './providers/fxtwitter-x-post.provider';
import { HttpXPostProvider } from './providers/http-x-post.provider';
import { createXPostProvider } from './providers/x-post-provider.factory';

@Module({
  imports: [HttpModule],
  controllers: [PostingConsistencyController],
  providers: [
    PostingConsistencyService,
    DevelopmentXPostProvider,
    FxTwitterXPostProvider,
    HttpXPostProvider,
    {
      provide: X_POST_PROVIDER,
      inject: [ConfigService, DevelopmentXPostProvider, FxTwitterXPostProvider, HttpXPostProvider],
      useFactory: createXPostProvider,
    },
  ],
})
export class PostingConsistencyModule {}

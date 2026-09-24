import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AiCredentialsService } from './ai-credentials.service';
import { AiProviderRegistry } from './ai-provider-registry.service';
import type { AiProvider } from './ai-providers';
import {
  GOAL_GUIDANCE,
  buildSlideshowSystemPrompt,
  buildSlideshowUserPrompt,
} from './copy-prompt';

export { GOAL_GUIDANCE };

const copySchema = z.object({
  postCaption: z.string().min(1),
  hashtags: z.array(z.string().regex(/^#[\w-]+$/u)).max(8),
  slides: z.array(z.object({ caption: z.string().min(1), altText: z.string().min(1) })).max(35),
  postText: z.string().min(1),
});

export interface CopyRequest {
  userId: string;
  model?: string;
  provider?: AiProvider;
  topic: string;
  targetCountry?: string;
  language?: string;
  goal: string;
  slideCount: number;
  voiceContext: string;
  websiteBrief?: string;
  tiktokInsights?: string;
  assetNames?: string[];
  uniquenessContext?: string;
}

@Injectable()
export class TextService {
  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly providers: AiProviderRegistry,
  ) {}

  async generate(request: CopyRequest) {
    const credential = await this.credentials.resolve(request.userId, request.model, request.provider);
    const prompt = {
      topic: request.topic,
      goal: request.goal,
      slideCount: request.slideCount,
      voiceContext: request.voiceContext,
      targetCountry: request.targetCountry,
      language: request.language,
      websiteBrief: request.websiteBrief,
      tiktokInsights: request.tiktokInsights,
      assetNames: request.assetNames,
      uniquenessContext: request.uniquenessContext,
    };
    const copy = await this.providers.completeStructured(
      credential.provider,
      credential.apiKey,
      request.userId,
      credential.model,
      {
        maxTokens: 1800,
        system: buildSlideshowSystemPrompt(prompt),
        user: buildSlideshowUserPrompt(prompt),
      },
      copySchema,
    );
    return { ...copy, model: credential.model, provider: credential.provider };
  }
}

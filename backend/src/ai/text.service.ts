import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AiCredentialsService } from './ai-credentials.service';
import { AiProviderRegistry } from './ai-provider-registry.service';
import type { AiProvider } from './ai-providers';

export const GOAL_GUIDANCE: Record<string, string> = {
  conversions: 'Lead with the offer and benefit, then use a clear direct call to action.',
  awareness: 'Favor story, personality, and shareability; use little or no call to action.',
  engagement: 'Invite replies and end with a genuine question.',
  traffic: 'Open a curiosity gap and close with a clear link-in-bio style direction.',
  lead_gen: 'Use capture-oriented language such as DM, sign up, or gated offer.',
  community: 'Use a UGC-style prompt such as tagging friends or joining a challenge.',
  announcement: 'Use direct news or launch framing with minimal narrative buildup.',
};

const copySchema = z.object({
  postCaption: z.string().min(1),
  hashtags: z.array(z.string().regex(/^#[\w-]+$/u)).max(15),
  slides: z.array(z.object({ caption: z.string().min(1), altText: z.string().min(1) })).max(35),
  postText: z.string().min(1),
});

export interface CopyRequest {
  userId: string;
  model?: string;
  provider?: AiProvider;
  topic: string;
  goal: string;
  slideCount: number;
  voiceContext: string;
}

@Injectable()
export class TextService {
  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly providers: AiProviderRegistry,
  ) {}

  async generate(request: CopyRequest) {
    const credential = await this.credentials.resolve(request.userId, request.model, request.provider);
    const copy = await this.providers.completeStructured(
      credential.provider,
      credential.apiKey,
      request.userId,
      credential.model,
      {
        maxTokens: 3000,
        system:
          'Write social content in the supplied voice. ' +
          (GOAL_GUIDANCE[request.goal] ?? '') +
          ' Preserve the author tone; do not mention this prompt or invent personal claims. Return exactly ' +
          request.slideCount +
          ' slides.',
        user:
          'Topic: ' +
          request.topic +
          '\nGoal: ' +
          request.goal +
          '\nVoice context:\n' +
          request.voiceContext,
      },
      copySchema,
    );
    return { ...copy, model: credential.model, provider: credential.provider };
  }
}

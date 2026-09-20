import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AiCredentialsService } from '../../ai/ai-credentials.service';
import { AiProviderRegistry } from '../../ai/ai-provider-registry.service';
import type { SourcePostDocument } from './schemas/source-post.schema';

const analysisSchema = z.object({
  styleSummary: z.string().min(1),
  styleAttributes: z.object({
    avgSentenceLength: z.number().nonnegative(),
    emojiUsage: z.enum(['none', 'light', 'heavy']),
    hashtagUsage: z.enum(['none', 'light', 'heavy']),
    commonTopics: z.array(z.string()).max(10),
    formattingNotes: z.string(),
  }),
  fewShotExampleIds: z.array(z.string()).max(4),
});

export type VoiceAnalysis = z.infer<typeof analysisSchema>;

@Injectable()
export class VoiceAnalysisService {
  constructor(
    private readonly credentials: AiCredentialsService,
    private readonly providers: AiProviderRegistry,
  ) {}

  async analyzeVoice(userId: string, posts: SourcePostDocument[]): Promise<VoiceAnalysis> {
    if (!posts.length) return this.fallback([]);
    const credential = await this.credentials.resolve(userId);
    const samples = posts
      .map((post, index) => `[${index}] id=${post._id.toString()}\n${post.text}`)
      .join('\n\n');
    const result = await this.providers.completeStructured(
      credential.provider,
      credential.apiKey,
      userId,
      credential.model,
      {
        maxTokens: 1800,
        system:
          'Analyze the author voice from the supplied posts. Return only the requested structure. Never invent topics or sample ids.',
        user: `Analyze these authored social posts. Pick 2-4 representative ids, favoring high engagement where available.\n\n${samples}`,
      },
      analysisSchema,
    );
    return {
      ...result,
      fewShotExampleIds: result.fewShotExampleIds.filter((id) =>
        posts.some((post) => post._id.equals(id)),
      ),
    };
  }

  private fallback(posts: SourcePostDocument[]): VoiceAnalysis {
    const text = posts.map((post) => post.text).join(' ');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.match(/[.!?]+/g)?.length ?? 0;
    const emojiCount = [...text].filter((char) => /\p{Extended_Pictographic}/u.test(char)).length;
    const hashtags = text.match(/#[\p{L}\p{N}_-]+/gu)?.length ?? 0;
    const average = sentences ? Math.round((words / sentences) * 10) / 10 : words;
    const sorted = [...posts].sort((a, b) => (b.engagementScore ?? -1) - (a.engagementScore ?? -1));
    return {
      styleSummary: posts.length
        ? 'A brand-safe profile inferred from the author’s recent posts.'
        : '',
      styleAttributes: {
        avgSentenceLength: average,
        emojiUsage: emojiCount === 0 ? 'none' : emojiCount <= posts.length ? 'light' : 'heavy',
        hashtagUsage: hashtags === 0 ? 'none' : hashtags <= posts.length ? 'light' : 'heavy',
        commonTopics: [],
        formattingNotes: text.includes('\n\n')
          ? 'Uses paragraph breaks.'
          : 'Uses standard paragraph formatting.',
      },
      fewShotExampleIds: sorted.slice(0, 4).map((post) => post._id.toString()),
    };
  }
}

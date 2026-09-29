import { Inject, Injectable, Logger } from '@nestjs/common';

import { ApiException } from '../../../common/errors/api.exception';
import { REWRITE_SYSTEM_PROMPT, VIRALITY_SCORING_SYSTEM_PROMPT } from '../domain/prompts';
import {
  parseRewriteVariants,
  parseViralityScore,
  ViralityScoreParseError,
  type ViralityScore,
} from '../domain/virality-score';
import { VIRALITY_LLM, type ViralityLlm } from './llm-providers';

@Injectable()
export class ViralityScorerService {
  private readonly logger = new Logger(ViralityScorerService.name);

  constructor(@Inject(VIRALITY_LLM) private readonly llm: ViralityLlm | null) {}

  get isAvailable(): boolean {
    return this.llm !== null;
  }

  /** Recorded on each score, e.g. `openai:gpt-5-mini`. */
  get modelLabel(): string | null {
    return this.llm ? `${this.llm.provider}:${this.llm.model}` : null;
  }

  /** Scores one post. `input` is the user message documented in the system prompt. */
  score(input: object): Promise<ViralityScore> {
    return this.completeJson(VIRALITY_SCORING_SYSTEM_PROMPT, input, 1_500, parseViralityScore);
  }

  rewrite(originalText: string, score: ViralityScore): Promise<string[]> {
    return this.completeJson(
      REWRITE_SYSTEM_PROMPT,
      {
        original_post: originalText,
        total_score: score.total_score,
        breakdown: score.breakdown,
        top_weakness: score.top_weakness,
        suggestions: score.suggestions,
      },
      1_200,
      parseRewriteVariants,
    );
  }

  /** One retry when the reply isn't the JSON shape we asked for. */
  private async completeJson<T>(
    system: string,
    input: object,
    maxTokens: number,
    parse: (raw: string) => T,
  ): Promise<T> {
    if (!this.llm) {
      throw ApiException.unprocessable(
        'VIRALITY_SCORING_UNAVAILABLE',
        'Post scoring is not configured on this server.',
      );
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.llm.completeJson(system, JSON.stringify(input, null, 2), maxTokens);
        return parse(text);
      } catch (error) {
        lastError = error;
        if (!(error instanceof ViralityScoreParseError)) break;
        this.logger.warn(`Scoring reply was malformed (attempt ${attempt + 1}): ${error.message}`);
      }
    }
    this.logger.error(
      `Scoring call failed: ${lastError instanceof Error ? lastError.message : lastError}`,
    );
    throw ApiException.unprocessable(
      'VIRALITY_SCORING_FAILED',
      'We could not score this post right now. Please try again.',
    );
  }
}

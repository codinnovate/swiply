import { createHash } from 'node:crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';

import { ApiException } from '../common/errors/api.exception';

export interface OpenAiPrompt {
  system: string;
  user: string;
  maxTokens?: number;
}

@Injectable()
export class OpenAiGateway {
  private readonly logger = new Logger(OpenAiGateway.name);

  async validateKey(apiKey: string, model: string): Promise<void> {
    try {
      await new OpenAI({ apiKey }).models.retrieve(model);
    } catch (error) {
      throw this.failure(error, true);
    }
  }

  async completeStructured<T>(
    apiKey: string,
    userId: string,
    model: string,
    prompt: OpenAiPrompt,
    schema: ZodType<T>,
  ): Promise<T> {
    try {
      const response = await new OpenAI({ apiKey }).responses.parse({
        model,
        instructions: prompt.system,
        input: prompt.user,
        max_output_tokens: prompt.maxTokens ?? 4096,
        store: false,
        safety_identifier: createHash('sha256').update(userId).digest('hex'),
        text: { format: zodTextFormat(schema, 'swiply_response') },
      });
      if (response.output_parsed === null) {
        throw new Error('OpenAI returned output that did not match the requested schema');
      }
      return response.output_parsed;
    } catch (error) {
      throw this.failure(error, false);
    }
  }

  private failure(error: unknown, validatingKey: boolean): ApiException {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    const message = error instanceof Error ? error.message : 'unknown error';
    this.logger.error(`OpenAI request failed (status ${status ?? 'none'}): ${message}`);

    if (validatingKey && (status === 401 || status === 403 || status === 404)) {
      return ApiException.unprocessable(
        'AI_CREDENTIAL_INVALID',
        'The OpenAI key is invalid or cannot access the selected model',
      );
    }
    return new ApiException(
      status === 429 ? 'AI_RATE_LIMITED' : 'AI_REQUEST_FAILED',
      status === 429
        ? 'OpenAI is rate limiting this key; try again shortly'
        : 'OpenAI could not complete this request',
      status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
    );
  }
}

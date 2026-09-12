import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ApiException } from '../common/errors/api.exception';
import { AI_PROVIDER_DEFINITIONS, AiProvider, isProviderModel } from './ai-providers';
import { OpenAiGateway, OpenAiPrompt } from './openai-gateway.service';

@Injectable()
export class AiProviderRegistry {
  private readonly logger = new Logger(AiProviderRegistry.name);

  constructor(private readonly openai: OpenAiGateway) {}

  list() {
    return AI_PROVIDER_DEFINITIONS;
  }

  models(provider?: AiProvider) {
    return provider ? this.list().find((item) => item.id === provider)?.models ?? [] : this.list().flatMap((item) => item.models);
  }

  assertModel(provider: AiProvider, model: string): void {
    if (!isProviderModel(provider, model)) {
      throw ApiException.unprocessable('AI_MODEL_NOT_SUPPORTED', `The selected ${provider} model is not supported`);
    }
  }

  async validateKey(provider: AiProvider, apiKey: string, model: string): Promise<void> {
    this.assertModel(provider, model);
    if (provider === 'openai') return this.openai.validateKey(apiKey, model);
    const response = provider === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } })
      : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) throw this.failure(provider, response.status, true);
  }

  async completeStructured<T>(provider: AiProvider, apiKey: string, userId: string, model: string, prompt: OpenAiPrompt, schema: ZodType<T>): Promise<T> {
    this.assertModel(provider, model);
    if (provider === 'openai') return this.openai.completeStructured(apiKey, userId, model, prompt, schema);
    try {
      const response = provider === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: prompt.maxTokens ?? 4096, system: `${prompt.system}\nReturn only valid JSON matching the requested structure.`, messages: [{ role: 'user', content: prompt.user }] }) })
        : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: prompt.system }] }, contents: [{ role: 'user', parts: [{ text: `${prompt.user}\nReturn only valid JSON matching the requested structure.` }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: prompt.maxTokens ?? 4096 } }) });
      if (!response.ok) throw this.failure(provider, response.status, false);
      const body = await response.json() as Record<string, unknown>;
      const text = provider === 'anthropic'
        ? ((body.content as Array<{ text?: string }> | undefined)?.find((item) => item.text)?.text ?? '')
        : (((body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0]?.content?.parts?.[0]?.text) ?? '');
      const parsed = schema.safeParse(JSON.parse(this.stripFence(text)));
      if (!parsed.success) throw new Error(`Provider response failed schema validation: ${parsed.error.message}`);
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.logger.error(`${provider} structured generation failed`, error);
      throw this.failure(provider, undefined, false);
    }
  }

  private stripFence(value: string): string {
    return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  private failure(provider: AiProvider, status?: number, validating = false): ApiException {
    if (validating && (status === 400 || status === 401 || status === 403 || status === 404)) return ApiException.unprocessable('AI_CREDENTIAL_INVALID', `The ${provider} key is invalid or cannot access the selected model`);
    return new ApiException(status === 429 ? 'AI_RATE_LIMITED' : 'AI_REQUEST_FAILED', status === 429 ? `${provider} is rate limiting this key; try again shortly` : `${provider} could not complete this request`, status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY);
  }
}

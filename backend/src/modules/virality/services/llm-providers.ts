import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * The one capability scoring and rewrites need from a model: a system prompt
 * and a user message in, JSON text out. Each provider adapts its own API to
 * this; callers parse and validate the JSON themselves.
 */
export interface ViralityLlm {
  readonly provider: ViralityLlmProvider;
  readonly model: string;
  completeJson(system: string, user: string, maxOutputTokens: number): Promise<string>;
}

export const VIRALITY_LLM_PROVIDERS = ['openai', 'xai'] as const;
export type ViralityLlmProvider = (typeof VIRALITY_LLM_PROVIDERS)[number];

export const DEFAULT_VIRALITY_MODELS: Record<ViralityLlmProvider, string> = {
  openai: 'gpt-5-mini',
  xai: 'grok-4',
};

/** `null` when the selected provider has no API key configured. */
export const VIRALITY_LLM = Symbol('VIRALITY_LLM');

/** OpenAI, via the Responses API in JSON mode. */
export class OpenAiViralityLlm implements ViralityLlm {
  readonly provider = 'openai' as const;

  constructor(
    private readonly client: OpenAI,
    readonly model: string,
  ) {}

  async completeJson(system: string, user: string, maxOutputTokens: number): Promise<string> {
    const reasoning = /^(gpt-5|o\d)/.test(this.model);
    const response = await this.client.responses.create({
      model: this.model,
      instructions: system,
      input: user,
      store: false,
      text: { format: { type: 'json_object' } },
      // Reasoning tokens count against the output budget, so leave headroom.
      max_output_tokens: reasoning ? Math.max(maxOutputTokens, 4_096) : maxOutputTokens,
      ...(reasoning ? { reasoning: { effort: 'low' as const } } : {}),
    });
    return response.output_text;
  }
}

/** xAI Grok, via its OpenAI-compatible Chat Completions endpoint. */
export class XaiViralityLlm implements ViralityLlm {
  readonly provider = 'xai' as const;

  constructor(
    private readonly client: OpenAI,
    readonly model: string,
  ) {}

  async completeJson(system: string, user: string, maxOutputTokens: number): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxOutputTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}

export function createViralityLlm(config: ConfigService): ViralityLlm | null {
  const logger = new Logger('ViralityLlm');
  const provider = config.get<ViralityLlmProvider>('virality.aiProvider', 'openai');
  const model = config.get<string>('virality.aiModel') || DEFAULT_VIRALITY_MODELS[provider];
  const options = { maxRetries: 2, timeout: 60_000 };

  if (provider === 'xai') {
    const apiKey = config.get<string>('virality.xaiApiKey');
    if (!apiKey) return logUnavailable(logger, 'XAI_API_KEY');
    return new XaiViralityLlm(
      new OpenAI({ ...options, apiKey, baseURL: 'https://api.x.ai/v1' }),
      model,
    );
  }
  const apiKey = config.get<string>('virality.openaiApiKey');
  if (!apiKey) return logUnavailable(logger, 'OPENAI_API_KEY');
  return new OpenAiViralityLlm(new OpenAI({ ...options, apiKey }), model);
}

function logUnavailable(logger: Logger, variable: string): null {
  logger.warn(`${variable} is not set; POSTLOCK posts will sync but stay unscored.`);
  return null;
}

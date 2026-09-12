export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiModelDefinition {
  id: string;
  name: string;
  provider: AiProvider;
  capabilities: Array<'text' | 'structured_output' | 'image_input' | 'image_generation'>;
}

export const AI_MODELS: readonly AiModelDefinition[] = [
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', provider: 'anthropic', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', capabilities: ['text', 'structured_output', 'image_input'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'gemini', capabilities: ['text', 'structured_output', 'image_input'] },
] as const;

export const AI_PROVIDER_DEFINITIONS = AI_PROVIDERS.map((id) => ({
  id,
  name: id === 'openai' ? 'OpenAI' : id === 'anthropic' ? 'Anthropic' : 'Google Gemini',
  models: AI_MODELS.filter((model) => model.provider === id),
}));

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function isProviderModel(provider: AiProvider, model: string): boolean {
  return AI_MODELS.some((item) => item.provider === provider && item.id === model);
}

export function defaultModelFor(provider: AiProvider): string {
  if (provider === 'openai') return 'gpt-5-mini';
  if (provider === 'anthropic') return 'claude-sonnet-4-5';
  return 'gemini-2.5-flash';
}

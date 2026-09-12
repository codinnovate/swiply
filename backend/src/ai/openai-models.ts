import { AI_MODELS } from './ai-providers';

/** Backwards-compatible OpenAI-only view used by existing clients and DTOs. */
export const OPENAI_MODELS = AI_MODELS.filter((model) => model.provider === 'openai');

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export type OpenAiModel = string;

export function isOpenAiModel(value: string): value is OpenAiModel {
  return OPENAI_MODELS.some((model) => model.id === value);
}

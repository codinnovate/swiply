export const SCORE_CATEGORIES = [
  'hook_strength',
  'reply_bait',
  'emotional_charge',
  'format_structure',
  'niche_consistency',
  'risk_factors',
  'timing',
] as const;

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

/** Inclusive score range per category. Risk factors are subtractive. */
export const CATEGORY_RANGES: Record<ScoreCategory, { min: number; max: number }> = {
  hook_strength: { min: 0, max: 25 },
  reply_bait: { min: 0, max: 25 },
  emotional_charge: { min: 0, max: 15 },
  format_structure: { min: 0, max: 15 },
  niche_consistency: { min: 0, max: 10 },
  risk_factors: { min: -20, max: 0 },
  timing: { min: 0, max: 10 },
};

export interface CategoryScore {
  score: number;
  max: number;
  reasoning: string;
}

export interface ViralityScore {
  total_score: number;
  breakdown: Record<ScoreCategory, CategoryScore>;
  top_strength: string;
  top_weakness: string;
  suggestions: string[];
}

export class ViralityScoreParseError extends Error {}

/** Parses a model reply that should be JSON, tolerating stray fences or preamble. */
export function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new ViralityScoreParseError('No JSON object in reply');
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new ViralityScoreParseError('Reply was not valid JSON');
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ViralityScoreParseError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validates the scoring engine's JSON and normalizes it: each category is
 * clamped to its range, and `total_score` is recomputed as the clamped sum so
 * the headline number always agrees with the breakdown the user sees.
 */
export function parseViralityScore(raw: string): ViralityScore {
  const parsed = extractJsonObject(raw) as Record<string, unknown>;
  const breakdownInput = parsed.breakdown as Record<string, Record<string, unknown>> | undefined;
  if (!breakdownInput || typeof breakdownInput !== 'object') {
    throw new ViralityScoreParseError('breakdown is missing');
  }

  const breakdown = {} as Record<ScoreCategory, CategoryScore>;
  for (const category of SCORE_CATEGORIES) {
    const entry = breakdownInput[category];
    const score = Number(entry?.score);
    if (!entry || !Number.isFinite(score)) {
      throw new ViralityScoreParseError(`breakdown.${category}.score is missing`);
    }
    const range = CATEGORY_RANGES[category];
    breakdown[category] = {
      score: clamp(Math.round(score), range.min, range.max),
      max: range.max,
      reasoning: typeof entry.reasoning === 'string' ? entry.reasoning.trim() : '',
    };
  }

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
  if (suggestions.length === 0) throw new ViralityScoreParseError('suggestions are missing');

  const sum = SCORE_CATEGORIES.reduce((total, category) => total + breakdown[category].score, 0);
  return {
    total_score: clamp(sum, 0, 100),
    breakdown,
    top_strength: requireString(parsed.top_strength, 'top_strength'),
    top_weakness: requireString(parsed.top_weakness, 'top_weakness'),
    suggestions: suggestions.map((item) => item.trim()).slice(0, 3),
  };
}

export function parseRewriteVariants(raw: string): string[] {
  const parsed = extractJsonObject(raw) as { variants?: unknown };
  const variants = Array.isArray(parsed.variants)
    ? parsed.variants.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
  if (variants.length === 0) throw new ViralityScoreParseError('variants are missing');
  return variants.map((item) => item.trim()).slice(0, 2);
}

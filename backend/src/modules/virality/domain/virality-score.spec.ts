import {
  parseRewriteVariants,
  parseViralityScore,
  ViralityScoreParseError,
} from './virality-score';

const breakdown = (overrides: Record<string, number> = {}) => ({
  hook_strength: { score: 18, max: 25, reasoning: 'Specific number up front.' },
  reply_bait: { score: 12, max: 25, reasoning: 'No question.' },
  emotional_charge: { score: 9, max: 15, reasoning: 'Mild surprise.' },
  format_structure: { score: 12, max: 15, reasoning: 'Short lines.' },
  niche_consistency: { score: 8, max: 10, reasoning: 'On topic.' },
  risk_factors: { score: -5, max: 0, reasoning: 'Link in main post.' },
  timing: { score: 6, max: 10, reasoning: 'Evening.' },
  ...Object.fromEntries(
    Object.entries(overrides).map(([key, score]) => [key, { score, max: 0, reasoning: '' }]),
  ),
});

const reply = (extra: object = {}) =>
  JSON.stringify({
    total_score: 99,
    breakdown: breakdown(),
    top_strength: 'Strong hook.',
    top_weakness: 'Nothing to reply to.',
    suggestions: ['Ask a question.', 'Move the link.', 'Cut the last line.'],
    ...extra,
  });

describe('parseViralityScore', () => {
  it('recomputes total_score from the breakdown instead of trusting the model', () => {
    const score = parseViralityScore(reply());
    expect(score.total_score).toBe(18 + 12 + 9 + 12 + 8 - 5 + 6);
    expect(score.breakdown.risk_factors).toEqual({
      score: -5,
      max: 0,
      reasoning: 'Link in main post.',
    });
  });

  it('clamps categories to their ranges and the total to 0-100', () => {
    const score = parseViralityScore(
      reply({ breakdown: breakdown({ hook_strength: 40, risk_factors: -35, timing: -3 }) }),
    );
    expect(score.breakdown.hook_strength.score).toBe(25);
    expect(score.breakdown.hook_strength.max).toBe(25);
    expect(score.breakdown.risk_factors.score).toBe(-20);
    expect(score.breakdown.timing.score).toBe(0);

    const floor = parseViralityScore(
      reply({
        breakdown: breakdown({
          hook_strength: 0,
          reply_bait: 0,
          emotional_charge: 0,
          format_structure: 0,
          niche_consistency: 0,
          timing: 0,
          risk_factors: -20,
        }),
      }),
    );
    expect(floor.total_score).toBe(0);
  });

  it('tolerates markdown fences and preamble around the JSON', () => {
    expect(parseViralityScore(`Here you go:\n\`\`\`json\n${reply()}\n\`\`\``).top_strength).toBe(
      'Strong hook.',
    );
  });

  it('rejects replies missing a category or suggestions', () => {
    const missing = breakdown() as Record<string, unknown>;
    delete missing.timing;
    expect(() => parseViralityScore(reply({ breakdown: missing }))).toThrow(
      ViralityScoreParseError,
    );
    expect(() => parseViralityScore(reply({ suggestions: [] }))).toThrow(ViralityScoreParseError);
    expect(() => parseViralityScore('not json')).toThrow(ViralityScoreParseError);
  });

  it('keeps at most three suggestions', () => {
    expect(parseViralityScore(reply({ suggestions: ['a', 'b', 'c', 'd'] })).suggestions).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('parseRewriteVariants', () => {
  it('returns up to two trimmed variants', () => {
    expect(parseRewriteVariants('{"variants":[" one ","two","three"]}')).toEqual(['one', 'two']);
    expect(() => parseRewriteVariants('{"variants":[]}')).toThrow(ViralityScoreParseError);
  });
});

import { VIRALITY_SCORING_SYSTEM_PROMPT } from '../domain/prompts';
import type { ViralityLlm } from './llm-providers';
import { ViralityScorerService } from './virality-scorer.service';

const validReply = JSON.stringify({
  total_score: 50,
  breakdown: Object.fromEntries(
    [
      'hook_strength',
      'reply_bait',
      'emotional_charge',
      'format_structure',
      'niche_consistency',
      'risk_factors',
      'timing',
    ].map((key) => [key, { score: key === 'risk_factors' ? 0 : 5, reasoning: 'ok' }]),
  ),
  top_strength: 'Clear.',
  top_weakness: 'Flat.',
  suggestions: ['Ask something.'],
});

const llmReplying = (...texts: string[]) => {
  const completeJson = jest.fn();
  for (const text of texts) completeJson.mockResolvedValueOnce(text);
  const llm: ViralityLlm = { provider: 'openai', model: 'gpt-5-mini', completeJson };
  return { llm, completeJson };
};

describe('ViralityScorerService', () => {
  it('sends the spec system prompt and the post input as JSON', async () => {
    const { llm, completeJson } = llmReplying(validReply);
    const scorer = new ViralityScorerService(llm);

    const score = await scorer.score({ post_text: 'hello' });

    expect(score.total_score).toBe(30);
    expect(scorer.modelLabel).toBe('openai:gpt-5-mini');
    expect(completeJson).toHaveBeenCalledWith(
      VIRALITY_SCORING_SYSTEM_PROMPT,
      expect.stringContaining('"post_text": "hello"'),
      1_500,
    );
  });

  it('retries once when the reply is not valid JSON', async () => {
    const { llm, completeJson } = llmReplying('sorry, no', validReply);
    await expect(new ViralityScorerService(llm).score({})).resolves.toBeDefined();
    expect(completeJson).toHaveBeenCalledTimes(2);
  });

  it('does not retry provider errors, and reports a scoring failure', async () => {
    const completeJson = jest.fn().mockRejectedValue(new Error('429'));
    const scorer = new ViralityScorerService({ provider: 'xai', model: 'grok-4', completeJson });
    await expect(scorer.score({})).rejects.toMatchObject({ code: 'VIRALITY_SCORING_FAILED' });
    expect(completeJson).toHaveBeenCalledTimes(1);
  });

  it('reports a scoring failure after two malformed replies', async () => {
    const { llm } = llmReplying('nope', 'still nope');
    await expect(new ViralityScorerService(llm).score({})).rejects.toMatchObject({
      code: 'VIRALITY_SCORING_FAILED',
    });
  });

  it('is unavailable without a configured provider', async () => {
    const scorer = new ViralityScorerService(null);
    expect(scorer.isAvailable).toBe(false);
    expect(scorer.modelLabel).toBeNull();
    await expect(scorer.score({})).rejects.toMatchObject({ code: 'VIRALITY_SCORING_UNAVAILABLE' });
  });
});

import type { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';

import { createViralityLlm, OpenAiViralityLlm, XaiViralityLlm } from './llm-providers';

const configWith = (values: Record<string, string | undefined>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  }) as unknown as ConfigService;

describe('createViralityLlm', () => {
  it('defaults to OpenAI with its default model', () => {
    const llm = createViralityLlm(configWith({ 'virality.openaiApiKey': 'sk-test' }));
    expect(llm).toBeInstanceOf(OpenAiViralityLlm);
    expect(llm?.model).toBe('gpt-5-mini');
  });

  it('selects Grok and honours a model override', () => {
    const llm = createViralityLlm(
      configWith({
        'virality.aiProvider': 'xai',
        'virality.aiModel': 'grok-4-fast',
        'virality.xaiApiKey': 'xai-test',
      }),
    );
    expect(llm).toBeInstanceOf(XaiViralityLlm);
    expect(llm?.model).toBe('grok-4-fast');
  });

  it("returns null when the selected provider's key is missing", () => {
    expect(
      createViralityLlm(
        configWith({ 'virality.aiProvider': 'xai', 'virality.openaiApiKey': 'sk' }),
      ),
    ).toBeNull();
    expect(createViralityLlm(configWith({}))).toBeNull();
  });
});

describe('OpenAiViralityLlm', () => {
  it('uses the Responses API in JSON mode, with reasoning headroom for GPT-5', async () => {
    const create = jest.fn().mockResolvedValue({ output_text: '{"ok":true}' });
    const client = { responses: { create } } as unknown as OpenAI;

    await expect(
      new OpenAiViralityLlm(client, 'gpt-5-mini').completeJson('sys', 'usr', 1_500),
    ).resolves.toBe('{"ok":true}');
    expect(create).toHaveBeenCalledWith({
      model: 'gpt-5-mini',
      instructions: 'sys',
      input: 'usr',
      store: false,
      text: { format: { type: 'json_object' } },
      max_output_tokens: 4_096,
      reasoning: { effort: 'low' },
    });

    await new OpenAiViralityLlm(client, 'gpt-4.1').completeJson('sys', 'usr', 1_500);
    expect(create).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ reasoning: expect.anything() }),
    );
    expect(create.mock.lastCall[0].max_output_tokens).toBe(1_500);
  });
});

describe('XaiViralityLlm', () => {
  it('uses the OpenAI-compatible chat endpoint', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: '{"ok":true}' } }] });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;

    await expect(
      new XaiViralityLlm(client, 'grok-4').completeJson('sys', 'usr', 1_200),
    ).resolves.toBe('{"ok":true}');
    expect(create).toHaveBeenCalledWith({
      model: 'grok-4',
      max_tokens: 1_200,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ],
    });
  });
});

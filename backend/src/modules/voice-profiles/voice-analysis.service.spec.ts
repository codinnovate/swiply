import { Types } from 'mongoose';

import type { SourcePostDocument } from './schemas/source-post.schema';
import { VoiceAnalysisService } from './voice-analysis.service';

describe('VoiceAnalysisService', () => {
  it('uses the current user’s OpenAI credential and filters invented sample ids', async () => {
    const keptId = new Types.ObjectId();
    const credentials = {
      resolve: jest.fn().mockResolvedValue({ apiKey: 'secret', model: 'gpt-5-mini', provider: 'openai' }),
    };
    const openai = {
      completeStructured: jest.fn().mockResolvedValue({
        styleSummary: 'Concise and useful.',
        styleAttributes: {
          avgSentenceLength: 4,
          emojiUsage: 'none',
          hashtagUsage: 'light',
          commonTopics: ['marketing'],
          formattingNotes: 'Short paragraphs.',
        },
        fewShotExampleIds: [keptId.toHexString(), new Types.ObjectId().toHexString()],
      }),
    };
    const service = new VoiceAnalysisService(credentials as never, openai as never);
    const posts = [
      { _id: keptId, text: 'A useful post #swiply', engagementScore: 10 },
    ] as unknown as SourcePostDocument[];

    const result = await service.analyzeVoice('user-id', posts);

    expect(credentials.resolve).toHaveBeenCalledWith('user-id');
    expect(openai.completeStructured).toHaveBeenCalledWith(
      'openai',
      'secret',
      'user-id',
      'gpt-5-mini',
      expect.any(Object),
      expect.any(Object),
    );
    expect(result.fewShotExampleIds).toEqual([keptId.toHexString()]);
  });

  it('returns an empty profile without requiring a key when there are no posts', async () => {
    const credentials = { resolve: jest.fn() };
    const openai = { completeStructured: jest.fn() };
    const service = new VoiceAnalysisService(credentials as never, openai as never);

    const result = await service.analyzeVoice('user-id', []);

    expect(result.styleSummary).toBe('');
    expect(result.styleAttributes.avgSentenceLength).toBe(0);
    expect(result.fewShotExampleIds).toEqual([]);
    expect(credentials.resolve).not.toHaveBeenCalled();
  });
});

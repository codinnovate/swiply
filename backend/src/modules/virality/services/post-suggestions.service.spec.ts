import { ConfigService } from '@nestjs/config';

import { parseResearchResponse, PostSuggestionsService } from './post-suggestions.service';

const source = 'https://x.com/creator/status/1234567890';
function response(url = source, cited = source) {
  return {
    output: [
      {
        content: [
          {
            type: 'output_text',
            text: JSON.stringify({
              ideas: [
                {
                  title: 'A useful angle',
                  topic: 'Design',
                  draft: 'What would you change about [your process]?',
                  whyNow: 'A source conversation raises this question.',
                  angle: 'Share a concrete example.',
                  sourceUrls: [url],
                },
              ],
            }),
            annotations: [{ type: 'url_citation', url: cited }],
          },
        ],
      },
    ],
  };
}

describe('post suggestions research', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retains only source posts actually cited by the provider', () => {
    expect(parseResearchResponse(response())).toHaveLength(1);
    expect(parseResearchResponse(response('https://x.com/creator/status/999'))).toEqual([]);
    expect(parseResearchResponse(response('https://example.com/status/1234567890'))).toEqual([]);
    expect(parseResearchResponse(response('javascript:alert(1)'))).toEqual([]);
  });

  it('rejects malformed model output', () => {
    expect(() => parseResearchResponse({ output: [] })).toThrow();
  });

  it('requires a niche and configured research key without calling the network', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new PostSuggestionsService(new ConfigService());
    await expect(service.suggest('')).rejects.toMatchObject({ code: 'CONTENT_TOPIC_REQUIRED' });
    await expect(service.suggest('design')).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent requests and caches the same niche', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response()), { status: 200 }));
    const service = new PostSuggestionsService(
      new ConfigService({ virality: { xaiApiKey: 'test-key' } }),
    );
    const [first, second] = await Promise.all([
      service.suggest('Design'),
      service.suggest('design'),
    ]);
    expect(first).toEqual(second);
    expect(await service.suggest('design')).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as {
      tools: { type: string; from_date: string }[];
    };
    expect(body.tools[0].type).toBe('x_search');
    expect(body.tools[0].from_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('surfaces provider failures without returning invented ideas', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const service = new PostSuggestionsService(
      new ConfigService({ virality: { xaiApiKey: 'test-key' } }),
    );
    await expect(service.suggest('design')).rejects.toMatchObject({ code: 'AI_REQUEST_FAILED' });
  });
});

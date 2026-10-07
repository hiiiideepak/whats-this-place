import { vi } from 'vitest';
import { groundedEtymology, type SummaryClient } from './grounded-etymology.js';

describe('groundedEtymology', () => {
  it('does not call the model when there is no source text', async () => {
    const summarize = vi.fn<SummaryClient['summarize']>();
    const client: SummaryClient = { summarize };

    await expect(
      groundedEtymology(null, 'https://example.test', client),
    ).resolves.toEqual({
      status: 'not_found',
    });
    await expect(
      groundedEtymology('   ', 'https://example.test', client),
    ).resolves.toEqual({
      status: 'not_found',
    });
    await expect(
      groundedEtymology('The name comes from a river.', undefined, client),
    ).resolves.toEqual({
      status: 'not_found',
    });

    expect(summarize).not.toHaveBeenCalled();
  });

  it('returns the summary and source url only from the supplied text', async () => {
    const summarize = vi.fn(async (text: string) => `From source: ${text}`);
    const result = await groundedEtymology(
      'Named after the river.',
      'https://en.wikipedia.org/wiki/Sample',
      { summarize },
    );
    expect(summarize).toHaveBeenCalledWith('Named after the river.');
    expect(result).toEqual({
      status: 'ok',
      summary: 'From source: Named after the river.',
      source_url: 'https://en.wikipedia.org/wiki/Sample',
    });
  });

  it('maps a model refusal to not_found', async () => {
    const result = await groundedEtymology(
      'Unrelated geography.',
      'https://en.wikipedia.org/wiki/Sample',
      {
        summarize: async () => 'NOT_FOUND',
      },
    );
    expect(result).toEqual({ status: 'not_found' });
  });
});

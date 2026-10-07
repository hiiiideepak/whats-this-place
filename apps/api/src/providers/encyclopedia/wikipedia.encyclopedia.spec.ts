import { WikipediaEncyclopediaProvider } from './wikipedia.encyclopedia.js';

function json(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('WikipediaEncyclopediaProvider', () => {
  it('uses the city article when the locality has no page', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const title = url.searchParams.get('titles');
      if (title === 'Ashokanagar') {
        return json({
          query: { pages: { '-1': { pageid: -1, missing: '' } } },
        });
      }
      if (title === 'Bengaluru') {
        return json({
          query: { pages: { '1355': { pageid: 1355, title: 'Bengaluru' } } },
        });
      }
      if (url.searchParams.get('action') === 'parse') {
        return json({
          parse: {
            wikitext: '== Etymology ==\nFrom the bean name Benda Kaaluru.',
          },
        });
      }
      if (url.searchParams.get('list') === 'geosearch') {
        return json({
          query: { geosearch: [{ pageid: 9, title: "St. Paul's Church" }] },
        });
      }
      return json({
        query: {
          pages: {
            '1355': {
              extract: 'Bengaluru is a city.',
              pageprops: { wikibase_item: 'Q1355' },
            },
          },
        },
      });
    }) as typeof fetch;

    const provider = new WikipediaEncyclopediaProvider(
      'https://en.wikipedia.org/w/api.php',
      'Around/test',
      fetchImpl,
    );
    const article = await provider.lookup({
      lat: 12.97,
      lng: 77.59,
      names: ['Ashokanagar', 'Bengaluru'],
    });

    expect(article?.title).toBe('Bengaluru');
    expect(article?.placeKey).toBe('Q1355');
    expect(article?.etymologyText).toContain('Benda Kaaluru');
    expect(article?.sourceUrl).toBe('https://en.wikipedia.org/wiki/Bengaluru');
  });
});

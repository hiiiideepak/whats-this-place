import { excerpt, extractGroundingText } from './wiki-text.js';

const ARTICLE = `
'''Sample''' is a city.

== Geography ==
It sits on a river.

== Etymology ==
The name comes from the [[Old Tongue|old word]] for river.

== History ==
Settlers arrived later.

== Culture ==
Festivals are held in spring.
`;

describe('extractGroundingText', () => {
  it('keeps etymology and history and drops other sections', () => {
    const text = extractGroundingText(ARTICLE);
    expect(text).toContain('old word');
    expect(text).toContain('Settlers arrived later');
    expect(text).not.toContain('Festivals');
    expect(text).not.toContain('Geography');
  });

  it('returns null when those sections are missing', () => {
    expect(extractGroundingText('== Geography ==\nHills.')).toBeNull();
    expect(extractGroundingText('   ')).toBeNull();
  });
});

describe('excerpt', () => {
  it('shortens long source text without calling a model', () => {
    const text = excerpt('word '.repeat(200));
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThan(450);
  });
});

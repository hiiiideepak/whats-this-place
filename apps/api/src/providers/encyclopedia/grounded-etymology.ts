import type { Etymology } from '@around/shared-types';

export interface SummaryClient {
  summarize(sourceText: string): Promise<string>;
}

const NO_SOURCE = /^(not_found|no reliable information found)\.?$/i;

export async function groundedEtymology(
  sourceText: string | null | undefined,
  sourceUrl: string | undefined,
  client: SummaryClient,
): Promise<Etymology> {
  const text = sourceText?.trim() ?? '';
  // Empty source text must stop here. The model is not allowed to fill the gap.
  if (!text || !sourceUrl) {
    return { status: 'not_found' };
  }

  const summary = (await client.summarize(text)).trim();
  if (!summary || NO_SOURCE.test(summary)) {
    return { status: 'not_found' };
  }

  return { status: 'ok', summary, source_url: sourceUrl };
}

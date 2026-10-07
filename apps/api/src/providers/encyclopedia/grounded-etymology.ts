import type { Etymology } from '@around/shared-types';

export interface SummaryClient {
  summarize(sourceText: string): Promise<string>;
}

function isRefusal(summary: string): boolean {
  const flat = summary.replace(/\s+/g, ' ').trim();
  if (!flat) return true;
  if (/^(not_found|no reliable information found)\.?$/i.test(flat)) return true;
  // Models often explain the miss and then emit the required token.
  return /\bNOT_FOUND\b/.test(summary);
}

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
  if (isRefusal(summary)) {
    return { status: 'not_found' };
  }

  return { status: 'ok', summary, source_url: sourceUrl };
}

import { HttpError } from '../../resilience/retry.js';
import type { SummaryClient } from './grounded-etymology.js';
import { excerpt } from './wiki-text.js';

const PROMPT = [
  'Summarize why the place is named as it is, using only the source text below.',
  'If the text does not state a name origin, reply with exactly NOT_FOUND.',
  'Do not use outside knowledge. Do not guess. Do not add facts that are not in the text.',
].join(' ');

interface AnthropicMessage {
  content?: Array<{ type?: string; text?: string }>;
}

export class AnthropicSummarizer implements SummaryClient {
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.model = apiKey ? model : 'excerpt';
  }

  async summarize(sourceText: string): Promise<string> {
    if (!this.apiKey) return excerpt(sourceText);

    const response = await this.fetchImpl(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 300,
          system: PROMPT,
          messages: [{ role: 'user', content: `Source text:\n${sourceText}` }],
        }),
      },
    );
    if (!response.ok) throw new HttpError(response.status);
    const body = (await response.json()) as AnthropicMessage;
    return (
      body.content
        ?.map((block) => block.text ?? '')
        .join('')
        .trim() ?? ''
    );
  }
}

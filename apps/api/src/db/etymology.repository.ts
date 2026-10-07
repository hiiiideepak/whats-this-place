import { createHash } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS etymology_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key text NOT NULL UNIQUE,
  summary text NOT NULL,
  source_url text NOT NULL,
  source_text_hash text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export interface StoredEtymology {
  summary: string;
  sourceUrl: string;
}

@Injectable()
export class EtymologyRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady = false;
  private unavailableUntil = 0;
  private readonly logger = new Logger(EtymologyRepository.name);

  constructor(private readonly config: ConfigService) {}

  async get(placeKey: string): Promise<StoredEtymology | null> {
    const pool = await this.ready();
    if (!pool) return null;
    const result = await pool.query<{ summary: string; source_url: string }>(
      'SELECT summary, source_url FROM etymology_summaries WHERE place_key = $1',
      [placeKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { summary: row.summary, sourceUrl: row.source_url };
  }

  async save(input: {
    placeKey: string;
    summary: string;
    sourceUrl: string;
    sourceText: string;
    model: string;
  }): Promise<void> {
    const pool = await this.ready();
    if (!pool) return;
    const hash = createHash('sha256').update(input.sourceText).digest('hex');
    await pool.query(
      `INSERT INTO etymology_summaries (place_key, summary, source_url, source_text_hash, model)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (place_key) DO NOTHING`,
      [input.placeKey, input.summary, input.sourceUrl, hash, input.model],
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private async ready(): Promise<Pool | null> {
    if (Date.now() < this.unavailableUntil) return null;
    try {
      if (!this.pool) {
        this.pool = new Pool({
          connectionString: this.config.get<string>(
            'DATABASE_URL',
            'postgresql://around:around@localhost:5433/around',
          ),
          connectionTimeoutMillis: 2_000,
          max: 2,
        });
      }
      if (!this.schemaReady) {
        await this.pool.query(SCHEMA);
        this.schemaReady = true;
      }
      return this.pool;
    } catch (error) {
      this.unavailableUntil = Date.now() + 30_000;
      this.logger.warn(
        `etymology store unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await this.pool?.end().catch(() => undefined);
      this.pool = null;
      this.schemaReady = false;
      return null;
    }
  }
}

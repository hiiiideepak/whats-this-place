import type { HealthResponse } from '@around/shared-types';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health reports dependency status', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const body = response.body as HealthResponse;

    expect(body.service).toBe('around-api');
    expect(['ok', 'degraded']).toContain(body.status);
    expect(['up', 'down']).toContain(body.checks.postgres.status);
    expect(['up', 'down']).toContain(body.checks.redis.status);
  });
});

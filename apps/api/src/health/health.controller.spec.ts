import type { HealthResponse } from '@around/shared-types';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  const report: HealthResponse = {
    status: 'degraded',
    service: 'around-api',
    checks: {
      postgres: { status: 'down', error: 'connect ECONNREFUSED' },
      redis: { status: 'down', error: 'connect ECONNREFUSED' },
    },
  };

  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: { check: () => Promise.resolve(report) },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns the health report', async () => {
    await expect(controller.getHealth()).resolves.toEqual(report);
  });
});

import type { HealthResponse } from '@around/shared-types';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'API process and dependency status.' })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}

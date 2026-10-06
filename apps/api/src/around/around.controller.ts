import type {
  AroundResponse,
  AroundSectionName,
  PlaceSearchHit,
} from '@around/shared-types';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AroundService } from './around.service.js';
import { AroundQueryDto, PlaceSearchQueryDto } from './around.query.dto.js';
import { DeviceRateLimitGuard } from './rate-limit.guard.js';

const SECTIONS: readonly AroundSectionName[] = [
  'about',
  'famous',
  'essentials',
  'eat',
  'stay',
  'coffee',
];

@ApiTags('around')
@Controller('v1')
@UseGuards(DeviceRateLimitGuard)
export class AroundController {
  constructor(private readonly around: AroundService) {}

  @Get('around')
  @ApiQuery({ name: 'lat', example: 12.9716 })
  @ApiQuery({ name: 'lng', example: 77.5946 })
  @ApiQuery({ name: 'radius_km', required: false, example: 10 })
  @ApiOkResponse({ description: 'All sections for this point.' })
  getAround(@Query() query: AroundQueryDto): Promise<AroundResponse> {
    return this.around.getAround(query);
  }

  @Get('around/:section')
  @ApiOkResponse({ description: 'One section for this point.' })
  getSection(
    @Param('section') section: string,
    @Query() query: AroundQueryDto,
  ) {
    if (!isSection(section)) {
      throw new BadRequestException(`Unknown section "${section}"`);
    }
    return this.around.getSection(section, query);
  }

  @Get('places/search')
  @ApiOkResponse({ description: 'Place names matching a manual search.' })
  search(@Query() query: PlaceSearchQueryDto): Promise<PlaceSearchHit[]> {
    return this.around.search(query.q);
  }
}

function isSection(value: string): value is AroundSectionName {
  return (SECTIONS as readonly string[]).includes(value);
}

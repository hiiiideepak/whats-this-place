import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AroundCache } from '../cache/around-cache.service.js';

interface RateLimitRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

@Injectable()
export class DeviceRateLimitGuard implements CanActivate {
  constructor(
    private readonly cache: AroundCache,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RateLimitRequest>();
    const header = request.headers['x-device-id'];
    const device = Array.isArray(header) ? header[0] : header;
    const identity = rateLimitIdentity(device, request.ip);
    const limit = Number(
      this.config.get<string | number>('RATE_LIMIT_PER_MINUTE', 60),
    );
    const allowed = await this.cache.hit(identity, 60, limit);
    if (!allowed) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

export function rateLimitIdentity(
  deviceHeader: string | undefined,
  ip: string | undefined,
): string {
  if (deviceHeader && /^[A-Za-z0-9-]{8,64}$/.test(deviceHeader)) {
    return deviceHeader;
  }
  return ip && ip.length > 0 ? ip : 'unknown';
}

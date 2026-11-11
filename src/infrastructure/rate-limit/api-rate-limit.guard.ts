import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { clientIp, RateLimitService } from './rate-limit.service.js';

/** Global guard: RATE_LIMIT_API_PER_MINUTE requests per client IP, on every API route. */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const result = await this.rateLimit.hit('api', clientIp(req), this.config.rateLimit.apiPerMinute);
    this.rateLimit.enforce(result, 'Too many requests', http.getResponse<Response>());
    return true;
  }
}

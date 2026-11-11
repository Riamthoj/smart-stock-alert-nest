import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RawResponse } from '../../common/decorators/response.decorators.js';
import { DatabaseService } from '../../database/database.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { Public } from '../auth/auth.decorators.js';

type Check = { status: 'up' | 'down' | 'disabled'; latency_ms?: number; error?: string };

/** For uptime monitors, Docker / Kubernetes probes. No login needed. */
@ApiTags('health')
@Public()
@RawResponse()
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check (the process is up)' })
  live() {
    return { status: 'healthy' };
  }

  /**
   * Readiness:
   *   database down -> 503 "unhealthy" (can't serve anything)
   *   redis down    -> 200 "degraded"  (works without cache / rate limits / logout)
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (database + Redis)' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<'database' | 'redis', Check> = {
      database: { status: 'down' },
      redis: { status: 'disabled' },
    };
    try {
      checks.database = { status: 'up', latency_ms: round(await this.database.ping()) };
    } catch (err) {
      checks.database = { status: 'down', error: (err as Error).name };
    }
    if (this.redis.enabled) {
      const latency = await this.redis.ping();
      checks.redis = latency === null ? { status: 'down' } : { status: 'up', latency_ms: round(latency) };
    }

    const [overall, code] =
      checks.database.status !== 'up'
        ? (['unhealthy', 503] as const)
        : checks.redis.status === 'down'
          ? (['degraded', 200] as const)
          : (['healthy', 200] as const);
    res.status(code);
    return { success: code === 200, message: overall, code, data: checks };
  }
}

const round = (ms: number) => Math.round(ms * 100) / 100;

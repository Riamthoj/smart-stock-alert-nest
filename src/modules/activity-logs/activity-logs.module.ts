import { Injectable, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfig } from '../../config/app-config.js';
import { ActivityLogsRepository } from '../../database/repositories/activity-logs.repository.js';
import { ActivityLogInterceptor } from './activity-log.interceptor.js';
import { ActivityLogsController } from './activity-logs.controller.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Keeps the audit table bounded: deletes entries older than ACTIVITY_LOG_RETENTION_DAYS, daily. */
@Injectable()
class ActivityLogRetention implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('ActivityLogRetention');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly logs: ActivityLogsRepository,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    const { enabled, retentionDays } = this.config.activityLog;
    if (!enabled || retentionDays <= 0) return;
    const purge = () =>
      this.logs
        .purgeOlderThan(new Date(Date.now() - retentionDays * DAY_MS))
        .then((n) => n > 0 && this.logger.log(`Purged ${n} activity logs older than ${retentionDays} days`))
        .catch((err: Error) => this.logger.warn(`Activity log purge failed: ${err.message}`));
    setTimeout(purge, 60_000).unref(); // shortly after startup, then daily
    this.timer = setInterval(purge, DAY_MS).unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }
}

@Module({
  controllers: [ActivityLogsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor }, ActivityLogRetention],
})
export class ActivityLogsModule {}

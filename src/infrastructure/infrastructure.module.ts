import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { AppConfig } from '../config/app-config.js';
import { AlertingService } from './alerting/alerting.service.js';
import { ListCacheService } from './cache/list-cache.service.js';
import { RateLimitService } from './rate-limit/rate-limit.service.js';
import { RedisService } from './redis/redis.service.js';
import { StorageService } from './storage/storage.service.js';

/** Cross-cutting services every feature may use: Redis, cache, rate limits, file storage, alerting. */
@Global()
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        storage: multer.memoryStorage(),
        limits: { fileSize: config.upload.maxBytes, files: 1 },
      }),
    }),
  ],
  providers: [RedisService, ListCacheService, RateLimitService, StorageService, AlertingService],
  exports: [RedisService, ListCacheService, RateLimitService, StorageService, AlertingService, MulterModule],
})
export class InfrastructureModule {}

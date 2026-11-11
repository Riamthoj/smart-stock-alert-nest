import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { ServiceUnavailableError } from '../../common/errors/app-error.js';

/**
 * One shared Redis client + a CIRCUIT BREAKER.
 *
 * Used for: list cache, rate limiting, logout (token revocation).
 *
 * GOLDEN RULE: Redis is a helper, never the source of truth (PostgreSQL is).
 * If Redis is down the API keeps working without the extras:
 *   safe()   -> returns a fallback (cache miss, no rate limit)
 *   strict() -> 503, for actions that must not silently do nothing (logout)
 *
 * After a failure Redis is skipped for REDIS_RETRY_AFTER_SECONDS, so requests
 * don't each wait for a timeout while it is down.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;
  private downUntil = 0;

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.redis.enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Redis disabled (REDIS_ENABLED=false): no cache / rate limits / logout');
      return;
    }
    const { url, timeoutMs } = this.config.redis;
    this.client = new Redis(url, {
      lazyConnect: true,
      connectionName: this.config.app.name.replace(/\s+/g, '-').toLowerCase(),
      connectTimeout: timeoutMs,
      commandTimeout: timeoutMs,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // fail fast while disconnected instead of queueing
      retryStrategy: (times) => Math.min(times * 500, 10_000), // keep reconnecting in the background
    });
    this.client.on('error', (err: Error) => this.trip(err));
    this.client.on('ready', () => {
      this.downUntil = 0;
      this.logger.log('Redis connected');
    });
    try {
      await this.client.connect();
    } catch (err) {
      this.trip(err as Error);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    this.client.disconnect();
    this.client = undefined;
  }

  /** key('cache', 'products', id) -> "smartstock:cache:products:<id>" (same keys as the FastAPI version). */
  key(...parts: (string | number)[]): string {
    return this.config.redis.prefix + parts.join(':');
  }

  isAvailable(): boolean {
    return this.enabled && !!this.client && this.client.status === 'ready' && Date.now() >= this.downUntil;
  }

  /** Run a Redis call; on ANY Redis problem return `fallback` instead of failing. */
  async safe<T>(op: (redis: Redis) => Promise<T>, fallback: T): Promise<T> {
    if (!this.isAvailable()) return fallback;
    try {
      return await op(this.client!);
    } catch (err) {
      this.trip(err as Error);
      return fallback;
    }
  }

  /** Like safe() but throws 503 when Redis is unavailable. */
  async strict<T>(op: (redis: Redis) => Promise<T>): Promise<T> {
    if (!this.isAvailable()) throw new ServiceUnavailableError('Temporarily unavailable, please try again');
    try {
      return await op(this.client!);
    } catch (err) {
      this.trip(err as Error);
      throw new ServiceUnavailableError('Temporarily unavailable, please try again');
    }
  }

  /** Round-trip ms, or null when down (readiness probe). */
  async ping(): Promise<number | null> {
    if (!this.enabled || !this.client || this.client.status !== 'ready') return null;
    const start = performance.now();
    try {
      await this.client.ping();
      this.downUntil = 0;
      return performance.now() - start;
    } catch (err) {
      this.trip(err as Error);
      return null;
    }
  }

  private trip(err: Error): void {
    if (Date.now() >= this.downUntil) {
      // log once per outage, not once per request
      this.logger.warn(
        `Redis unavailable (${(err as { code?: string }).code ?? err.name}: ${err.message || 'connection failed'}); skipping it for ${this.config.redis.retryAfterSeconds}s`,
      );
    }
    this.downUntil = Date.now() + this.config.redis.retryAfterSeconds * 1000;
  }
}

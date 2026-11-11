import { createHash, randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { Page, PaginationQueryDto, paginate } from '../../common/pagination/pagination.dto.js';
import { RedisService } from '../redis/redis.service.js';

const ALL_STORES = 'all';

/**
 * Read-through cache for hot list endpoints (products, categories).
 *
 * VERSIONED KEYS make invalidation one INCR, with no SCAN:
 *     smartstock:cache:ver:<store>                          -> 7
 *     smartstock:cache:products:<store>:v7:<hash(params)>   -> {"rows": [...], "total": 42}
 * A write bumps the store's version (7 -> 8): every later read builds a
 * ":v8:" key (a miss -> fresh data) and the old keys simply expire.
 *
 * The version keys are the same as the FastAPI version's, so when both APIs
 * share Redis a write in EITHER one invalidates both caches.
 */
@Injectable()
export class ListCacheService {
  private readonly logger = new Logger(ListCacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  private versionKey(scope: string): string {
    return this.redis.key('cache', 'ver', scope);
  }

  private hash(params: Record<string, unknown>): string {
    const sorted = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 24);
  }

  /** The cached JSON value, or run `loader` and cache what it returns. */
  async remember<T>(
    resource: string,
    storeId: string | undefined,
    params: Record<string, unknown>,
    loader: () => Promise<T>,
  ): Promise<T> {
    const scope = storeId ?? ALL_STORES;
    const version = (await this.redis.safe((r) => r.get(this.versionKey(scope)), null)) ?? '0';
    const key = this.redis.key('cache', resource, scope, `v${version}`, this.hash(params));

    const cached = await this.redis.safe((r) => r.get(key), null);
    if (cached !== null) {
      this.logger.debug(`cache HIT ${key}`);
      return JSON.parse(cached) as T;
    }
    this.logger.debug(`cache MISS ${key}`);
    const value = await loader();
    // TTL + jitter: keys created together don't all expire in the same second.
    const ttl = this.config.redis.cacheTtlSeconds;
    const ex = ttl + randomInt(0, Math.max(1, Math.floor(ttl / 10)) + 1);
    await this.redis.safe((r) => r.set(key, JSON.stringify(value), 'EX', ex), null);
    return value;
  }

  /** Call AFTER committing a change to a store's products / categories. */
  async invalidateStore(storeId: string): Promise<void> {
    await this.redis.safe(
      (r) => r.multi().incr(this.versionKey(storeId)).incr(this.versionKey(ALL_STORES)).exec(),
      null,
    );
  }

  /** A whole cached list endpoint: `load` runs only on a miss; rows are cached already presented (plain JSON). */
  async page<T>(
    resource: string,
    storeId: string | undefined,
    filters: Record<string, unknown>,
    query: PaginationQueryDto,
    load: () => Promise<Page<T>>,
  ) {
    const params = { ...filters, offset: query.offset, limit: query.rowLimit ?? null, search: query.search ?? null };
    const data = await this.remember(resource, storeId, params, load);
    return paginate(data.rows, data.total, query);
  }
}

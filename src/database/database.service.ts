import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { AppConfig } from '../config/app-config.js';
import * as schema from './schema/index.js';

/** Root database OR an open transaction: both expose the same query API. */
export type Db = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/**
 * One connection pool per app + an AMBIENT transaction.
 *
 *     await this.database.transaction(async () => {
 *       await this.products.insert(...);     // repositories automatically use
 *       await this.inventories.insert(...);  // the open transaction
 *     });                                    // COMMIT (or ROLLBACK on throw)
 *
 * The open transaction travels with the async call chain (AsyncLocalStorage),
 * so services and repositories never pass a `tx` argument around, and nested
 * transaction() calls simply join the outer one.
 */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly storage = new AsyncLocalStorage<Db>();
  readonly pool: Pool;
  private readonly root: Db;

  constructor(config: AppConfig) {
    const db = config.db;
    this.pool = new Pool({
      host: db.host,
      port: db.port,
      database: db.database,
      user: db.user,
      password: db.password,
      max: db.poolMax,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      application_name: config.app.name.replace(/\s+/g, '-').toLowerCase(),
    });
    this.pool.on('error', (err) => this.logger.error(`Idle database client error: ${err.message}`));

    const queryLogger = new Logger('SQL');
    this.root = drizzle(this.pool, {
      schema,
      logger: db.logQueries ? { logQuery: (query, params) => queryLogger.debug(`${query} -- ${JSON.stringify(params)}`) } : false,
    });
  }

  /** The current transaction if one is open, else the pooled root connection. */
  get db(): Db {
    return this.storage.getStore() ?? this.root;
  }

  get inTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /** Run `work` in a transaction (or join the one already open). */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return work();
    return this.root.transaction((tx) => this.storage.run(tx as unknown as Db, work));
  }

  /**
   * Transaction-scoped ADVISORY lock: serializes code generation per key
   * (e.g. daily receipt numbers) and is released automatically on COMMIT.
   * Uses hashtext() exactly like the FastAPI version, so both APIs share the lock.
   */
  async advisoryLock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }

  /** Round-trip time in ms (readiness check). Throws if the database is down. */
  async ping(): Promise<number> {
    const start = performance.now();
    await this.root.execute(sql`select 1`);
    return performance.now() - start;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }
}

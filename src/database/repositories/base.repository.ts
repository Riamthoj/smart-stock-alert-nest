import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Page } from '../../common/pagination/pagination.dto.js';
import { Db, DatabaseService } from '../database.service.js';

type TableWithId = PgTable & { id: PgColumn };

export interface ListOptions {
  offset: number;
  /** undefined = every row (q=all). */
  limit?: number;
}

/**
 * Generic data access for one table. Subclasses add the queries that are
 * specific to their table (getByUsername, listFiltered...).
 *
 * Every method uses `this.db`, which is automatically the ambient transaction
 * when called inside DatabaseService.transaction().
 *
 * @Injectable() here is REQUIRED: subclasses inherit this constructor, and
 * only a decorated class gets the parameter metadata Nest uses for injection.
 */
@Injectable()
export abstract class BaseRepository<T extends TableWithId> {
  protected abstract readonly table: T;

  constructor(protected readonly database: DatabaseService) {}

  protected get db(): Db {
    return this.database.db;
  }

  /** The table, typed loosely for drizzle's generic query builder. */
  private get t(): PgTable {
    return this.table as unknown as PgTable;
  }

  async findById(id: string): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db.select().from(this.t).where(eq(this.table.id, id)).limit(1);
    return row as T['$inferSelect'] | undefined;
  }

  /** SELECT ... FOR UPDATE: lock the row until the transaction ends. */
  async findByIdForUpdate(id: string): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db.select().from(this.t).where(eq(this.table.id, id)).limit(1).for('update');
    return row as T['$inferSelect'] | undefined;
  }

  async findOne(where: SQL | undefined): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db.select().from(this.t).where(where).limit(1);
    return row as T['$inferSelect'] | undefined;
  }

  async exists(where: SQL | undefined): Promise<boolean> {
    const [row] = await this.db.select({ one: this.table.id }).from(this.t).where(where).limit(1);
    return row !== undefined;
  }

  async insert(values: T['$inferInsert']): Promise<T['$inferSelect']> {
    const [row] = await this.db.insert(this.table).values(values).returning();
    return row as T['$inferSelect'];
  }

  async insertMany(values: T['$inferInsert'][]): Promise<T['$inferSelect'][]> {
    if (values.length === 0) return [];
    return (await this.db.insert(this.table).values(values).returning()) as T['$inferSelect'][];
  }

  /** UPDATE one row; updated_at is refreshed automatically. */
  async update(id: string, values: Partial<T['$inferInsert']>): Promise<T['$inferSelect']> {
    if (Object.keys(values).length === 0) return (await this.findById(id)) as T['$inferSelect'];
    const rows = (await this.db
      .update(this.table)
      .set(values as never)
      .where(eq(this.table.id, id))
      .returning()) as unknown as T['$inferSelect'][];
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.id, id));
  }

  /** One page + total, oldest first (UUIDv7 ids are time-ordered). */
  async findPage(filters: (SQL | undefined)[], { offset, limit }: ListOptions): Promise<Page<T['$inferSelect']>> {
    const where = and(...filters);
    const query = this.db.select().from(this.t).where(where).orderBy(asc(this.table.id)).offset(offset);
    const [rows, [{ total }]] = await Promise.all([
      limit === undefined ? query : query.limit(limit),
      this.db.select({ total: count() }).from(this.t).where(where),
    ]);
    return { rows: rows as T['$inferSelect'][], total };
  }
}

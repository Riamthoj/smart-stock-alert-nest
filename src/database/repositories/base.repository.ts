import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, isNotNull, isNull, SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Page } from '../../common/pagination/pagination.dto.js';
import { Db, DatabaseService } from '../database.service.js';

type TableWithId = PgTable & { id: PgColumn };

/** Which rows of a soft-deletable table to see. Ignored for other tables. */
export type DeletedFilter = 'exclude' | 'only' | 'include';

export interface ListOptions {
  offset: number;
  /** undefined = every row (q=all). */
  limit?: number;
  /** Soft-deleted rows: hidden by default. */
  deleted?: DeletedFilter;
}

export interface ReadOptions {
  /** Also return soft-deleted rows (restore, uniqueness checks). */
  withDeleted?: boolean;
}

/**
 * Generic data access for one table. Subclasses add the queries that are
 * specific to their table (getByUsername, listFiltered...).
 *
 * Every method uses `this.db`, which is automatically the ambient transaction
 * when called inside DatabaseService.transaction().
 *
 * SOFT DELETE: when the table has a `deleted_at` column, delete() only stamps
 * it, and every read here hides those rows unless asked otherwise. Feature
 * code doesn't need to remember a "where deleted_at is null" anywhere.
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

  /** The deleted_at column, when this table is soft-deletable. */
  protected get deletedAtColumn(): PgColumn | undefined {
    return (this.table as unknown as { deleted_at?: PgColumn }).deleted_at;
  }

  get softDeletes(): boolean {
    return this.deletedAtColumn !== undefined;
  }

  /** The soft-delete condition for a read (undefined = no condition). */
  protected deletedFilter(mode: DeletedFilter = 'exclude'): SQL | undefined {
    const column = this.deletedAtColumn;
    if (!column || mode === 'include') return undefined;
    return mode === 'only' ? isNotNull(column) : isNull(column);
  }

  private visible(where: SQL | undefined, opts: ReadOptions = {}): SQL | undefined {
    return and(where, this.deletedFilter(opts.withDeleted ? 'include' : 'exclude'));
  }

  async findById(id: string, opts?: ReadOptions): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db.select().from(this.t).where(this.visible(eq(this.table.id, id), opts)).limit(1);
    return row as T['$inferSelect'] | undefined;
  }

  /** SELECT ... FOR UPDATE: lock the row until the transaction ends. */
  async findByIdForUpdate(id: string): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db
      .select()
      .from(this.t)
      .where(this.visible(eq(this.table.id, id)))
      .limit(1)
      .for('update');
    return row as T['$inferSelect'] | undefined;
  }

  async findOne(where: SQL | undefined, opts?: ReadOptions): Promise<T['$inferSelect'] | undefined> {
    const [row] = await this.db.select().from(this.t).where(this.visible(where, opts)).limit(1);
    return row as T['$inferSelect'] | undefined;
  }

  async exists(where: SQL | undefined, opts?: ReadOptions): Promise<boolean> {
    const [row] = await this.db.select({ one: this.table.id }).from(this.t).where(this.visible(where, opts)).limit(1);
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

  /** UPDATE one row (live or soft-deleted); updated_at is refreshed automatically. */
  async update(id: string, values: Partial<T['$inferInsert']>): Promise<T['$inferSelect']> {
    if (Object.keys(values).length === 0) return (await this.findById(id, { withDeleted: true })) as T['$inferSelect'];
    const rows = (await this.db
      .update(this.table)
      .set(values as never)
      .where(eq(this.table.id, id))
      .returning()) as unknown as T['$inferSelect'][];
    return rows[0];
  }

  /** Soft-deletable table: stamp deleted_at. Otherwise: real DELETE. */
  async delete(id: string): Promise<void> {
    if (this.softDeletes) {
      await this.db
        .update(this.table)
        .set({ deleted_at: new Date() } as never)
        .where(eq(this.table.id, id));
      return;
    }
    await this.forceDelete(id);
  }

  /** Bring a soft-deleted row back. */
  async restore(id: string): Promise<T['$inferSelect']> {
    return this.update(id, { deleted_at: null } as never);
  }

  /** Real DELETE, even on a soft-deletable table. */
  async forceDelete(id: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.id, id));
  }

  /** One page + total, oldest first (UUIDv7 ids are time-ordered). Soft-deleted rows hidden by default. */
  async findPage(
    filters: (SQL | undefined)[],
    { offset, limit, deleted }: ListOptions,
  ): Promise<Page<T['$inferSelect']>> {
    const where = and(...filters, this.deletedFilter(deleted));
    const query = this.db.select().from(this.t).where(where).orderBy(asc(this.table.id)).offset(offset);
    const [rows, [{ total }]] = await Promise.all([
      limit === undefined ? query : query.limit(limit),
      this.db.select({ total: count() }).from(this.t).where(where),
    ]);
    return { rows: rows as T['$inferSelect'][], total };
  }
}

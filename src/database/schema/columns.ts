import { numeric, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from '../../common/utils/uuid7.js';

/**
 * Column helpers shared by every table. Naming follows the existing
 * database (created by the FastAPI/Alembic project), so both APIs can run
 * on the SAME schema:
 *   pk_<table>  uq_<table>_<col0>  ix_<table>_<col>  ck_<table>_<name>  fk_<table>_<col>_<ref>
 */

/** UUIDv7 primary key, generated in the app (time-ordered: ORDER BY id = oldest first). */
export const id = () => uuid('id').notNull().$defaultFn(uuidv7);

/** created_at / updated_at, filled by the database; updated_at refreshed on every ORM update. */
export const timestamps = () => ({
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** NUMERIC(14,2). Read as a string ("8000.00") - see common/utils/money.ts. */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/**
 * Soft delete: NULL = live, a timestamp = deleted at that moment.
 * BaseRepository hides these rows from every read automatically.
 */
export const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

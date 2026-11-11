import { ilike, or, SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Escape LIKE wildcards so "50%" searches for the text "50%" (Postgres' default escape char is "\"). */
export function likePattern(search: string): string {
  return `%${search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
}

/** Case-insensitive "contains" over one or more columns; undefined when there is no search. */
export function searchAny(search: string | undefined, ...columns: AnyPgColumn[]): SQL | undefined {
  if (!search) return undefined;
  const pattern = likePattern(search);
  return or(...columns.map((c) => ilike(c, pattern)));
}

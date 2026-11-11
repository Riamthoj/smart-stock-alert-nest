/**
 * PATCH semantics: keep only the fields the client actually SENT.
 * `undefined` = not sent (dropped); `null` = sent as null (kept, e.g. "remove the image").
 */
export function sentFields<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Drop keys whose value is null: for NOT NULL columns, null means "no change". */
export function withoutNulls<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> & { [P in K]?: Exclude<T[P], null> } {
  const copy = { ...obj };
  for (const key of keys) if (copy[key] === null) delete copy[key];
  return copy as Omit<T, K> & { [P in K]?: Exclude<T[P], null> };
}

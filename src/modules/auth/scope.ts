import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import type { Owner, User } from '../../database/schema/index.js';

export type TokenType = 'user' | 'owner';

/**
 * WHO may see WHAT, for the current request.
 *
 *   User  (platform admin) -> everything, in every store
 *   Owner (store login)    -> ONLY their own store's data
 *
 *   scope.listStore(store_id)                 lists: owners are forced to their store
 *   scope.check(row.store_id, 'Product', id)  by id: another store's row -> 404
 *   dto.store_id = scope.checkCreate(dto.store_id)  create: omitted -> own store, other -> 403
 *   scope.requireAdmin()                      admin-only -> 403
 *   scope.requireStoreOwner()                 owner (not staff) -> 403
 *
 * 404 (not 403) for another store's record: a 403 would confirm the id EXISTS.
 */
export class Scope {
  constructor(
    readonly account: User | Owner,
    readonly type: TokenType,
  ) {}

  get isAdmin(): boolean {
    return this.type === 'user';
  }

  get owner(): Owner | undefined {
    return this.type === 'owner' ? (this.account as Owner) : undefined;
  }

  /** The only store this account may touch; undefined = all stores (admin). */
  get storeId(): string | undefined {
    return this.owner?.store_id;
  }

  /** store_id filter for a list endpoint. */
  listStore(requested: string | undefined): string | undefined {
    if (this.isAdmin) return requested;
    if (requested !== undefined && requested !== this.storeId) {
      throw new ForbiddenError('You can only access your own store');
    }
    return this.storeId;
  }

  /** Hide records of other stores. */
  check(storeId: string, what: string, recordId: string): void {
    if (!this.isAdmin && storeId !== this.storeId) throw new NotFoundError(`${what} ${recordId} not found`);
  }

  /** Load-then-check in one call: `const p = scope.visible(await repo.findById(id), 'Product', id)`. */
  visible<T extends { store_id: string }>(row: T | undefined, what: string, id: string): T {
    if (!row) throw new NotFoundError(`${what} ${id} not found`);
    this.check(row.store_id, what, id);
    return row;
  }

  /** The store a new record goes into. Owners: optional (defaults to theirs). Admins: required. */
  checkCreate(storeId: string | undefined | null): string {
    if (this.isAdmin) {
      if (!storeId) throw new BusinessRuleError('store_id is required');
      return storeId;
    }
    if (storeId && storeId !== this.storeId) throw new ForbiddenError('You can only create records in your own store');
    return this.storeId!;
  }

  requireAdmin(): void {
    if (!this.isAdmin) throw new ForbiddenError('Only admin users can do this');
  }

  /** Admins, or owners with is_owner=true (not staff). `unlessSelf`: staff may act on their OWN account. */
  requireStoreOwner(unlessSelf?: string): void {
    if (this.isAdmin) return;
    const owner = this.owner!;
    if (unlessSelf !== undefined && unlessSelf === owner.id) return;
    if (!owner.is_owner) throw new ForbiddenError("Only the store's owner can do this");
  }
}

import { describe, expect, it } from 'vitest';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import type { Owner, User } from '../../database/schema/index.js';
import { Scope } from './scope.js';

const STORE = '01a1b971-0000-7000-8000-000000000001';
const OTHER = '01a1b971-0000-7000-8000-00000000000f';

const admin = new Scope({ id: 'u1' } as User, 'user');
const owner = new Scope({ id: 'o1', store_id: STORE, is_owner: true } as Owner, 'owner');
const staff = new Scope({ id: 's1', store_id: STORE, is_owner: false } as Owner, 'owner');

describe('Scope (multi-store data isolation)', () => {
  it('lists: admins choose, owners are forced to their store', () => {
    expect(admin.listStore(undefined)).toBeUndefined();
    expect(admin.listStore(OTHER)).toBe(OTHER);
    expect(owner.listStore(undefined)).toBe(STORE);
    expect(() => owner.listStore(OTHER)).toThrow(ForbiddenError);
  });

  it("hides other stores' records as 404 (never confirms they exist)", () => {
    expect(() => owner.check(OTHER, 'Product', 'p1')).toThrow(NotFoundError);
    expect(() => owner.check(STORE, 'Product', 'p1')).not.toThrow();
    expect(() => admin.check(OTHER, 'Product', 'p1')).not.toThrow();
    expect(() => owner.visible(undefined, 'Product', 'p1')).toThrow(NotFoundError);
  });

  it('create: owners default to their store, admins must say which', () => {
    expect(owner.checkCreate(undefined)).toBe(STORE);
    expect(() => owner.checkCreate(OTHER)).toThrow(ForbiddenError);
    expect(admin.checkCreate(OTHER)).toBe(OTHER);
    expect(() => admin.checkCreate(undefined)).toThrow(BusinessRuleError);
  });

  it('roles: admin-only and owner-only actions', () => {
    expect(() => owner.requireAdmin()).toThrow(ForbiddenError);
    expect(() => owner.requireStoreOwner()).not.toThrow();
    expect(() => staff.requireStoreOwner()).toThrow(ForbiddenError);
    expect(() => staff.requireStoreOwner('s1')).not.toThrow(); // their own account
    expect(() => admin.requireStoreOwner()).not.toThrow();
  });
});

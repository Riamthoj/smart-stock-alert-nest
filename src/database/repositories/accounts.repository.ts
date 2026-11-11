import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { searchAny } from '../../common/utils/search.js';
import { owners, sales, Store, StoreStatus, stores, users } from '../schema/index.js';
import { BaseRepository, ListOptions } from './base.repository.js';

@Injectable()
export class UsersRepository extends BaseRepository<typeof users> {
  protected readonly table = users;

  getByUsername(username: string) {
    return this.findOne(eq(users.username, username));
  }

  getByPhone(phone: string) {
    return this.findOne(eq(users.phone, phone));
  }

  listFiltered(filter: { search?: string }, options: ListOptions) {
    return this.findPage([searchAny(filter.search, users.username, users.phone)], options);
  }
}

@Injectable()
export class StoresRepository extends BaseRepository<typeof stores> {
  protected readonly table = stores;

  listFiltered(filter: { search?: string; status?: StoreStatus; storeId?: string }, options: ListOptions) {
    return this.findPage(
      [
        filter.storeId ? eq(stores.id, filter.storeId) : undefined, // an owner only sees their own store
        filter.status ? eq(stores.status, filter.status) : undefined,
        searchAny(filter.search, stores.name),
      ],
      options,
    );
  }

  /** Every uploaded file of a store (to delete them after the store itself is deleted). */
  async filePaths(storeId: string): Promise<string[]> {
    const result = await this.db.execute<{ path: string | null }>(sql`
      select image as path from stores where id = ${storeId}
      union all select image from products where store_id = ${storeId}
      union all select image from categories where store_id = ${storeId}
      union all select profile from owners where store_id = ${storeId}
      union all select profile from customers where store_id = ${storeId}
    `);
    return result.rows.map((r) => r.path).filter((p): p is string => !!p);
  }

  isBlocked(store: Store | undefined): boolean {
    return store === undefined || store.status === StoreStatus.BLOCK;
  }
}

@Injectable()
export class OwnersRepository extends BaseRepository<typeof owners> {
  protected readonly table = owners;

  getByUsername(username: string) {
    return this.findOne(eq(owners.username, username));
  }

  getByPhone(phone: string) {
    return this.findOne(eq(owners.phone, phone));
  }

  listFiltered(filter: { storeId?: string; search?: string }, options: ListOptions) {
    return this.findPage(
      [filter.storeId ? eq(owners.store_id, filter.storeId) : undefined, searchAny(filter.search, owners.username, owners.phone)],
      options,
    );
  }

  async hasSales(ownerId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: sales.id }).from(sales).where(eq(sales.owner_id, ownerId)).limit(1);
    return row !== undefined;
  }
}

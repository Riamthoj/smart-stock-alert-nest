import { Injectable } from '@nestjs/common';
import { and, eq, inArray, like, max } from 'drizzle-orm';
import { searchAny } from '../../common/utils/search.js';
import { categories, customers, products, saleItems } from '../schema/index.js';
import { BaseRepository, ListOptions } from './base.repository.js';

@Injectable()
export class CustomersRepository extends BaseRepository<typeof customers> {
  protected readonly table = customers;

  getByPhone(storeId: string, phone: string) {
    return this.findOne(and(eq(customers.store_id, storeId), eq(customers.phone, phone)));
  }

  /** Highest code that starts with `prefix` (codes are zero-padded, so MAX works). */
  async lastCodeWithPrefix(prefix: string): Promise<string | null> {
    const [row] = await this.db
      .select({ code: max(customers.code) })
      .from(customers)
      .where(like(customers.code, `${prefix}%`));
    return row?.code ?? null;
  }

  listFiltered(filter: { storeId?: string; search?: string }, options: ListOptions) {
    return this.findPage(
      [
        filter.storeId ? eq(customers.store_id, filter.storeId) : undefined,
        searchAny(filter.search, customers.code, customers.full_name, customers.phone),
      ],
      options,
    );
  }
}

@Injectable()
export class CategoriesRepository extends BaseRepository<typeof categories> {
  protected readonly table = categories;

  getByName(storeId: string, name: string) {
    return this.findOne(and(eq(categories.store_id, storeId), eq(categories.name, name)));
  }

  listFiltered(filter: { storeId?: string; search?: string }, options: ListOptions) {
    return this.findPage(
      [filter.storeId ? eq(categories.store_id, filter.storeId) : undefined, searchAny(filter.search, categories.name)],
      options,
    );
  }
}

@Injectable()
export class ProductsRepository extends BaseRepository<typeof products> {
  protected readonly table = products;

  getByBarCode(storeId: string, barCode: string) {
    return this.findOne(and(eq(products.store_id, storeId), eq(products.bar_code, barCode)));
  }

  findManyByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.select().from(products).where(inArray(products.id, ids));
  }

  async appearsOnSales(productId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: saleItems.id })
      .from(saleItems)
      .where(eq(saleItems.product_id, productId))
      .limit(1);
    return row !== undefined;
  }

  listFiltered(filter: { storeId?: string; categoryId?: string; search?: string }, options: ListOptions) {
    return this.findPage(
      [
        filter.storeId ? eq(products.store_id, filter.storeId) : undefined,
        filter.categoryId ? eq(products.category_id, filter.categoryId) : undefined,
        searchAny(filter.search, products.name, products.bar_code),
      ],
      options,
    );
  }
}

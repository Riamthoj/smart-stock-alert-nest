import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, inArray, like, lt, max, ne, sql, SQL, sum } from 'drizzle-orm';
import type { Page } from '../../common/pagination/pagination.dto.js';
import { toCents, type Cents } from '../../common/utils/money.js';
import { searchAny } from '../../common/utils/search.js';
import {
  ACTIVE_PAYMENT_STATUSES,
  Payment,
  PaymentMethod,
  payments,
  PaymentStatus,
  Sale,
  SaleItem,
  saleItems,
  sales,
} from '../schema/index.js';
import { BaseRepository, ListOptions } from './base.repository.js';

/** A sale with its lines and payments (what the API returns). */
export type SaleWithDetails = Sale & { items: SaleItem[]; payments: Payment[] };

@Injectable()
export class SalesRepository extends BaseRepository<typeof sales> {
  protected readonly table = sales;

  async lastReceipt(storeId: string, prefix: string): Promise<string | null> {
    const [row] = await this.db
      .select({ receipt: max(sales.receipt_number) })
      .from(sales)
      .where(and(eq(sales.store_id, storeId), like(sales.receipt_number, `${prefix}%`)));
    return row?.receipt ?? null;
  }

  async findWithDetails(id: string): Promise<SaleWithDetails | undefined> {
    const sale = await this.findById(id);
    if (!sale) return undefined;
    const [details] = await this.withDetails([sale]);
    return details;
  }

  /** Items + payments of many sales in 2 queries (no N+1). */
  async withDetails(rows: Sale[]): Promise<SaleWithDetails[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((s) => s.id);
    const [items, pays] = await Promise.all([
      this.db.select().from(saleItems).where(inArray(saleItems.sale_id, ids)).orderBy(asc(saleItems.id)),
      this.db.select().from(payments).where(inArray(payments.sale_id, ids)).orderBy(asc(payments.id)),
    ]);
    const group = <T extends { sale_id: string }>(list: T[]) => {
      const map = new Map<string, T[]>();
      for (const row of list) map.set(row.sale_id, [...(map.get(row.sale_id) ?? []), row]);
      return map;
    };
    const itemsBySale = group(items);
    const paymentsBySale = group(pays);
    return rows.map((s) => ({ ...s, items: itemsBySale.get(s.id) ?? [], payments: paymentsBySale.get(s.id) ?? [] }));
  }

  async listFiltered(
    filter: {
      storeId?: string;
      ownerId?: string;
      customerId?: string;
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
    },
    options: ListOptions,
  ): Promise<Page<SaleWithDetails>> {
    const page = await this.findPage(
      [
        filter.storeId ? eq(sales.store_id, filter.storeId) : undefined,
        filter.ownerId ? eq(sales.owner_id, filter.ownerId) : undefined,
        filter.customerId ? eq(sales.customer_id, filter.customerId) : undefined,
        filter.dateFrom ? gte(sales.sold_at, filter.dateFrom) : undefined,
        filter.dateTo ? lt(sales.sold_at, filter.dateTo) : undefined, // exclusive: [from, to)
        searchAny(filter.search, sales.receipt_number),
      ],
      options,
    );
    return { rows: await this.withDetails(page.rows), total: page.total };
  }
}

@Injectable()
export class SaleItemsRepository extends BaseRepository<typeof saleItems> {
  protected readonly table = saleItems;
}

@Injectable()
export class PaymentsRepository extends BaseRepository<typeof payments> {
  protected readonly table = payments;

  /** SUM of pending + paid payments of a sale, in cents. */
  async activeTotal(saleId: string, excludeId?: string): Promise<Cents> {
    const [row] = await this.db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          eq(payments.sale_id, saleId),
          inArray(payments.status, [...ACTIVE_PAYMENT_STATUSES]),
          excludeId ? ne(payments.id, excludeId) : undefined,
        ),
      );
    return toCents(row?.total ?? '0');
  }

  /** Payments, optionally only those of one store's sales (join). */
  async listFiltered(
    filter: { saleId?: string; status?: PaymentStatus; paymentMethod?: PaymentMethod; storeId?: string },
    { offset, limit }: ListOptions,
  ): Promise<Page<Payment>> {
    const conditions: (SQL | undefined)[] = [
      filter.saleId ? eq(payments.sale_id, filter.saleId) : undefined,
      filter.status ? eq(payments.status, filter.status) : undefined,
      filter.paymentMethod ? eq(payments.payment_method, filter.paymentMethod) : undefined,
      filter.storeId ? sql`${payments.sale_id} in (select ${sales.id} from ${sales} where ${sales.store_id} = ${filter.storeId})` : undefined,
    ];
    const where = and(...conditions);
    const query = this.db.select().from(payments).where(where).orderBy(asc(payments.id)).offset(offset);
    const [rows, [{ total }]] = await Promise.all([
      limit === undefined ? query : query.limit(limit),
      this.db.select({ total: count() }).from(payments).where(where),
    ]);
    return { rows, total };
  }
}

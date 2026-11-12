import { Injectable } from '@nestjs/common';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { searchAny } from '../../common/utils/search.js';
import { AlertStatus, AlertType, inventories, MoveType, stockAlerts, stockMoves } from '../schema/index.js';
import { BaseRepository, ListOptions } from './base.repository.js';

@Injectable()
export class InventoriesRepository extends BaseRepository<typeof inventories> {
  protected readonly table = inventories;

  /** The inventory of (store, product); lock=true -> SELECT ... FOR UPDATE. */
  async getForProduct(storeId: string, productId: string, { lock = false } = {}) {
    const query = this.db
      .select()
      .from(inventories)
      .where(and(eq(inventories.store_id, storeId), eq(inventories.product_id, productId)))
      .limit(1);
    const [row] = lock ? await query.for('update') : await query;
    return row;
  }

  async deleteForProduct(storeId: string, productId: string): Promise<void> {
    await this.db
      .delete(inventories)
      .where(and(eq(inventories.store_id, storeId), eq(inventories.product_id, productId)));
  }

  listFiltered(filter: { storeId?: string; productId?: string; lowStock?: boolean }, options: ListOptions) {
    // available_qty <= reorder_level, computed in SQL
    const available = sql`${inventories.qty} - ${inventories.reserved_qty}`;
    const lowStock =
      filter.lowStock === undefined
        ? undefined
        : filter.lowStock
          ? lte(available, inventories.reorder_level)
          : gt(available, inventories.reorder_level);
    return this.findPage(
      [
        filter.storeId ? eq(inventories.store_id, filter.storeId) : undefined,
        filter.productId ? eq(inventories.product_id, filter.productId) : undefined,
        lowStock,
      ],
      options,
    );
  }
}

@Injectable()
export class StockMovesRepository extends BaseRepository<typeof stockMoves> {
  protected readonly table = stockMoves;

  listFiltered(
    filter: { storeId?: string; productId?: string; moveType?: MoveType; search?: string },
    options: ListOptions,
  ) {
    return this.findPage(
      [
        filter.storeId ? eq(stockMoves.store_id, filter.storeId) : undefined,
        filter.productId ? eq(stockMoves.product_id, filter.productId) : undefined,
        filter.moveType ? eq(stockMoves.move_type, filter.moveType) : undefined,
        searchAny(filter.search, stockMoves.reference),
      ],
      options,
    );
  }
}

@Injectable()
export class AlertsRepository extends BaseRepository<typeof stockAlerts> {
  protected readonly table = stockAlerts;

  getOpenForProduct(productId: string) {
    return this.findOne(and(eq(stockAlerts.product_id, productId), eq(stockAlerts.status, AlertStatus.OPEN)));
  }

  listFiltered(
    filter: { storeId?: string; productId?: string; status?: AlertStatus; alert?: AlertType },
    options: ListOptions,
  ) {
    return this.findPage(
      [
        filter.storeId ? eq(stockAlerts.store_id, filter.storeId) : undefined,
        filter.productId ? eq(stockAlerts.product_id, filter.productId) : undefined,
        filter.alert ? eq(stockAlerts.alert, filter.alert) : undefined,
        filter.status ? eq(stockAlerts.status, filter.status) : undefined,
      ],
      options,
    );
  }
}

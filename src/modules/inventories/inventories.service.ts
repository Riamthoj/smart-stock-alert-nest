import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { DatabaseService } from '../../database/database.service.js';
import { ProductsRepository } from '../../database/repositories/catalog.repository.js';
import { InventoriesRepository, StockMovesRepository } from '../../database/repositories/stock.repository.js';
import { MoveType, type Inventory, type StockMove } from '../../database/schema/index.js';
import type { Scope } from '../auth/scope.js';
import { AlertsService, availableQty, isLowStock } from '../alerts/alerts.service.js';
import { InventoriesQueryDto, InventoryCreateDto, InventoryUpdateDto, StockAdjustmentDto } from './dto/inventory.dto.js';

export const presentInventory = (i: Inventory) => ({
  id: i.id,
  store_id: i.store_id,
  product_id: i.product_id,
  qty: i.qty,
  reserved_qty: i.reserved_qty,
  reorder_level: i.reorder_level,
  available_qty: availableQty(i),
  is_low_stock: isLowStock(i),
  created_at: i.created_at,
  updated_at: i.updated_at,
});

/** A stock change to record: signed delta (+in / -out). */
export interface StockChange {
  delta: number;
  moveType: MoveType;
  reference?: string | null;
}

/**
 * Stock levels. EVERY change goes through applyMove(), which in ONE transaction:
 *   1. checks stock never drops below what is reserved
 *   2. updates inventories.qty
 *   3. appends the ledger row (stock_moves)       -> SUM(moves) == qty, always
 *   4. re-evaluates the product's stock alert
 * Rows are locked (SELECT ... FOR UPDATE) first, so two concurrent sales of
 * the last unit can't both succeed.
 */
@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly inventories: InventoriesRepository,
    private readonly moves: StockMovesRepository,
    private readonly products: ProductsRepository,
    private readonly alerts: AlertsService,
  ) {}

  list(scope: Scope, query: InventoriesQueryDto) {
    return this.inventories.listFiltered(
      { storeId: scope.listStore(query.store_id), productId: query.product_id, lowStock: query.low_stock },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<Inventory> {
    return scope.visible(await this.inventories.findById(id), 'Inventory', id);
  }

  /** Must run inside a transaction, on a LOCKED inventory row. */
  private async applyMove(
    inventory: Inventory,
    { delta, moveType, reference }: StockChange,
  ): Promise<{ inventory: Inventory; move: StockMove }> {
    const newQty = inventory.qty + delta;
    if (newQty < inventory.reserved_qty) {
      throw new BusinessRuleError(
        `Insufficient stock: available ${availableQty(inventory)}, tried to remove ${-delta}`,
      );
    }
    const updated = await this.inventories.update(inventory.id, { qty: newQty });
    const move = await this.moves.insert({
      store_id: inventory.store_id,
      product_id: inventory.product_id,
      qty: delta,
      move_type: moveType,
      reference: reference ?? null,
    });
    await this.alerts.evaluate(updated);
    this.logger.log(
      `Stock move ${moveType} ${delta > 0 ? '+' : ''}${delta} product=${inventory.product_id} ref=${reference ?? '-'} -> qty ${newQty}`,
    );
    return { inventory: updated, move };
  }

  private async lockOwned(scope: Scope, id: string): Promise<Inventory> {
    return scope.visible(await this.inventories.findByIdForUpdate(id), 'Inventory', id);
  }

  async create(scope: Scope, dto: InventoryCreateDto): Promise<Inventory> {
    const storeId = scope.checkCreate(dto.store_id);
    if (dto.reserved_qty > dto.qty) throw new BusinessRuleError('reserved_qty cannot be greater than qty');
    const product = await this.products.findById(dto.product_id);
    if (!product) throw new NotFoundError(`Product ${dto.product_id} not found`);
    if (product.store_id !== storeId) throw new BusinessRuleError('Product belongs to a different store');
    if (await this.inventories.getForProduct(storeId, dto.product_id)) {
      throw new ConflictError('This product already has an inventory in this store');
    }

    const inventory = await this.database.transaction(async () => {
      let inv = await this.inventories.insert({
        store_id: storeId,
        product_id: dto.product_id,
        reorder_level: dto.reorder_level,
        qty: 0,
        reserved_qty: 0,
      });
      // Opening stock is a real ledger entry, so SUM(moves) == qty from day one.
      if (dto.qty) inv = (await this.applyMove(inv, { delta: dto.qty, moveType: MoveType.IN, reference: 'initial stock' })).inventory;
      if (dto.reserved_qty) inv = await this.inventories.update(inv.id, { reserved_qty: dto.reserved_qty });
      await this.alerts.evaluate(inv);
      return inv;
    });
    this.logger.log(`Inventory created id=${inventory.id} product=${inventory.product_id} qty=${inventory.qty}`);
    return inventory;
  }

  async update(scope: Scope, id: string, dto: InventoryUpdateDto): Promise<Inventory> {
    return this.database.transaction(async () => {
      let inventory = await this.lockOwned(scope, id);
      const newQty = dto.qty ?? inventory.qty;
      const newReserved = dto.reserved_qty ?? inventory.reserved_qty;
      if (newReserved > newQty) {
        throw new BusinessRuleError(`reserved_qty (${newReserved}) cannot be greater than qty (${newQty})`);
      }
      // Lower `reserved` first, so the qty move's "qty >= reserved" check uses the new value.
      inventory = await this.inventories.update(id, {
        reserved_qty: Math.min(newReserved, inventory.reserved_qty),
        reorder_level: dto.reorder_level ?? inventory.reorder_level,
      });
      if (newQty !== inventory.qty) {
        inventory = (
          await this.applyMove(inventory, {
            delta: newQty - inventory.qty,
            moveType: MoveType.ADJUST,
            reference: 'manual qty update',
          })
        ).inventory;
      }
      if (newReserved !== inventory.reserved_qty) {
        inventory = await this.inventories.update(id, { reserved_qty: newReserved });
      }
      await this.alerts.evaluate(inventory);
      return inventory;
    });
  }

  /** POST /inventories/{id}/stock: +restock / -shrinkage. */
  async adjustStock(scope: Scope, id: string, dto: StockAdjustmentDto): Promise<Inventory> {
    return this.database.transaction(async () => {
      const inventory = await this.lockOwned(scope, id);
      const moveType = dto.delta > 0 ? MoveType.IN : MoveType.OUT;
      return (await this.applyMove(inventory, { delta: dto.delta, moveType, reference: dto.reason })).inventory;
    });
  }

  /** POST /stock-moves: record a move for (store, product). */
  async recordMove(storeId: string, productId: string, change: StockChange) {
    return this.database.transaction(async () => {
      const inventory = await this.inventories.getForProduct(storeId, productId, { lock: true });
      if (!inventory) {
        throw new NotFoundError(`No inventory for product ${productId} in store ${storeId}; create one first`);
      }
      return this.applyMove(inventory, change);
    });
  }

  /** Used by SalesService INSIDE the sale's transaction. */
  async removeForSale(storeId: string, productId: string, qty: number, reference: string): Promise<StockMove> {
    const inventory = await this.inventories.getForProduct(storeId, productId, { lock: true });
    if (!inventory) throw new BusinessRuleError(`Product ${productId} has no inventory in this store`);
    return (await this.applyMove(inventory, { delta: -qty, moveType: MoveType.OUT, reference })).move;
  }

  async delete(scope: Scope, id: string): Promise<void> {
    const inventory = await this.get(scope, id);
    await this.database.transaction(async () => {
      await this.alerts.resolveOpenForProduct(inventory.product_id);
      await this.inventories.delete(id);
    });
  }
}

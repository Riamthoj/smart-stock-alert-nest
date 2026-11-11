import { Injectable, Logger } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { BusinessRuleError } from '../../common/errors/app-error.js';
import { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { OptionalUuid } from '../../common/validation/validators.js';
import { AlertsRepository } from '../../database/repositories/stock.repository.js';
import {
  ALERT_STATUSES,
  ALERT_TYPES,
  AlertStatus,
  AlertType,
  type Inventory,
  type StockAlert,
} from '../../database/schema/index.js';
import type { Scope } from '../auth/scope.js';

export class AlertsQueryDto extends StoreFilterQueryDto {
  /** Only this product */
  @OptionalUuid()
  product_id?: string;

  /** open / resolved */
  @IsOptional()
  @IsIn(ALERT_STATUSES)
  status?: AlertStatus;

  /** low_stock / out_of_stock */
  @IsOptional()
  @IsIn(ALERT_TYPES)
  alert?: AlertType;
}

export const presentAlert = (a: StockAlert) => ({
  id: a.id,
  store_id: a.store_id,
  product_id: a.product_id,
  alert: a.alert,
  status: a.status,
  quantity_at_trigger: a.quantity_at_trigger,
  threshold_at_trigger: a.threshold_at_trigger,
  resolved_at: a.resolved_at,
  created_at: a.created_at,
  updated_at: a.updated_at,
});

export const availableQty = (i: Pick<Inventory, 'qty' | 'reserved_qty'>) => i.qty - i.reserved_qty;
export const isLowStock = (i: Pick<Inventory, 'qty' | 'reserved_qty' | 'reorder_level'>) =>
  availableQty(i) <= i.reorder_level;

/**
 * THE "smart" part: alerts manage themselves. Every stock change calls
 * evaluate(), inside the same transaction as the change:
 *
 *   low & no open alert    -> OPEN a new alert (low_stock / out_of_stock)
 *   low & open alert       -> refresh it (and escalate low -> out_of_stock)
 *   OK  & open alert       -> auto-RESOLVE it
 *
 * At most ONE open alert per product, so the dashboard never shows duplicates.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly alerts: AlertsRepository) {}

  async evaluate(inventory: Inventory): Promise<void> {
    const open = await this.alerts.getOpenForProduct(inventory.product_id);
    const available = availableQty(inventory);
    const type: AlertType = available <= 0 ? AlertType.OUT_OF_STOCK : AlertType.LOW_STOCK;
    const low = isLowStock(inventory);

    if (low && !open) {
      await this.alerts.insert({
        store_id: inventory.store_id,
        product_id: inventory.product_id,
        alert: type,
        quantity_at_trigger: available,
        threshold_at_trigger: inventory.reorder_level,
      });
      this.logger.warn(`Stock alert OPENED (${type}) product=${inventory.product_id} available=${available}`);
    } else if (low && open) {
      if (open.alert !== type) this.logger.warn(`Stock alert for product=${inventory.product_id} is now ${type}`);
      await this.alerts.update(open.id, {
        alert: type,
        quantity_at_trigger: available,
        threshold_at_trigger: inventory.reorder_level,
      });
    } else if (!low && open) {
      await this.markResolved(open.id);
      this.logger.log(`Stock alert auto-resolved for product=${inventory.product_id}`);
    }
  }

  /** E.g. the inventory is deleted: nothing left to watch. */
  async resolveOpenForProduct(productId: string): Promise<void> {
    const open = await this.alerts.getOpenForProduct(productId);
    if (open) await this.markResolved(open.id);
  }

  list(scope: Scope, query: AlertsQueryDto) {
    return this.alerts.listFiltered(
      { storeId: scope.listStore(query.store_id), productId: query.product_id, status: query.status, alert: query.alert },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<StockAlert> {
    return scope.visible(await this.alerts.findById(id), 'Alert', id);
  }

  async resolve(scope: Scope, id: string): Promise<StockAlert> {
    const alert = await this.get(scope, id);
    if (alert.status === AlertStatus.RESOLVED) throw new BusinessRuleError(`Alert ${id} is already resolved`);
    return this.markResolved(id);
  }

  private markResolved(id: string) {
    return this.alerts.update(id, { status: AlertStatus.RESOLVED, resolved_at: new Date() });
  }
}

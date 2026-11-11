import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, NotFoundError } from '../../common/errors/app-error.js';
import { nextDailyCode, todayMMDDYY } from '../../common/utils/daily-code.js';
import { fromCents, toCents, type Cents } from '../../common/utils/money.js';
import { AppConfig } from '../../config/app-config.js';
import { DatabaseService } from '../../database/database.service.js';
import { OwnersRepository, StoresRepository } from '../../database/repositories/accounts.repository.js';
import { CustomersRepository, ProductsRepository } from '../../database/repositories/catalog.repository.js';
import {
  SaleItemsRepository,
  SalesRepository,
  type SaleWithDetails,
} from '../../database/repositories/sales.repository.js';
import { StoreStatus } from '../../database/schema/index.js';
import type { Scope } from '../auth/scope.js';
import { InventoriesService } from '../inventories/inventories.service.js';
import { SaleCreateDto, SalesQueryDto } from './dto/sale.dto.js';

const RECEIPT_PREFIX = 'RC';
const RECEIPT_DIGITS = 4; // RC1108260001 -> up to 9999 sales per store per day

/**
 * Point of sale. A sale is created in ONE transaction:
 *   validate store / seller / customer / products (all in the same store)
 *   -> snapshot prices & costs -> compute totals -> receipt number
 *   -> insert sale + items -> remove stock (ledger + alerts)
 * If anything fails (e.g. not enough stock) NOTHING is saved.
 */
@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly sales: SalesRepository,
    private readonly saleItems: SaleItemsRepository,
    private readonly stores: StoresRepository,
    private readonly owners: OwnersRepository,
    private readonly customers: CustomersRepository,
    private readonly products: ProductsRepository,
    private readonly inventories: InventoriesService,
    private readonly config: AppConfig,
  ) {}

  list(scope: Scope, query: SalesQueryDto) {
    return this.sales.listFiltered(
      {
        storeId: scope.listStore(query.store_id),
        ownerId: query.owner_id,
        customerId: query.customer_id,
        dateFrom: query.date_from,
        dateTo: query.date_to,
        search: query.search,
      },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<SaleWithDetails> {
    return scope.visible(await this.sales.findWithDetails(id), 'Sale', id);
  }

  /** RC + MMDDYY + per-store daily counter, under an advisory lock held until COMMIT. */
  private async nextReceiptNumber(storeId: string): Promise<string> {
    const prefix = `${RECEIPT_PREFIX}${todayMMDDYY(this.config.app.timezone)}`;
    await this.database.advisoryLock(`${storeId}:${prefix}`); // same key as the FastAPI version
    const receipt = nextDailyCode(prefix, await this.sales.lastReceipt(storeId, prefix), RECEIPT_DIGITS);
    if (!receipt) throw new BusinessRuleError(`Daily receipt limit reached for ${prefix}`);
    return receipt;
  }

  async create(scope: Scope, dto: SaleCreateDto): Promise<SaleWithDetails> {
    const storeId = scope.checkCreate(dto.store_id);
    const ownerId = dto.owner_id ?? scope.owner?.id; // owner login: you are the seller
    if (!ownerId) throw new BusinessRuleError('owner_id is required');

    // ---- validate references (cheap reads, before the transaction)
    const store = await this.stores.findById(storeId);
    if (!store) throw new NotFoundError(`Store ${storeId} not found`);
    if (store.status === StoreStatus.BLOCK) throw new BusinessRuleError('This store is blocked and cannot make sales');

    const seller = await this.owners.findById(ownerId);
    if (!seller) throw new NotFoundError(`Owner ${ownerId} not found`);
    if (seller.store_id !== storeId) throw new BusinessRuleError('The seller does not belong to this store');

    if (dto.customer_id) {
      const customer = await this.customers.findById(dto.customer_id);
      if (!customer) throw new NotFoundError(`Customer ${dto.customer_id} not found`);
      if (customer.store_id !== storeId) throw new BusinessRuleError('The customer belongs to a different store');
    }

    const products = new Map(
      (await this.products.findManyByIds([...new Set(dto.items.map((i) => i.product_id))])).map((p) => [p.id, p]),
    );

    // ---- price snapshot + totals, in exact integer cents
    const lines = dto.items.map((item) => {
      const product = products.get(item.product_id);
      if (!product) throw new NotFoundError(`Product ${item.product_id} not found`);
      if (product.store_id !== storeId) {
        throw new BusinessRuleError(`Product '${product.name}' belongs to a different store`);
      }
      const unitPrice: Cents = item.unit_price != null ? toCents(item.unit_price) : toCents(product.price);
      return { product_id: product.id, qty: item.qty, unitPrice, costPrice: toCents(product.cost_price) };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    const discount = toCents(dto.discount);
    const tax = toCents(dto.tax);
    if (discount > subtotal) {
      throw new BusinessRuleError(`Discount (${fromCents(discount)}) is larger than the subtotal (${fromCents(subtotal)})`);
    }
    const total = subtotal - discount + tax;

    // ---- write everything atomically
    const sale = await this.database.transaction(async () => {
      const receipt = await this.nextReceiptNumber(storeId);
      const header = await this.sales.insert({
        store_id: storeId,
        owner_id: ownerId,
        customer_id: dto.customer_id ?? null,
        receipt_number: receipt,
        subtotal: fromCents(subtotal),
        discount: fromCents(discount),
        tax: fromCents(tax),
        total: fromCents(total),
        ...(dto.sold_at && { sold_at: dto.sold_at }),
      });
      await this.saleItems.insertMany(
        lines.map((l) => ({
          sale_id: header.id,
          product_id: l.product_id,
          qty: l.qty,
          unit_price: fromCents(l.unitPrice),
          cost_price: fromCents(l.costPrice),
        })),
      );
      // One stock move per product (a product may appear on several lines).
      // Locked in id order: two concurrent sales can never deadlock each other.
      const qtyByProduct = new Map<string, number>();
      for (const l of lines) qtyByProduct.set(l.product_id, (qtyByProduct.get(l.product_id) ?? 0) + l.qty);
      for (const productId of [...qtyByProduct.keys()].sort()) {
        await this.inventories.removeForSale(storeId, productId, qtyByProduct.get(productId)!, receipt);
      }
      return (await this.sales.findWithDetails(header.id))!;
    });

    this.logger.log(
      `Sale ${sale.receipt_number} created store=${storeId} total=${sale.total} items=${lines.length}`,
    );
    return sale;
  }
}

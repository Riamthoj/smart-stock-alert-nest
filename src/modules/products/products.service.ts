import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, ConflictError, notFound } from '../../common/errors/app-error.js';
import { fromCents, moneyToNumber, toCents } from '../../common/utils/money.js';
import { msg, term } from '../../common/i18n/message.js';
import { sentFields, withoutNulls } from '../../common/utils/objects.js';
import { DatabaseService } from '../../database/database.service.js';
import { StoresRepository } from '../../database/repositories/accounts.repository.js';
import { CategoriesRepository, ProductsRepository } from '../../database/repositories/catalog.repository.js';
import { InventoriesRepository } from '../../database/repositories/stock.repository.js';
import type { Product } from '../../database/schema/index.js';
import { ListCacheService } from '../../infrastructure/cache/list-cache.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import type { Scope } from '../auth/scope.js';
import { ProductCreateDto, ProductsQueryDto, ProductUpdateDto } from './dto/product.dto.js';

export const presentProduct = (p: Product) => ({
  id: p.id,
  store_id: p.store_id,
  category_id: p.category_id,
  name: p.name,
  image: p.image,
  bar_code: p.bar_code,
  cost_price: moneyToNumber(p.cost_price),
  price: moneyToNumber(p.price),
  created_at: p.created_at,
  updated_at: p.updated_at,
  deleted_at: p.deleted_at,
});

const money = (value: number) => fromCents(toCents(value));

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly products: ProductsRepository,
    private readonly inventories: InventoriesRepository,
    private readonly alerts: AlertsService,
    private readonly categories: CategoriesRepository,
    private readonly stores: StoresRepository,
    private readonly storage: StorageService,
    private readonly cache: ListCacheService,
  ) {}

  /** Cached (Redis) - invalidated on every product write of the store. */
  list(scope: Scope, query: ProductsQueryDto) {
    const storeId = scope.listStore(query.store_id);
    const deleted = query.deleted ? 'only' : 'exclude'; // ?deleted=true -> the trash
    const filters = { category_id: query.category_id ?? null, deleted };
    return this.cache.page('products', storeId, filters, query, async () => {
      const page = await this.products.listFiltered(
        { storeId, categoryId: query.category_id, search: query.search },
        { offset: query.offset, limit: query.rowLimit, deleted },
      );
      return { rows: page.rows.map(presentProduct), total: page.total };
    });
  }

  async get(scope: Scope, id: string): Promise<Product> {
    return scope.visible(await this.products.findById(id), 'Product', id);
  }

  private async assertCategory(categoryId: string, storeId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw notFound('Category', categoryId);
    if (category.store_id !== storeId) throw new BusinessRuleError('Category belongs to a different store');
  }

  private async assertBarCodeFree(storeId: string, barCode: string | null | undefined, current?: Product) {
    if (!barCode || barCode === current?.bar_code) return;
    const owner = await this.products.getByBarCode(storeId, barCode);
    if (owner?.deleted_at) {
      // The barcode is still reserved by a product in the trash: restoring it is usually what the user wants.
      throw new ConflictError(msg`Barcode '${barCode}' belongs to deleted product ${owner.id}; restore it instead`);
    }
    if (owner) throw new ConflictError(msg`Barcode '${barCode}' already exists in this store`);
  }

  async create(scope: Scope, dto: ProductCreateDto): Promise<Product> {
    const storeId = scope.checkCreate(dto.store_id);
    if (!(await this.stores.findById(storeId))) throw notFound('Store', storeId);
    if (dto.category_id) await this.assertCategory(dto.category_id, storeId);
    await this.assertBarCodeFree(storeId, dto.bar_code);
    const product = await this.products.insert({
      ...dto,
      store_id: storeId,
      cost_price: money(dto.cost_price),
      price: money(dto.price),
    });
    await this.cache.invalidateStore(storeId); // cached lists are now outdated
    this.logger.log(`Product created id=${product.id} name=${product.name} store=${storeId}`);
    return product;
  }

  async update(scope: Scope, id: string, dto: ProductUpdateDto): Promise<Product> {
    const current = await this.get(scope, id);
    // NOT NULL columns: null = no change
    const { cost_price, price, ...changes } = withoutNulls(sentFields(dto), ['name', 'cost_price', 'price']);
    if (changes.category_id) await this.assertCategory(changes.category_id, current.store_id);
    await this.assertBarCodeFree(current.store_id, changes.bar_code, current);
    const product = await this.products.update(id, {
      ...changes,
      ...(cost_price !== undefined && { cost_price: money(cost_price) }),
      ...(price !== undefined && { price: money(price) }),
    });
    await this.cache.invalidateStore(product.store_id);
    await this.storage.cleanupReplaced(current.image, product.image);
    return product;
  }

  /**
   * SOFT delete: the product leaves the catalog but its history stays intact
   * (sale lines, stock moves, alerts still point at it), so it can be deleted
   * even after it was sold, and restored later.
   * Taking it off the shelf also removes its inventory row and resolves its
   * open alert, so it can't be sold or trigger alerts anymore.
   * The image is kept for a restore.
   */
  async delete(scope: Scope, id: string): Promise<void> {
    const product = await this.get(scope, id);
    await this.database.transaction(async () => {
      await this.alerts.resolveOpenForProduct(id);
      await this.inventories.deleteForProduct(product.store_id, id);
      await this.products.delete(id);
    });
    await this.cache.invalidateStore(product.store_id);
    this.logger.log(`Product soft-deleted id=${id} store=${product.store_id}`);
  }

  /** Bring a deleted product back (without stock: create a new inventory for it). */
  async restore(scope: Scope, id: string): Promise<Product> {
    const product = scope.visible(await this.products.findById(id, { withDeleted: true }), 'Product', id);
    if (!product.deleted_at) throw new BusinessRuleError(msg`${term('Product')} ${id} is not deleted`);
    const restored = await this.products.restore(id);
    await this.cache.invalidateStore(product.store_id);
    this.logger.log(`Product restored id=${id}`);
    return restored;
  }

  async uploadImage(scope: Scope, id: string, file: Express.Multer.File | undefined): Promise<Product> {
    const product = await this.get(scope, id);
    const updated = await this.storage.replaceImage(file, 'products', product.image, (path) =>
      this.products.update(id, { image: path }),
    );
    await this.cache.invalidateStore(product.store_id);
    return updated;
  }
}

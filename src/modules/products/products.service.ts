import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { fromCents, moneyToNumber, toCents } from '../../common/utils/money.js';
import { sentFields, withoutNulls } from '../../common/utils/objects.js';
import { StoresRepository } from '../../database/repositories/accounts.repository.js';
import { CategoriesRepository, ProductsRepository } from '../../database/repositories/catalog.repository.js';
import type { Product } from '../../database/schema/index.js';
import { ListCacheService } from '../../infrastructure/cache/list-cache.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
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
});

const money = (value: number) => fromCents(toCents(value));

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly products: ProductsRepository,
    private readonly categories: CategoriesRepository,
    private readonly stores: StoresRepository,
    private readonly storage: StorageService,
    private readonly cache: ListCacheService,
  ) {}

  /** Cached (Redis) - invalidated on every product write of the store. */
  list(scope: Scope, query: ProductsQueryDto) {
    const storeId = scope.listStore(query.store_id);
    return this.cache.page('products', storeId, { category_id: query.category_id ?? null }, query, async () => {
      const page = await this.products.listFiltered(
        { storeId, categoryId: query.category_id, search: query.search },
        { offset: query.offset, limit: query.rowLimit },
      );
      return { rows: page.rows.map(presentProduct), total: page.total };
    });
  }

  async get(scope: Scope, id: string): Promise<Product> {
    return scope.visible(await this.products.findById(id), 'Product', id);
  }

  private async assertCategory(categoryId: string, storeId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) throw new NotFoundError(`Category ${categoryId} not found`);
    if (category.store_id !== storeId) throw new BusinessRuleError('Category belongs to a different store');
  }

  private async assertBarCodeFree(storeId: string, barCode: string | null | undefined, current?: Product) {
    if (barCode && barCode !== current?.bar_code && (await this.products.getByBarCode(storeId, barCode))) {
      throw new ConflictError(`Barcode '${barCode}' already exists in this store`);
    }
  }

  async create(scope: Scope, dto: ProductCreateDto): Promise<Product> {
    const storeId = scope.checkCreate(dto.store_id);
    if (!(await this.stores.findById(storeId))) throw new NotFoundError(`Store ${storeId} not found`);
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

  async delete(scope: Scope, id: string): Promise<void> {
    const product = await this.get(scope, id);
    if (await this.products.appearsOnSales(id)) {
      throw new ConflictError('This product appears on sales and cannot be deleted');
    }
    await this.products.delete(id); // inventory, moves and alerts cascade
    await this.cache.invalidateStore(product.store_id);
    await this.storage.deleteFile(product.image);
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

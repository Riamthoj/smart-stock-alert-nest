import { Injectable, Logger } from '@nestjs/common';
import { ConflictError, notFound } from '../../common/errors/app-error.js';
import type { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { sentFields, withoutNulls } from '../../common/utils/objects.js';
import { StoresRepository } from '../../database/repositories/accounts.repository.js';
import { CategoriesRepository } from '../../database/repositories/catalog.repository.js';
import type { Category } from '../../database/schema/index.js';
import { ListCacheService } from '../../infrastructure/cache/list-cache.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import type { Scope } from '../auth/scope.js';
import { CategoryCreateDto, CategoryUpdateDto } from './dto/category.dto.js';
import { msg } from '../../common/i18n/message.js';

export const presentCategory = (c: Category) => ({
  id: c.id,
  store_id: c.store_id,
  name: c.name,
  image: c.image,
  detail: c.detail,
  created_at: c.created_at,
  updated_at: c.updated_at,
});

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categories: CategoriesRepository,
    private readonly stores: StoresRepository,
    private readonly storage: StorageService,
    private readonly cache: ListCacheService,
  ) {}

  /** Cached (Redis) - invalidated on every category write of the store. */
  list(scope: Scope, query: StoreFilterQueryDto) {
    const storeId = scope.listStore(query.store_id);
    return this.cache.page('categories', storeId, {}, query, async () => {
      const page = await this.categories.listFiltered(
        { storeId, search: query.search },
        { offset: query.offset, limit: query.rowLimit },
      );
      return { rows: page.rows.map(presentCategory), total: page.total };
    });
  }

  async get(scope: Scope, id: string): Promise<Category> {
    return scope.visible(await this.categories.findById(id), 'Category', id);
  }

  private async assertNameFree(storeId: string, name: string | undefined, current?: Category) {
    if (name && name !== current?.name && (await this.categories.getByName(storeId, name))) {
      throw new ConflictError(msg`Category '${name}' already exists in this store`);
    }
  }

  async create(scope: Scope, dto: CategoryCreateDto): Promise<Category> {
    const storeId = scope.checkCreate(dto.store_id);
    if (!(await this.stores.findById(storeId))) throw notFound('Store', storeId);
    await this.assertNameFree(storeId, dto.name);
    const category = await this.categories.insert({ ...dto, store_id: storeId });
    await this.cache.invalidateStore(storeId);
    this.logger.log(`Category created id=${category.id} name=${category.name} store=${storeId}`);
    return category;
  }

  async update(scope: Scope, id: string, dto: CategoryUpdateDto): Promise<Category> {
    const current = await this.get(scope, id);
    const changes = withoutNulls(sentFields(dto), ['name']); // name is NOT NULL: null = no change
    await this.assertNameFree(current.store_id, changes.name, current);
    const category = await this.categories.update(id, changes);
    await this.cache.invalidateStore(category.store_id);
    await this.storage.cleanupReplaced(current.image, category.image);
    return category;
  }

  async delete(scope: Scope, id: string): Promise<void> {
    const category = await this.get(scope, id);
    await this.categories.delete(id); // its products become uncategorized (ON DELETE SET NULL)
    await this.cache.invalidateStore(category.store_id);
    await this.storage.deleteFile(category.image);
  }

  async uploadImage(scope: Scope, id: string, file: Express.Multer.File | undefined): Promise<Category> {
    const category = await this.get(scope, id);
    const updated = await this.storage.replaceImage(file, 'categories', category.image, (path) =>
      this.categories.update(id, { image: path }),
    );
    await this.cache.invalidateStore(category.store_id);
    return updated;
  }
}

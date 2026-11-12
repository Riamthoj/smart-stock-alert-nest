import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { notFound } from '../../common/errors/app-error.js';
import { sentFields, withoutNulls } from '../../common/utils/objects.js';
import { DatabaseService } from '../../database/database.service.js';
import { StoresRepository } from '../../database/repositories/accounts.repository.js';
import { sales, type Owner, type Store, type StoreStatus } from '../../database/schema/index.js';
import { ListCacheService } from '../../infrastructure/cache/list-cache.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import type { Scope } from '../auth/scope.js';
import { OwnersService } from '../owners/owners.service.js';
import { StoreCreateDto, StoresQueryDto, StoreUpdateDto } from './dto/store.dto.js';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly stores: StoresRepository,
    private readonly owners: OwnersService,
    private readonly storage: StorageService,
    private readonly cache: ListCacheService,
  ) {}

  list(scope: Scope, query: StoresQueryDto) {
    return this.stores.listFiltered(
      { search: query.search, status: query.status, storeId: scope.storeId }, // owners: only their store
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<Store> {
    const store = await this.stores.findById(id);
    if (!store) throw notFound('Store', id);
    scope.check(store.id, 'Store', id);
    return store;
  }

  /** Store + its primary owner, atomically (both or neither). */
  async create(scope: Scope, { owner, ...data }: StoreCreateDto): Promise<{ store: Store; owner: Owner }> {
    scope.requireAdmin(); // owners can't open new stores
    const result = await this.database.transaction(async () => {
      const store = await this.stores.insert(data);
      const first = await this.owners.addOwner(store.id, owner, { isOwner: true, isPrimary: true });
      return { store, owner: first };
    });
    this.logger.log(`Store created id=${result.store.id} name=${result.store.name} owner=${result.owner.username}`);
    return result;
  }

  async update(scope: Scope, id: string, dto: StoreUpdateDto): Promise<Store> {
    const current = await this.get(scope, id);
    scope.requireStoreOwner(); // staff can't edit the store
    const store = await this.stores.update(id, withoutNulls(sentFields(dto), ['name']));
    await this.storage.cleanupReplaced(current.image, store.image);
    return store;
  }

  async setStatus(scope: Scope, id: string, status: StoreStatus): Promise<Store> {
    scope.requireAdmin(); // approving / blocking stores is for admins
    const current = await this.get(scope, id);
    const store = await this.stores.update(id, { status });
    this.logger.log(`Store ${id} status ${current.status} -> ${status}`);
    return store;
  }

  /**
   * Delete a store and EVERYTHING in it. Sales go first: sales.owner_id has
   * no ON DELETE CASCADE, so they'd block the owners' cascade.
   * Files are removed only after the database commit succeeded.
   */
  async delete(scope: Scope, id: string): Promise<void> {
    scope.requireAdmin();
    await this.get(scope, id);
    const files = await this.stores.filePaths(id);
    await this.database.transaction(async () => {
      await this.database.db.delete(sales).where(eq(sales.store_id, id));
      await this.stores.delete(id);
    });
    await this.cache.invalidateStore(id);
    await Promise.all(files.map((f) => this.storage.deleteFile(f)));
    this.logger.log(`Store ${id} deleted (${files.length} files removed)`);
  }

  async uploadImage(scope: Scope, id: string, file: Express.Multer.File | undefined): Promise<Store> {
    const store = await this.get(scope, id);
    scope.requireStoreOwner();
    return this.storage.replaceImage(file, 'stores', store.image, (path) => this.stores.update(id, { image: path }));
  }
}

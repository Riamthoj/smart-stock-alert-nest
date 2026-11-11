import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import type { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { nextDailyCode, todayMMDDYY } from '../../common/utils/daily-code.js';
import { sentFields, withoutNulls } from '../../common/utils/objects.js';
import { AppConfig } from '../../config/app-config.js';
import { DatabaseService } from '../../database/database.service.js';
import { StoresRepository } from '../../database/repositories/accounts.repository.js';
import { CustomersRepository } from '../../database/repositories/catalog.repository.js';
import type { Customer } from '../../database/schema/index.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import type { Scope } from '../auth/scope.js';
import { CustomerCreateDto, CustomerUpdateDto } from './dto/customer.dto.js';

const CODE_PREFIX = 'CUS';
const CODE_DIGITS = 4; // CUS1108260001 -> up to 9999 new customers per day

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly customers: CustomersRepository,
    private readonly stores: StoresRepository,
    private readonly storage: StorageService,
    private readonly config: AppConfig,
  ) {}

  list(scope: Scope, query: StoreFilterQueryDto) {
    return this.customers.listFiltered(
      { storeId: scope.listStore(query.store_id), search: query.search },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<Customer> {
    return scope.visible(await this.customers.findById(id), 'Customer', id);
  }

  private async assertPhoneFree(storeId: string, phone: string | null | undefined, current?: Customer) {
    if (phone && phone !== current?.phone && (await this.customers.getByPhone(storeId, phone))) {
      throw new ConflictError(`Phone '${phone}' is already registered in this store`);
    }
  }

  /**
   * CUS + MMDDYY (business time zone) + 4-digit daily counter.
   * An advisory lock (held until COMMIT) serializes concurrent creates, so two
   * requests can never compute the same code. Same lock key as the FastAPI version.
   */
  private async nextCode(): Promise<string> {
    const prefix = `${CODE_PREFIX}${todayMMDDYY(this.config.app.timezone)}`;
    await this.database.advisoryLock(prefix);
    const code = nextDailyCode(prefix, await this.customers.lastCodeWithPrefix(prefix), CODE_DIGITS);
    if (!code) throw new BusinessRuleError(`Daily customer limit reached for ${prefix}`);
    return code;
  }

  async create(scope: Scope, dto: CustomerCreateDto): Promise<Customer> {
    const storeId = scope.checkCreate(dto.store_id);
    if (!(await this.stores.findById(storeId))) throw new NotFoundError(`Store ${storeId} not found`);
    await this.assertPhoneFree(storeId, dto.phone);
    const customer = await this.database.transaction(async () =>
      this.customers.insert({ ...dto, store_id: storeId, code: await this.nextCode() }),
    );
    this.logger.log(`Customer created id=${customer.id} code=${customer.code}`);
    return customer;
  }

  async update(scope: Scope, id: string, dto: CustomerUpdateDto): Promise<Customer> {
    const current = await this.get(scope, id);
    const changes = withoutNulls(sentFields(dto), ['full_name']);
    await this.assertPhoneFree(current.store_id, changes.phone, current);
    const customer = await this.customers.update(id, changes);
    await this.storage.cleanupReplaced(current.profile, customer.profile);
    return customer;
  }

  async setActive(scope: Scope, id: string, isActive: boolean): Promise<Customer> {
    await this.get(scope, id);
    return this.customers.update(id, { is_active: isActive });
  }

  async delete(scope: Scope, id: string): Promise<void> {
    const customer = await this.get(scope, id);
    await this.customers.delete(id); // their sales keep existing with customer_id = NULL
    await this.storage.deleteFile(customer.profile);
  }

  async uploadProfile(scope: Scope, id: string, file: Express.Multer.File | undefined): Promise<Customer> {
    const customer = await this.get(scope, id);
    return this.storage.replaceImage(file, 'customers', customer.profile, (path) =>
      this.customers.update(id, { profile: path }),
    );
  }
}

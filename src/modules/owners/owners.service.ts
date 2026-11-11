import { Injectable, Logger } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import type { PaginationQueryDto } from '../../common/pagination/pagination.dto.js';
import { sentFields } from '../../common/utils/objects.js';
import { OwnersRepository, StoresRepository } from '../../database/repositories/accounts.repository.js';
import type { Owner } from '../../database/schema/index.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { PasswordService } from '../auth/password.service.js';
import { RevocationService } from '../auth/revocation.service.js';
import type { Scope } from '../auth/scope.js';
import { OwnerAccountDto, OwnerCreateDto, OwnerUpdateDto } from './dto/owner.dto.js';

/**
 * Store accounts. Rules:
 *   * creating a store also creates its FIRST owner (is_owner + is_primary)
 *   * the primary owner can never be deleted nor lose is_owner
 *   * staff (is_owner=false) may only change their OWN profile / password
 */
@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    private readonly owners: OwnersRepository,
    private readonly stores: StoresRepository,
    private readonly passwords: PasswordService,
    private readonly revocation: RevocationService,
    private readonly storage: StorageService,
  ) {}

  list(scope: Scope, storeId: string | undefined, query: PaginationQueryDto) {
    return this.owners.listFiltered(
      { storeId: scope.listStore(storeId), search: query.search },
      { offset: query.offset, limit: query.rowLimit },
    );
  }

  async get(scope: Scope, id: string): Promise<Owner> {
    return scope.visible(await this.owners.findById(id), 'Owner', id);
  }

  /** Insert an account (no store checks): shared with StoresService.create. */
  async addOwner(storeId: string, account: OwnerAccountDto, flags: { isOwner: boolean; isPrimary?: boolean }) {
    if (await this.owners.getByUsername(account.username)) {
      throw new ConflictError(`Username '${account.username}' is already taken`);
    }
    if (account.phone && (await this.owners.getByPhone(account.phone))) {
      throw new ConflictError(`Phone '${account.phone}' is already registered`);
    }
    return this.owners.insert({
      store_id: storeId,
      username: account.username,
      phone: account.phone,
      profile: account.profile,
      password_hash: await this.passwords.hash(account.password),
      is_owner: flags.isOwner,
      is_primary: flags.isPrimary ?? false,
    });
  }

  async create(scope: Scope, dto: OwnerCreateDto): Promise<Owner> {
    const storeId = scope.checkCreate(dto.store_id);
    scope.requireStoreOwner(); // staff can't add people
    if (!(await this.stores.findById(storeId))) throw new NotFoundError(`Store ${storeId} not found`);
    const owner = await this.addOwner(storeId, dto, { isOwner: dto.is_owner });
    this.logger.log(`Owner created id=${owner.id} username=${owner.username} store=${owner.store_id}`);
    return owner;
  }

  async update(scope: Scope, id: string, dto: OwnerUpdateDto): Promise<Owner> {
    const current = await this.get(scope, id);
    scope.requireStoreOwner(id); // staff: only their own profile
    const changes = sentFields(dto);
    if (changes.phone && changes.phone !== current.phone && (await this.owners.getByPhone(changes.phone))) {
      throw new ConflictError(`Phone '${changes.phone}' is already registered`);
    }
    const owner = await this.owners.update(id, changes);
    await this.storage.cleanupReplaced(current.profile, owner.profile);
    return owner;
  }

  async setIsOwner(scope: Scope, id: string, isOwner: boolean): Promise<Owner> {
    const current = await this.get(scope, id);
    scope.requireStoreOwner(); // staff can't promote anyone (or themselves)
    if (current.is_primary && !isOwner) throw new BusinessRuleError('The primary owner must stay an owner');
    const owner = await this.owners.update(id, { is_owner: isOwner });
    this.logger.log(`Owner ${id} is_owner -> ${isOwner}`);
    return owner;
  }

  async resetPassword(scope: Scope, id: string, password: string): Promise<Owner> {
    await this.get(scope, id);
    scope.requireStoreOwner(id); // staff: only their own password
    const owner = await this.owners.update(id, { password_hash: await this.passwords.hash(password) });
    await this.revocation.revokeAll('owner', id, { required: false });
    return owner;
  }

  async delete(scope: Scope, id: string): Promise<void> {
    const owner = await this.get(scope, id);
    scope.requireStoreOwner();
    if (owner.is_primary) throw new BusinessRuleError('The primary owner of a store cannot be deleted');
    if (await this.owners.hasSales(id)) throw new ConflictError('This owner has made sales and cannot be deleted');
    await this.owners.delete(id);
    await this.storage.deleteFile(owner.profile);
  }

  async uploadProfile(scope: Scope, id: string, file: Express.Multer.File | undefined): Promise<Owner> {
    const owner = await this.get(scope, id);
    scope.requireStoreOwner(id); // staff: only their own picture
    return this.storage.replaceImage(file, 'owners', owner.profile, (path) => this.owners.update(id, { profile: path }));
  }
}

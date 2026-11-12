import { Injectable, Logger } from '@nestjs/common';
import { ConflictError, notFound } from '../../common/errors/app-error.js';
import type { PaginationQueryDto } from '../../common/pagination/pagination.dto.js';
import { sentFields } from '../../common/utils/objects.js';
import { UsersRepository } from '../../database/repositories/accounts.repository.js';
import type { User } from '../../database/schema/index.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { PasswordService } from '../auth/password.service.js';
import { RevocationService } from '../auth/revocation.service.js';
import { UserCreateDto, UserUpdateDto } from './dto/user.dto.js';
import { msg } from '../../common/i18n/message.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly revocation: RevocationService,
    private readonly storage: StorageService,
  ) {}

  list(query: PaginationQueryDto) {
    return this.users.listFiltered({ search: query.search }, { offset: query.offset, limit: query.rowLimit });
  }

  async get(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw notFound('User', id);
    return user;
  }

  private async assertPhoneFree(phone: string | null | undefined, current?: User): Promise<void> {
    if (phone && phone !== current?.phone && (await this.users.getByPhone(phone))) {
      throw new ConflictError(msg`Phone '${phone}' is already registered`);
    }
  }

  async create({ password, ...data }: UserCreateDto): Promise<User> {
    if (await this.users.getByUsername(data.username)) {
      throw new ConflictError(msg`Username '${data.username}' is already taken`);
    }
    await this.assertPhoneFree(data.phone);
    const user = await this.users.insert({ ...data, password_hash: await this.passwords.hash(password) });
    this.logger.log(`User created id=${user.id} username=${user.username}`);
    return user;
  }

  async update(id: string, dto: UserUpdateDto): Promise<User> {
    const current = await this.get(id);
    const changes = sentFields(dto);
    await this.assertPhoneFree(changes.phone, current);
    const user = await this.users.update(id, changes);
    await this.storage.cleanupReplaced(current.profile, user.profile); // picture changed -> delete old upload
    return user;
  }

  async resetPassword(id: string, password: string): Promise<User> {
    await this.get(id);
    const user = await this.users.update(id, { password_hash: await this.passwords.hash(password) });
    await this.revocation.revokeAll('user', id, { required: false }); // log out every device
    return user;
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    await this.get(id);
    return this.users.update(id, { is_active: isActive });
  }

  async delete(id: string): Promise<void> {
    const user = await this.get(id);
    await this.users.delete(id);
    await this.storage.deleteFile(user.profile);
  }

  async uploadProfile(id: string, file: Express.Multer.File | undefined): Promise<User> {
    const user = await this.get(id);
    return this.storage.replaceImage(file, 'users', user.profile, (path) => this.users.update(id, { profile: path }));
  }
}

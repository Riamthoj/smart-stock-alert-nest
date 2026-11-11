import { Injectable, Logger } from '@nestjs/common';
import { ForbiddenError, UnauthorizedError } from '../../common/errors/app-error.js';
import { OwnersRepository, StoresRepository, UsersRepository } from '../../database/repositories/accounts.repository.js';
import type { Owner, User } from '../../database/schema/index.js';
import { LoginDto } from './dto/login.dto.js';
import { PasswordService } from './password.service.js';
import { RevocationService } from './revocation.service.js';
import { Scope } from './scope.js';
import { AccessClaims, TokenService } from './token.service.js';

const BAD_CREDENTIALS = 'Incorrect username or password';

export interface LoginResult<A> {
  token: string;
  expiresIn: number;
  account: A;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly owners: OwnersRepository,
    private readonly stores: StoresRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly revocation: RevocationService,
  ) {}

  // --------------------------------------------------------------- login
  async loginUser({ username, password }: LoginDto): Promise<LoginResult<User>> {
    const user = await this.users.getByUsername(username);
    if (!(await this.passwords.check(password, user?.password_hash))) {
      this.logger.warn(`Failed user login username=${username}`);
      throw new UnauthorizedError(BAD_CREDENTIALS);
    }
    if (!user!.is_active) throw new ForbiddenError('This account is disabled');
    const { token, expiresIn } = await this.tokens.issue(user!.id, 'user');
    this.logger.log(`User logged in id=${user!.id}`);
    return { token, expiresIn, account: user! };
  }

  async loginOwner({ username, password }: LoginDto): Promise<LoginResult<Owner>> {
    const owner = await this.owners.getByUsername(username);
    if (!(await this.passwords.check(password, owner?.password_hash))) {
      this.logger.warn(`Failed owner login username=${username}`);
      throw new UnauthorizedError(BAD_CREDENTIALS);
    }
    await this.assertStoreAllowed(owner!);
    const { token, expiresIn } = await this.tokens.issue(owner!.id, 'owner', {
      store_id: owner!.store_id,
      is_owner: owner!.is_owner,
    });
    this.logger.log(`Owner logged in id=${owner!.id} store=${owner!.store_id}`);
    return { token, expiresIn, account: owner! };
  }

  // --------------------------------------------------------------- per request
  /** Signature + expiry + claims + not logged out. */
  async verify(token: string): Promise<AccessClaims> {
    const claims = await this.tokens.verify(token);
    if (await this.revocation.isRevoked(claims)) {
      throw new UnauthorizedError('Token has been revoked, please log in again');
    }
    return claims;
  }

  /** Load the account behind verified claims (re-checked on every request: disabling takes effect at once). */
  async scopeFor(claims: AccessClaims): Promise<Scope> {
    if (claims.type === 'user') {
      const user = await this.users.findById(claims.sub);
      if (!user) throw new UnauthorizedError('Account no longer exists');
      if (!user.is_active) throw new ForbiddenError('This account is disabled');
      return new Scope(user, 'user');
    }
    const owner = await this.owners.findById(claims.sub);
    if (!owner) throw new UnauthorizedError('Account no longer exists');
    await this.assertStoreAllowed(owner);
    return new Scope(owner, 'owner');
  }

  private async assertStoreAllowed(owner: Owner): Promise<void> {
    if (this.stores.isBlocked(await this.stores.findById(owner.store_id))) {
      throw new ForbiddenError('This store is blocked');
    }
  }

  // --------------------------------------------------------------- logout
  async logout(claims: AccessClaims): Promise<void> {
    await this.revocation.revokeToken(claims);
    this.logger.log(`Logout ${claims.type} id=${claims.sub}`);
  }

  async logoutAll(claims: AccessClaims): Promise<void> {
    await this.revocation.revokeAll(claims.type, claims.sub);
    this.logger.log(`Logout all devices ${claims.type} id=${claims.sub}`);
  }
}

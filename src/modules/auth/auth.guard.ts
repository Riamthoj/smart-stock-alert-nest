import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { ADMIN_ONLY, AuthedRequest, IS_PUBLIC, TOKEN_TYPE } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { TokenType } from './scope.js';

/**
 * Global guard: SECURE BY DEFAULT. Every route needs a valid bearer token
 * unless it is marked @Public().
 *
 *   1. read "Authorization: Bearer <token>"
 *   2. verify signature / expiry / revocation
 *   3. load the account (disabled user / blocked store -> 403)
 *   4. attach { token, claims, scope } to the request
 *   5. @Auth('owner') / @AdminOnly() restrictions
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedError('Authentication required');

    const claims = await this.auth.verify(token);
    const expected = this.reflector.getAllAndOverride<TokenType>(TOKEN_TYPE, targets);
    if (expected && claims.type !== expected) {
      throw new UnauthorizedError(`This endpoint needs ${expected === 'owner' ? 'an' : 'a'} ${expected} token`);
    }
    const scope = await this.auth.scopeFor(claims);
    req.auth = { token, claims, scope };

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY, targets)) scope.requireAdmin();
    return true;
  }
}

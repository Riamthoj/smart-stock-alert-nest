import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.js';
import type { TokenType } from './scope.js';

/**
 * JWT access-token claims. Identical to the FastAPI version (same secret ->
 * a token from either API is accepted by the other):
 *   sub       account id
 *   type      "user" | "owner"   (a user token can't be used as an owner token)
 *   iat       issued-at, FLOAT seconds ("logout all devices" compares it)
 *   jti       unique token id     (logout revokes one jti)
 *   exp       expiry, int seconds
 *   store_id, is_owner            (owner tokens only, informational)
 */
export interface AccessClaims {
  sub: string;
  type: TokenType;
  iat: number;
  jti: string;
  exp: number;
  store_id?: string;
  is_owner?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async issue(
    subject: string,
    type: TokenType,
    extra: Pick<AccessClaims, 'store_id' | 'is_owner'> = {},
  ): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.jwt.expiresInSeconds;
    const now = Date.now() / 1000;
    const claims: AccessClaims = {
      sub: subject,
      type,
      iat: now,
      jti: randomUUID().replace(/-/g, ''),
      exp: Math.floor(now) + expiresIn,
      ...extra,
    };
    return { token: await this.jwt.signAsync(claims), expiresIn };
  }

  /** Verify signature + expiry + required claims. Throws 401 on anything wrong. */
  async verify(token: string): Promise<AccessClaims> {
    let claims: Partial<AccessClaims>;
    try {
      // algorithms is pinned: never let the token choose (the classic alg="none" attack).
      claims = await this.jwt.verifyAsync<AccessClaims>(token, { algorithms: ['HS256'] });
    } catch (err) {
      if ((err as Error).name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired, please log in again');
      }
      throw new UnauthorizedError('Invalid token');
    }
    const valid =
      typeof claims.sub === 'string' &&
      UUID_RE.test(claims.sub) &&
      (claims.type === 'user' || claims.type === 'owner') &&
      typeof claims.iat === 'number' &&
      typeof claims.exp === 'number' &&
      typeof claims.jti === 'string';
    if (!valid) throw new UnauthorizedError('Invalid token');
    return claims as AccessClaims;
  }
}

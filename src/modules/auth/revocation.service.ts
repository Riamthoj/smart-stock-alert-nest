import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import type { AccessClaims } from './token.service.js';
import type { TokenType } from './scope.js';

/**
 * Logout for stateless JWTs, with self-cleaning Redis keys (same keys as the FastAPI version):
 *
 *   ONE token     smartstock:auth:revoked:<jti> = 1                  (expires with the token)
 *   ALL tokens    smartstock:auth:valid-after:<type>:<id> = <unix>   (tokens issued before are rejected)
 *
 * Checking costs ONE round trip (MGET) per request. Redis down -> check
 * skipped (fail open, the shop keeps selling); logout -> 503 instead of lying.
 */
@Injectable()
export class RevocationService {
  private readonly logger = new Logger(RevocationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  private revokedKey(jti: string) {
    return this.redis.key('auth', 'revoked', jti);
  }

  private validAfterKey(type: TokenType, accountId: string) {
    return this.redis.key('auth', 'valid-after', type, accountId);
  }

  async isRevoked(claims: AccessClaims): Promise<boolean> {
    const [revoked, validAfter] = await this.redis.safe(
      (r) => r.mget(this.revokedKey(claims.jti), this.validAfterKey(claims.type, claims.sub)),
      [null, null] as (string | null)[],
    );
    if (revoked !== null) return true;
    return validAfter !== null && claims.iat < Number(validAfter);
  }

  /** Logout this one token. 503 if Redis is down. */
  async revokeToken(claims: AccessClaims): Promise<void> {
    await this.redis.strict((r) => r.set(this.revokedKey(claims.jti), '1', 'EXAT', Math.floor(claims.exp) + 1));
  }

  /**
   * Invalidate every token issued so far for this account.
   * required=false (password reset): if Redis is down, log and carry on.
   */
  async revokeAll(type: TokenType, accountId: string, { required = true } = {}): Promise<void> {
    const op = (r: import('ioredis').Redis) =>
      r.set(this.validAfterKey(type, accountId), String(Date.now() / 1000), 'EX', this.config.jwt.expiresInSeconds);
    if (required) {
      await this.redis.strict(op);
    } else if ((await this.redis.safe(op, null)) === null) {
      this.logger.warn(`Could not revoke tokens of ${type} ${accountId} (Redis down)`);
    }
  }
}

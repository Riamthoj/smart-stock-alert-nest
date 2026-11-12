import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { TooManyRequestsError } from '../../common/errors/app-error.js';
import { RedisService } from '../redis/redis.service.js';
import { Message, msg } from '../../common/i18n/message.js';

/**
 * SLIDING WINDOW in one atomic Lua script (no race between two requests,
 * and Redis' clock is the single source of time for all API instances).
 * KEYS[1] = sorted set; ARGV = window_ms, limit, unique member.
 * Returns {allowed 1/0, remaining, retry_after_ms}.
 */
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local window = tonumber(ARGV[1])
local limit  = tonumber(ARGV[2])
local t      = redis.call('TIME')
local now    = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, ARGV[3])
  redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
return {0, 0, tonumber(oldest[2]) + window - now}
`;

type ScriptedRedis = Redis & {
  slidingWindow(key: string, windowMs: number, limit: number, member: string): Promise<[number, number, number]>;
};

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number; // seconds
}

/** Behind a reverse proxy, enable Express "trust proxy" so this is the real client IP. */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  /** Count one request. null = not checked (disabled / Redis down: fail open). */
  async hit(name: string, identity: string, limit: number, windowSeconds = 60): Promise<RateResult | null> {
    if (!this.config.rateLimit.enabled) return null;
    const raw = await this.redis.safe(async (r) => {
      const client = r as ScriptedRedis;
      if (typeof client.slidingWindow !== 'function') {
        // EVALSHA with automatic EVAL fallback
        r.defineCommand('slidingWindow', { numberOfKeys: 1, lua: SLIDING_WINDOW_LUA });
      }
      return client.slidingWindow(this.redis.key('rl', name, identity), windowSeconds * 1000, limit, randomUUID());
    }, null);
    if (!raw) return null;
    const [allowed, remaining, retryMs] = raw.map(Number);
    return { allowed: allowed === 1, limit, remaining, retryAfter: allowed === 1 ? 0 : Math.ceil(retryMs / 1000) };
  }

  /** 429 when over the limit; otherwise add X-RateLimit-* headers. */
  enforce(result: RateResult | null, message: string, res?: Response): void {
    if (!result) return;
    const headers = { 'X-RateLimit-Limit': String(result.limit), 'X-RateLimit-Remaining': String(result.remaining) };
    if (!result.allowed) {
      throw new TooManyRequestsError(msg`${new Message(message)}. Try again in ${result.retryAfter} seconds`, {
        ...headers,
        'Retry-After': String(result.retryAfter),
      });
    }
    res?.set(headers);
  }

  /**
   * Brute-force protection for login. Call BEFORE checking the password.
   *   per IP + username (5/min): slows guessing ONE account's password
   *   per IP (20/min):           slows one machine trying MANY usernames
   */
  async login(req: Request, username: string): Promise<void> {
    const ip = clientIp(req);
    const user = createHash('sha256').update(username.trim().toLowerCase()).digest('hex').slice(0, 16);
    const { loginPerMinute, loginIpPerMinute } = this.config.rateLimit;
    this.enforce(await this.hit('login', `${ip}:${user}`, loginPerMinute), 'Too many login attempts');
    this.enforce(await this.hit('login-ip', ip, loginIpPerMinute), 'Too many login attempts');
  }
}

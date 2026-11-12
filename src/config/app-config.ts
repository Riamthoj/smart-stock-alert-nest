import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Env, validateEnv } from './env.schema.js';

/**
 * Typed, grouped access to the validated environment:
 *
 *     constructor(private readonly config: AppConfig) {}
 *     this.config.db.host / this.config.redis.enabled / this.config.jwt.secret
 *
 * No string keys, no `undefined` surprises: everything was checked by zod.
 */
@Injectable()
export class AppConfig {
  readonly env: Env;

  // ConfigService is injected so that ConfigModule has loaded .env into
  // process.env (and validated it) before we read it here.
  constructor(_configService: ConfigService) {
    this.env = validateEnv(process.env);
  }

  get app() {
    const e = this.env;
    return {
      name: e.APP_NAME,
      description: e.APP_DESCRIPTION,
      version: e.APP_VERSION,
      environment: e.ENVIRONMENT,
      isProduction: e.ENVIRONMENT === 'production',
      port: e.PORT,
      logLevel: e.LOG_LEVEL,
      timezone: e.TIMEZONE,
      apiPrefix: e.API_PREFIX.replace(/^\/+|\/+$/g, ''),
      corsOrigins: e.CORS_ORIGINS,
    };
  }

  get db() {
    const e = this.env;
    return {
      host: e.DB_HOST,
      port: e.DB_PORT,
      database: e.DB_NAME,
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      poolMax: e.DB_POOL_MAX,
      logQueries: e.DB_LOG_QUERIES,
    };
  }

  get upload() {
    return { dir: this.env.UPLOAD_DIR, maxBytes: this.env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, maxMb: this.env.MAX_UPLOAD_SIZE_MB };
  }

  get redis() {
    const e = this.env;
    return {
      url: e.REDIS_URL,
      enabled: e.REDIS_ENABLED,
      prefix: e.REDIS_PREFIX,
      timeoutMs: e.REDIS_TIMEOUT_MS,
      retryAfterSeconds: e.REDIS_RETRY_AFTER_SECONDS,
      cacheTtlSeconds: e.CACHE_TTL_SECONDS,
    };
  }

  get rateLimit() {
    const e = this.env;
    return {
      enabled: e.RATE_LIMIT_ENABLED,
      apiPerMinute: e.RATE_LIMIT_API_PER_MINUTE,
      loginPerMinute: e.RATE_LIMIT_LOGIN_PER_MINUTE,
      loginIpPerMinute: e.RATE_LIMIT_LOGIN_IP_PER_MINUTE,
    };
  }

  get i18n() {
    return { defaultLanguage: this.env.DEFAULT_LANGUAGE };
  }

  get alerting() {
    return { discordWebhookUrl: this.env.ALERT_DISCORD_WEBHOOK_URL || undefined, dedupeSeconds: this.env.ALERT_DEDUPE_SECONDS };
  }

  get activityLog() {
    return { enabled: this.env.ACTIVITY_LOG_ENABLED, retentionDays: this.env.ACTIVITY_LOG_RETENTION_DAYS };
  }

  get jwt() {
    return { secret: this.env.JWT_SECRET_KEY, expiresInSeconds: this.env.ACCESS_TOKEN_EXPIRE_MINUTES * 60 };
  }
}

@Global()
@Module({
  imports: [
    // Loads .env into process.env (real env vars win) and validates it.
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}

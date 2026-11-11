import { z } from 'zod';

/**
 * Every environment variable the app reads, validated ONCE at startup.
 * A wrong value (e.g. DB_PORT=abc) stops the app with a clear message
 * instead of failing later on the first request.
 */
const bool = (fallback: boolean) => z.stringbool().default(fallback);
const int = (fallback: number) => z.coerce.number().int().default(fallback);

export const DEV_JWT_SECRET = 'dev-only-change-me';

export const envSchema = z
  .object({
    APP_NAME: z.string().default('Smart Stock Alert API'),
    APP_DESCRIPTION: z.string().default('AI-powered Retail Intelligence Platform'),
    APP_VERSION: z.string().default('1.0.0'),
    ENVIRONMENT: z.enum(['local', 'staging', 'production']).default('local'),
    PORT: int(7001),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),
    TIMEZONE: z.string().default('Asia/Vientiane'),
    API_PREFIX: z.string().default('api/v1'),
    CORS_ORIGINS: z
      .string()
      .default('*')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

    DB_HOST: z.string().default('localhost'),
    DB_PORT: int(5432),
    DB_NAME: z.string().default('smart_stock_alert'),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default(''),
    DB_POOL_MAX: int(10),
    DB_LOG_QUERIES: bool(false),

    UPLOAD_DIR: z.string().default('uploads'),
    MAX_UPLOAD_SIZE_MB: int(5),

    REDIS_URL: z.string().default('redis://localhost:6379/0'),
    REDIS_ENABLED: bool(true),
    REDIS_PREFIX: z.string().default('smartstock:'),
    REDIS_TIMEOUT_MS: int(1000),
    REDIS_RETRY_AFTER_SECONDS: int(10),
    CACHE_TTL_SECONDS: int(120),

    RATE_LIMIT_ENABLED: bool(true),
    RATE_LIMIT_API_PER_MINUTE: int(300),
    RATE_LIMIT_LOGIN_PER_MINUTE: int(5),
    RATE_LIMIT_LOGIN_IP_PER_MINUTE: int(20),

    JWT_SECRET_KEY: z.string().min(1).default(DEV_JWT_SECRET),
    ACCESS_TOKEN_EXPIRE_MINUTES: int(60 * 24),
  })
  .superRefine((env, ctx) => {
    if (env.ENVIRONMENT === 'production' && env.JWT_SECRET_KEY === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET_KEY'],
        message: 'Set JWT_SECRET_KEY in the environment for production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

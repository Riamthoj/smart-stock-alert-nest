import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit (migrations):
 *   npm run db:generate   -> SQL migration from changes in src/database/schema
 *   npm run db:migrate    -> apply pending migrations
 *   npm run db:studio     -> browse the data
 *
 * A database already created by smart-stock-alert-api (Alembic) has the SAME
 * schema: don't run the baseline migration on it.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/tables.ts',
  out: './drizzle',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'smart_stock_alert',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    ssl: false,
  },
  strict: true,
  verbose: true,
});

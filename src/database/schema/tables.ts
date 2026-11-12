import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { deletedAt, id, money, timestamps } from './columns.js';
import {
  AlertStatus,
  AlertType,
  MoveType,
  PaymentMethod,
  PaymentStatus,
  StoreStatus,
} from './enums.js';

/*
 * Defaults are declared twice on purpose: `.default(x)` (DDL, for databases
 * created by our migrations) AND `.$default(() => x)` (sent by the app), so
 * inserts also work on a database created by the FastAPI/Alembic project,
 * whose columns have no server-side defaults.
 *
 * The whole data model. Property names = column names (snake_case), so a row
 * is already in the JSON shape the API returns and DTOs map 1:1 to inserts.
 *
 *   stores ─┬─< owners ─────────────< sales >──── customers
 *           ├─< customers                │
 *           ├─< categories ─< products ──┼─< sale_items
 *           ├─< products ─┬─ inventories └─< payments
 *           │             ├─< stock_moves
 *           │             └─< stock_alerts
 *   users (platform admins, no store)
 */

// ----------------------------------------------------------------- accounts
export const users = pgTable(
  'users',
  {
    id: id(),
    username: varchar('username', { length: 64 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 15 }),
    profile: varchar('profile', { length: 500 }),
    is_active: boolean('is_active').notNull().default(true).$default(() => true),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_users', columns: [t.id] }),
    uniqueIndex('ix_users_username').on(t.username),
    unique('uq_users_phone').on(t.phone),
  ],
);

export const stores = pgTable(
  'stores',
  {
    id: id(),
    name: varchar('name', { length: 255 }).notNull(),
    image: varchar('image', { length: 500 }),
    detail: text('detail'),
    status: varchar('status', { length: 16 }).$type<StoreStatus>().notNull().default('pending').$default(() => 'pending'),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_stores', columns: [t.id] }),
    index('ix_stores_name').on(t.name),
    index('ix_stores_status').on(t.status),
  ],
);

/** A login that belongs to ONE store: the owner (is_owner) or staff. */
export const owners = pgTable(
  'owners',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    username: varchar('username', { length: 64 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 15 }),
    profile: varchar('profile', { length: 500 }),
    is_owner: boolean('is_owner').notNull().default(false).$default(() => false),
    is_primary: boolean('is_primary').notNull().default(false).$default(() => false),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_owners', columns: [t.id] }),
    foreignKey({ name: 'fk_owners_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    index('ix_owners_store_id').on(t.store_id),
    uniqueIndex('ix_owners_username').on(t.username),
    unique('uq_owners_phone').on(t.phone),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    code: varchar('code', { length: 32 }).notNull(),
    full_name: varchar('full_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 15 }),
    profile: varchar('profile', { length: 500 }),
    is_active: boolean('is_active').notNull().default(true).$default(() => true),
    ...timestamps(),
    deleted_at: deletedAt(), // soft delete: sales keep pointing at the customer
  },
  (t) => [
    primaryKey({ name: 'pk_customers', columns: [t.id] }),
    foreignKey({ name: 'fk_customers_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    index('ix_customers_store_id').on(t.store_id),
    uniqueIndex('ix_customers_code').on(t.code),
    unique('uq_customers_store_id').on(t.store_id, t.phone),
  ],
);

// ----------------------------------------------------------------- catalog
export const categories = pgTable(
  'categories',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    image: varchar('image', { length: 500 }),
    detail: text('detail'),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_categories', columns: [t.id] }),
    foreignKey({ name: 'fk_categories_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    index('ix_categories_store_id').on(t.store_id),
    unique('uq_categories_store_id').on(t.store_id, t.name),
  ],
);

export const products = pgTable(
  'products',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    category_id: uuid('category_id'),
    name: varchar('name', { length: 255 }).notNull(),
    image: varchar('image', { length: 500 }),
    bar_code: varchar('bar_code', { length: 64 }),
    cost_price: money('cost_price').notNull(), // what the store paid
    price: money('price').notNull(), // selling price
    ...timestamps(),
    deleted_at: deletedAt(), // soft delete: sale history keeps its products
  },
  (t) => [
    primaryKey({ name: 'pk_products', columns: [t.id] }),
    foreignKey({ name: 'fk_products_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    foreignKey({
      name: 'fk_products_category_id_categories',
      columns: [t.category_id],
      foreignColumns: [categories.id],
    }).onDelete('set null'),
    index('ix_products_store_id').on(t.store_id),
    index('ix_products_category_id').on(t.category_id),
    index('ix_products_bar_code').on(t.bar_code),
    unique('uq_products_store_id').on(t.store_id, t.bar_code),
    check('ck_products_cost_price_non_negative', sql`${t.cost_price} >= 0`),
    check('ck_products_price_non_negative', sql`${t.price} >= 0`),
  ],
);

// ----------------------------------------------------------------- stock
/**
 * The ONLY place stock levels live. One row per (store, product).
 *   available_qty = qty - reserved_qty ; low stock when available_qty <= reorder_level
 */
export const inventories = pgTable(
  'inventories',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    product_id: uuid('product_id').notNull(),
    qty: integer('qty').notNull().default(0).$default(() => 0),
    reserved_qty: integer('reserved_qty').notNull().default(0).$default(() => 0),
    reorder_level: integer('reorder_level').notNull().default(10).$default(() => 10),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_inventories', columns: [t.id] }),
    foreignKey({ name: 'fk_inventories_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    foreignKey({
      name: 'fk_inventories_product_id_products',
      columns: [t.product_id],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
    index('ix_inventories_store_id').on(t.store_id),
    index('ix_inventories_product_id').on(t.product_id),
    unique('uq_inventories_store_id').on(t.store_id, t.product_id),
    check('ck_inventories_qty_non_negative', sql`${t.qty} >= 0`),
    check('ck_inventories_reserved_qty_non_negative', sql`${t.reserved_qty} >= 0`),
    check('ck_inventories_reserved_not_above_qty', sql`${t.reserved_qty} <= ${t.qty}`),
    check('ck_inventories_reorder_level_non_negative', sql`${t.reorder_level} >= 0`),
  ],
);

/** Append-only LEDGER of every stock change. SUM(qty) per product == inventories.qty. */
export const stockMoves = pgTable(
  'stock_moves',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    product_id: uuid('product_id').notNull(),
    qty: integer('qty').notNull(), // signed: +in, -out
    move_type: varchar('move_type', { length: 16 }).$type<MoveType>().notNull(),
    reference: varchar('reference', { length: 100 }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_stock_moves', columns: [t.id] }),
    foreignKey({ name: 'fk_stock_moves_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    foreignKey({
      name: 'fk_stock_moves_product_id_products',
      columns: [t.product_id],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
    index('ix_stock_moves_store_id').on(t.store_id),
    index('ix_stock_moves_product_id').on(t.product_id),
    index('ix_stock_moves_move_type').on(t.move_type),
    index('ix_stock_moves_reference').on(t.reference),
    check('ck_stock_moves_qty_not_zero', sql`${t.qty} <> 0`),
  ],
);

/** Opened automatically when stock gets low, resolved when restocked. */
export const stockAlerts = pgTable(
  'stock_alerts',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    product_id: uuid('product_id').notNull(),
    quantity_at_trigger: integer('quantity_at_trigger').notNull(),
    threshold_at_trigger: integer('threshold_at_trigger').notNull(),
    alert: varchar('alert', { length: 16 }).$type<AlertType>().notNull().default('low_stock').$default(() => 'low_stock'),
    status: varchar('status', { length: 16 }).$type<AlertStatus>().notNull().default('open').$default(() => 'open'),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_stock_alerts', columns: [t.id] }),
    foreignKey({ name: 'fk_stock_alerts_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    foreignKey({
      name: 'fk_stock_alerts_product_id_products',
      columns: [t.product_id],
      foreignColumns: [products.id],
    }).onDelete('cascade'),
    index('ix_stock_alerts_store_id').on(t.store_id),
    index('ix_stock_alerts_product_id').on(t.product_id),
    index('ix_stock_alerts_alert').on(t.alert),
    index('ix_stock_alerts_status').on(t.status),
  ],
);

// ----------------------------------------------------------------- sales
/**
 * A receipt. Never edited: prices and costs are SNAPSHOTS of the moment of sale.
 *   subtotal = SUM(qty * unit_price) ; total = subtotal - discount + tax
 */
export const sales = pgTable(
  'sales',
  {
    id: id(),
    store_id: uuid('store_id').notNull(),
    owner_id: uuid('owner_id').notNull(),
    customer_id: uuid('customer_id'),
    receipt_number: varchar('receipt_number', { length: 32 }).notNull(),
    subtotal: money('subtotal').notNull(),
    discount: money('discount').notNull().default('0').$default(() => '0'),
    tax: money('tax').notNull().default('0').$default(() => '0'),
    total: money('total').notNull(),
    sold_at: timestamp('sold_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_sales', columns: [t.id] }),
    foreignKey({ name: 'fk_sales_store_id_stores', columns: [t.store_id], foreignColumns: [stores.id] }).onDelete(
      'cascade',
    ),
    foreignKey({ name: 'fk_sales_owner_id_owners', columns: [t.owner_id], foreignColumns: [owners.id] }),
    foreignKey({
      name: 'fk_sales_customer_id_customers',
      columns: [t.customer_id],
      foreignColumns: [customers.id],
    }).onDelete('set null'),
    index('ix_sales_store_id').on(t.store_id),
    index('ix_sales_owner_id').on(t.owner_id),
    index('ix_sales_customer_id').on(t.customer_id),
    index('ix_sales_receipt_number').on(t.receipt_number),
    index('ix_sales_sold_at').on(t.sold_at),
    unique('uq_sales_store_id').on(t.store_id, t.receipt_number),
    check('ck_sales_discount_non_negative', sql`${t.discount} >= 0`),
    check('ck_sales_tax_non_negative', sql`${t.tax} >= 0`),
    check('ck_sales_total_non_negative', sql`${t.total} >= 0`),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: id(),
    sale_id: uuid('sale_id').notNull(),
    product_id: uuid('product_id').notNull(),
    qty: integer('qty').notNull(),
    unit_price: money('unit_price').notNull(), // selling price at the time
    cost_price: money('cost_price').notNull(), // cost at the time (profit reports)
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_sale_items', columns: [t.id] }),
    foreignKey({ name: 'fk_sale_items_sale_id_sales', columns: [t.sale_id], foreignColumns: [sales.id] }).onDelete(
      'cascade',
    ),
    foreignKey({ name: 'fk_sale_items_product_id_products', columns: [t.product_id], foreignColumns: [products.id] }),
    index('ix_sale_items_sale_id').on(t.sale_id),
    index('ix_sale_items_product_id').on(t.product_id),
    check('ck_sale_items_qty_positive', sql`${t.qty} > 0`),
    check('ck_sale_items_unit_price_non_negative', sql`${t.unit_price} >= 0`),
    check('ck_sale_items_cost_price_non_negative', sql`${t.cost_price} >= 0`),
  ],
);

/** A sale can be paid in several parts (cash + QR...). */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    sale_id: uuid('sale_id').notNull(),
    payment_method: varchar('payment_method', { length: 16 }).$type<PaymentMethod>().notNull(),
    amount: money('amount').notNull(),
    status: varchar('status', { length: 16 }).$type<PaymentStatus>().notNull().default('paid').$default(() => 'paid'),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_payments', columns: [t.id] }),
    foreignKey({ name: 'fk_payments_sale_id_sales', columns: [t.sale_id], foreignColumns: [sales.id] }).onDelete(
      'cascade',
    ),
    index('ix_payments_sale_id').on(t.sale_id),
    index('ix_payments_payment_method').on(t.payment_method),
    index('ix_payments_status').on(t.status),
    check('ck_payments_amount_positive', sql`${t.amount} > 0`),
  ],
);

// ----------------------------------------------------------------- audit
/**
 * WHO changed WHAT, WHEN: one row per write request (POST/PUT/PATCH/DELETE)
 * made with a token, written by ActivityLogInterceptor.
 * No foreign keys on purpose: the trail must survive deleting the account or store.
 */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: id(),
    account_type: varchar('account_type', { length: 8 }).notNull(), // "user" | "owner"
    account_id: uuid('account_id').notNull(),
    store_id: uuid('store_id'), // the owner's store (null for platform admins)
    method: varchar('method', { length: 8 }).notNull(),
    route: varchar('route', { length: 200 }).notNull(), // pattern: /api/v1/products/:product_id
    path: varchar('path', { length: 500 }).notNull(), // actual: /api/v1/products/0190...
    status_code: integer('status_code').notNull(),
    request_id: varchar('request_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    user_agent: varchar('user_agent', { length: 300 }),
    body: jsonb('body'), // request body, secrets redacted, size-capped
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'pk_activity_logs', columns: [t.id] }),
    index('ix_activity_logs_store_id_created_at').on(t.store_id, t.created_at),
    index('ix_activity_logs_account_id_created_at').on(t.account_id, t.created_at),
    index('ix_activity_logs_created_at').on(t.created_at),
  ],
);

// ----------------------------------------------------------------- row types
export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Owner = typeof owners.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventories.$inferSelect;
export type StockMove = typeof stockMoves.$inferSelect;
export type StockAlert = typeof stockAlerts.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;

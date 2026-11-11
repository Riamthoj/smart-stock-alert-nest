import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { StoresService } from '../src/modules/stores/stores.service.js';
import { UsersRepository } from '../src/database/repositories/accounts.repository.js';
import { PasswordService } from '../src/modules/auth/password.service.js';

/**
 * End-to-end: the real app (guards, pipes, filters, transactions) on a real
 * PostgreSQL database. Opt-in, because it writes data:
 *
 *   E2E_DB_NAME=smart_stock_alert_test npm test
 *
 * The database must already have the schema (npm run db:migrate).
 * Redis is optional: without it the API runs degraded, as in production.
 */
const DB = process.env.E2E_DB_NAME;

describe.skipIf(!DB)('Smart Stock Alert API (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<typeof request>;
  const uniq = Date.now().toString(36);
  let admin: string;
  let owner: string;

  beforeAll(async () => {
    process.env.DB_NAME = DB;
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.LOG_LEVEL = 'warn';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    // an admin to log in with
    const users = app.get(UsersRepository);
    await users.insert({
      username: `e2e_${uniq}`,
      password_hash: await app.get(PasswordService).hash('password123'),
    });
    admin = (await http.post('/api/v1/auth/users/login').send({ username: `e2e_${uniq}`, password: 'password123' }))
      .body.data.access_token;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects requests without a token, in the standard error envelope', async () => {
    const res = await http.get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'Authentication required',
      code: 401,
      error: 'unauthorized',
    });
  });

  it('creates a store with its primary owner, who can log in', async () => {
    const res = await http
      .post('/api/v1/stores')
      .auth(admin, { type: 'bearer' })
      .send({ name: `E2E ${uniq}`, owner: { username: `e2e_owner_${uniq}`, password: 'password123' } });
    expect(res.status).toBe(201);
    expect(res.body.data.owner.is_primary).toBe(true);

    const login = await http
      .post('/api/v1/auth/owners/login')
      .send({ username: `e2e_owner_${uniq}`, password: 'password123' });
    expect(login.status).toBe(200);
    owner = login.body.data.access_token;
  });

  it('sale -> stock out -> low-stock alert opens; restock -> it resolves', async () => {
    const product = (
      await http.post('/api/v1/products').auth(owner, { type: 'bearer' }).send({ name: 'Water', cost_price: 1000, price: 2000 })
    ).body.data;
    await http
      .post('/api/v1/inventories')
      .auth(owner, { type: 'bearer' })
      .send({ product_id: product.id, qty: 12, reorder_level: 10 })
      .expect(201);

    const sale = await http
      .post('/api/v1/sales')
      .auth(owner, { type: 'bearer' })
      .send({ items: [{ product_id: product.id, qty: 5 }] });
    expect(sale.status).toBe(201);
    expect(sale.body.data.total).toBe(10000);

    const open = await http
      .get(`/api/v1/stock-alerts?product_id=${product.id}&status=open`)
      .auth(owner, { type: 'bearer' });
    expect(open.body.data.count).toBe(1);
    expect(open.body.data.rows[0].quantity_at_trigger).toBe(7);

    await http
      .post('/api/v1/stock-moves')
      .auth(owner, { type: 'bearer' })
      .send({ product_id: product.id, move_type: 'in', qty: 20, reference: 'PO-1' })
      .expect(201);
    const resolved = await http.get(`/api/v1/stock-alerts?product_id=${product.id}`).auth(owner, { type: 'bearer' });
    expect(resolved.body.data.rows[0].status).toBe('resolved');
  });

  it('never oversells: a failing sale leaves no trace', async () => {
    const product = (
      await http.post('/api/v1/products').auth(owner, { type: 'bearer' }).send({ name: 'Rare', cost_price: 1, price: 2 })
    ).body.data;
    await http.post('/api/v1/inventories').auth(owner, { type: 'bearer' }).send({ product_id: product.id, qty: 1 });
    const res = await http
      .post('/api/v1/sales')
      .auth(owner, { type: 'bearer' })
      .send({ items: [{ product_id: product.id, qty: 2 }] });
    expect(res.status).toBe(422);
    const sales = await http.get(`/api/v1/sales?q=all`).auth(owner, { type: 'bearer' });
    expect(sales.body.data.every((s: { items: { product_id: string }[] }) => s.items.every((i) => i.product_id !== product.id))).toBe(true);
  });

  it('cleans up', async () => {
    const stores = await http.get(`/api/v1/stores?search=E2E ${uniq}`).auth(admin, { type: 'bearer' });
    for (const store of stores.body.data.rows) {
      await http.delete(`/api/v1/stores/${store.id}`).auth(admin, { type: 'bearer' }).expect(204);
    }
    expect(app.get(StoresService)).toBeDefined();
  });
});

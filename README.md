# Smart Stock Alert API (NestJS)

Multi-store retail backend: catalog, inventory ledger, **automatic low-stock alerts**, point of sale and split payments.

This is a NestJS 12 port of [`smart-stock-alert-api`](../smart-stock-alert-api) (FastAPI). It keeps the **same database schema, the same JSON contract, the same JWT tokens and the same Redis keys**. Both APIs can run side by side on one database, and the existing `bo` / `owner` frontends can switch with no code changes.

| | |
|---|---|
| Runtime | Node.js ≥ 22.12, native ESM, TypeScript 6 (strict) |
| Framework | NestJS 12 (Express) |
| Database | PostgreSQL + Drizzle ORM (typed SQL, row locks, advisory locks) |
| Cache / limits / logout | Redis via ioredis, with a circuit breaker (optional) |
| Validation | class-validator DTOs, env validated with zod |
| Auth | JWT (HS256) + Argon2id |
| Docs | Swagger at `/docs` (generated from DTO types and JSDoc) |
| Logs | pino (pretty in dev, JSON in production) with request IDs |
| Tests | Vitest (unit + e2e against a real database) |

## Quick start

```bash
npm install
cp .env.example .env              # set DB_* and JWT_SECRET_KEY
npm run db:migrate                # fresh database only (see "Sharing the database")
npm run build
npm run cli -- create-user admin  # first admin (password asked interactively)
npm run start:dev                 # http://localhost:7001/api/v1  - docs: /docs
```

Docker: `docker compose up -d --build`, then `docker compose run --rm migrate`, then `docker compose exec api node dist/cli.js create-user admin`.

## Project structure

```
src/
├── main.ts / app.setup.ts     bootstrap: prefix, CORS, static /uploads, Swagger
├── app.module.ts              wiring + global pipe / interceptor / filter / guards
├── cli.ts                     create-user, reset-password
├── config/                    zod-validated env -> typed AppConfig (config.db.host ...)
├── common/                    framework-level building blocks
│   ├── errors/                domain errors (NotFound, Conflict, BusinessRule ...)
│   ├── filters/               ONE error format for everything (incl. PG constraint races -> 409)
│   ├── interceptors/          success envelope {success, message, code, data}
│   ├── pipes/                 validation -> 422 {details: [{loc, msg, type}]}
│   ├── pagination/            ?page&limit&search&q=all, page envelope
│   ├── validation/            @IdParam, @IsMoney, @QueryBool ...
│   └── utils/                 money (integer cents), uuidv7, daily codes, LIKE escaping
├── database/                  persistence layer (global)
│   ├── schema/                Drizzle tables = the existing Alembic schema, 1:1
│   ├── repositories/          one per table, on a generic BaseRepository
│   └── database.service.ts    pool + AMBIENT transactions (AsyncLocalStorage)
├── infrastructure/            Redis (circuit breaker), list cache, rate limit, storage
└── modules/<feature>/         controller + service + dto + presenter
    auth · users · stores · owners · customers · categories · products
    inventories · stock-moves · alerts · sales · payments · health
```

Dependencies point one way: **controller → service → repository → schema**. Features never import each other's internals. Shared data access lives in the global `DatabaseModule`, so there are no circular modules.

## Design highlights

- **Secure by default.** A global `AuthGuard` protects every route; `@Public()`, `@Auth('owner')` and `@AdminOnly()` opt routes in or out.
- **Multi-tenant scope.** `Scope` makes an owner see only their own store. Another store's record returns **404**, not 403, so ids aren't confirmed. Staff (`is_owner=false`) may only edit themselves.
- **Ambient transactions.** `database.transaction(async () => ...)` covers every repository call inside it. There's no `tx` argument to thread through, and nested calls join the outer transaction.
- **Stock you can trust.**
  - Every change goes through one path: row lock (`FOR UPDATE`) → qty update → append to the `stock_moves` ledger → re-evaluate the alert, all in one transaction. `SUM(moves) == qty` always holds.
  - Sales lock products in id order, so concurrent sales can't deadlock.
  - Tested: 20 parallel sales against 5 units → exactly 5 succeed.
- **Self-managing alerts.** An alert opens when available ≤ reorder level, escalates `low_stock → out_of_stock`, and auto-resolves on restock. There is at most one open alert per product.
- **Exact money.** NUMERIC(14,2) is read as strings and calculated in integer cents (no float drift). The API returns JSON numbers, as before.
- **Race-proof codes.** `CUS…` and `RC…` daily counters are generated under a Postgres advisory lock, using the same key as the Python API.
- **Redis is optional.** With Redis down, cache misses go to the DB and rate limits are skipped. Logout returns 503 rather than pretending to succeed. `/health/ready` reports `degraded`.
- **Safe uploads.** File type is detected from magic bytes, names are UUIDv7, there's a size cap, and the old file is deleted only after the DB commit succeeds.

## Sharing the database with the FastAPI version

- Point `DB_*` at the same database and **don't run `db:migrate`**: Alembic already created the identical schema. The tables, constraint names and indexes match exactly, and the Nest API was tested against an Alembic-created copy.
- Use the same `JWT_SECRET_KEY` and Redis: tokens, logouts and cache invalidation then work across both APIs.
- Set `UPLOAD_DIR=../smart-stock-alert-api/uploads` so both APIs serve the same images.

## Small differences from the FastAPI version (all additive)

- `POST /sales`: `owner_id` is optional with an owner login (defaults to the logged-in seller).
- `GET /payments` also accepts `?store_id=` for admins.
- `POST /users` also rejects a duplicate phone with 409 (it was a 500).
- Unique-constraint races that slip past the checks return 409 instead of 500.

## Scripts

| | |
|---|---|
| `npm run start:dev` | watch mode |
| `npm run build` / `start:prod` | compile to `dist/` / run it |
| `npm test` | unit tests (+ e2e when `E2E_DB_NAME` is set) |
| `E2E_DB_NAME=<db> npm run test:e2e` | e2e on a real database (writes data, then cleans up) |
| `npm run typecheck` | `tsc` over app and tests |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |
| `npm run cli -- create-user <name>` / `reset-password <name>` | admin accounts (`CLI_PASSWORD` env for automation) |

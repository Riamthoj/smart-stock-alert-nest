import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { OwnersRepository, StoresRepository, UsersRepository } from './repositories/accounts.repository.js';
import { CategoriesRepository, CustomersRepository, ProductsRepository } from './repositories/catalog.repository.js';
import {
  PaymentsRepository,
  SaleItemsRepository,
  SalesRepository,
} from './repositories/sales.repository.js';
import { AlertsRepository, InventoriesRepository, StockMovesRepository } from './repositories/stock.repository.js';

const repositories = [
  UsersRepository,
  StoresRepository,
  OwnersRepository,
  CustomersRepository,
  CategoriesRepository,
  ProductsRepository,
  InventoriesRepository,
  StockMovesRepository,
  AlertsRepository,
  SalesRepository,
  SaleItemsRepository,
  PaymentsRepository,
];

/**
 * The persistence layer, available everywhere: the connection pool,
 * the ambient-transaction host and every repository.
 *
 * Feature modules depend on repositories (data access), never on each
 * other's internals, so there are no circular module imports.
 */
@Global()
@Module({
  providers: [DatabaseService, ...repositories],
  exports: [DatabaseService, ...repositories],
})
export class DatabaseModule {}

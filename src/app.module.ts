import { randomUUID } from 'node:crypto';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ApiExcludeController } from '@nestjs/swagger';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { RawResponse } from './common/decorators/response.decorators.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { AppValidationPipe } from './common/pipes/validation.pipe.js';
import { AppConfig, AppConfigModule } from './config/app-config.js';
import { DatabaseModule } from './database/database.module.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { Public } from './modules/auth/auth.decorators.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { InventoriesModule } from './modules/inventories/inventories.module.js';
import { OwnersModule } from './modules/owners/owners.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { StockMovesModule } from './modules/stock-moves/stock-moves.module.js';
import { StoresModule } from './modules/stores/stores.module.js';
import { UsersModule } from './modules/users/users.module.js';

/** GET / (outside /api/v1): is the server alive? */
@ApiExcludeController()
@Public()
@RawResponse()
@Controller()
class RootController {
  constructor(private readonly config: AppConfig) {}

  @Get()
  root() {
    return { success: true, message: `Welcome to ${this.config.app.name}` };
  }
}

@Module({
  imports: [
    // ---- foundation (global)
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.app.logLevel,
          // Reuse the client's / proxy's request id, else generate one; echoed back as X-Request-ID.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID().replace(/-/g, '');
            res.setHeader('X-Request-ID', id);
            return id;
          },
          customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
          // Never log secrets.
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
          transport: config.app.isProduction
            ? undefined // JSON lines in production (for log collectors)
            : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' } },
        },
      }),
    }),
    DatabaseModule,
    InfrastructureModule,
    AuthModule,

    // ---- features
    UsersModule,
    StoresModule,
    OwnersModule,
    CustomersModule,
    CategoriesModule,
    ProductsModule,
    InventoriesModule,
    StockMovesModule,
    AlertsModule,
    SalesModule,
    PaymentsModule,
    ActivityLogsModule,
  ],
  controllers: [RootController, HealthController],
  providers: [
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

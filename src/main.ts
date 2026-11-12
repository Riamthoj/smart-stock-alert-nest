import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger } from './app.setup.js';
import { AppConfig } from './config/app-config.js';
import { AlertingService } from './infrastructure/alerting/alerting.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const { app: cfg } = app.get(AppConfig);
  const logger = app.get(Logger);

  app.useLogger(logger);
  configureApp(app);

  // Crashes outside a request (a forgotten await, a timer...) are alerted too.
  const alerting = app.get(AlertingService);
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${String(reason)}`, 'Process');
    alerting.reportError(reason, { path: 'unhandledRejection' });
  });
  if (!cfg.isProduction) setupSwagger(app);

  await app.listen(cfg.port);
  logger.log(
    `${cfg.name} v${cfg.version} [${cfg.environment}] on http://localhost:${cfg.port}/${cfg.apiPrefix}` +
      (cfg.isProduction ? '' : `  (docs: http://localhost:${cfg.port}/docs)`),
    'Bootstrap',
  );
}

void bootstrap();

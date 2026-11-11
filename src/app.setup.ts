import { RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from './config/app-config.js';
import { StorageService, UPLOAD_URL_PREFIX } from './infrastructure/storage/storage.service.js';

/**
 * HTTP-level setup shared by main.ts and the e2e tests, so tests run the
 * app exactly as production does (prefix, CORS, static files...).
 */
export function configureApp(app: NestExpressApplication): void {
  const { app: cfg } = app.get(AppConfig);

  app.enableShutdownHooks(); // SIGTERM -> close DB pool + Redis cleanly
  app.disable('x-powered-by');
  // Behind a reverse proxy (nginx, load balancer) set this to the number of
  // proxy hops so req.ip (rate limits) is the real client IP.
  app.set('trust proxy', false);

  app.enableCors({
    origin: cfg.corsOrigins.includes('*') ? true : cfg.corsOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-ID', 'X-Process-Time-Ms', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  });

  // X-Process-Time-Ms on every response (visible in browser DevTools > Network).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    const writeHead = res.writeHead;
    res.writeHead = function (this: Response, ...args: Parameters<typeof writeHead>) {
      this.setHeader('X-Process-Time-Ms', (performance.now() - start).toFixed(2));
      return writeHead.apply(this, args);
    } as typeof writeHead;
    next();
  });

  // Every route under /api/v1 except the root welcome route.
  app.setGlobalPrefix(cfg.apiPrefix, { exclude: [{ path: '/', method: RequestMethod.GET }] });

  // Uploaded images as plain files: GET /uploads/products/<uuid>.png (no token, so <img src> works).
  app.useStaticAssets(app.get(StorageService).root, { prefix: UPLOAD_URL_PREFIX, index: false, fallthrough: false });
}

/** Interactive API docs at /docs (+ /docs-json). Not mounted in production. */
export function setupSwagger(app: NestExpressApplication): void {
  const { app: cfg } = app.get(AppConfig);
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(cfg.name)
      .setDescription(
        `${cfg.description}\n\nLog in with **POST /auth/users/login** (admin) or **/auth/owners/login** ` +
          '(store), then click **Authorize** and paste the `access_token`.',
      )
      .setVersion(cfg.version)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha' },
  });
}

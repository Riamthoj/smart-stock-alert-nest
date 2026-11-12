import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.js';
import { ActivityLogsRepository } from '../../database/repositories/activity-logs.repository.js';
import { clientIp } from '../../infrastructure/rate-limit/rate-limit.service.js';
import type { AuthedRequest } from '../auth/auth.decorators.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECRET_KEY = /pass(word)?|token|secret|authorization/i;
const MAX_BODY_CHARS = 4_000;

/** Copy of the body with secrets masked; null when there's nothing worth keeping. */
export function redactBody(body: unknown, depth = 0): unknown {
  if (body === null || body === undefined || depth > 5) return null;
  if (Array.isArray(body)) return body.slice(0, 50).map((v) => redactBody(v, depth + 1));
  if (typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '***' : redactBody(v, depth + 1),
    ]),
  );
}

function capBody(body: unknown): unknown {
  const redacted = redactBody(body);
  if (redacted === null || (typeof redacted === 'object' && Object.keys(redacted as object).length === 0)) {
    return null;
  }
  const json = JSON.stringify(redacted);
  return json.length <= MAX_BODY_CHARS ? redacted : { _truncated: true, preview: json.slice(0, MAX_BODY_CHARS) };
}

/**
 * AUDIT TRAIL: every write (POST/PUT/PATCH/DELETE) made with a token is
 * recorded in activity_logs: who, which store, which route, the outcome
 * (status code, failures included: a 403 is worth knowing about) and the
 * request body with secrets masked.
 *
 * Writing the log never slows down or breaks the request: it happens after
 * the response is decided, outside the request's transaction, and a failure
 * to log is only logged.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(
    private readonly logs: ActivityLogsRepository,
    private readonly config: AppConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest & { id?: string }>();
    if (!this.config.activityLog.enabled || !WRITE_METHODS.has(req.method)) return next.handle();

    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap({
        next: () => this.record(req, res.statusCode),
        error: (err: unknown) =>
          this.record(req, err instanceof AppError ? err.status : err instanceof HttpException ? err.getStatus() : 500),
      }),
    );
  }

  private record(req: AuthedRequest & { id?: string }, statusCode: number): void {
    const auth = req.auth;
    if (!auth) return; // anonymous (login, health): not an account action

    const file = (req as { file?: Express.Multer.File }).file;
    const body = file ? { ...(req.body ?? {}), file: { name: file.originalname, size: file.size } } : req.body;
    const route = `${req.baseUrl ?? ''}${(req.route as { path?: string } | undefined)?.path ?? req.path}`;

    void this.logs
      .insert({
        account_type: auth.scope.type,
        account_id: auth.scope.account.id,
        store_id: auth.scope.storeId ?? null,
        method: req.method,
        route: route.slice(0, 200),
        path: req.originalUrl.slice(0, 500),
        status_code: statusCode,
        request_id: req.id ? String(req.id).slice(0, 64) : null,
        ip: clientIp(req).slice(0, 64),
        user_agent: req.headers['user-agent']?.slice(0, 300) ?? null,
        body: capBody(body),
      })
      .catch((err: Error) => this.logger.warn(`Could not write activity log: ${err.message}`));
  }
}

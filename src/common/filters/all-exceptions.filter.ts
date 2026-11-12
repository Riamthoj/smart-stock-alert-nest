import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { AlertingService } from '../../infrastructure/alerting/alerting.service.js';
import type { AuthedRequest } from '../../modules/auth/auth.decorators.js';
import { AppError, RequestValidationError } from '../errors/app-error.js';
import { requestLanguage, translate } from '../i18n/i18n.js';
import type { Message } from '../i18n/message.js';

const HTTP_ERROR_CODES: Record<number, string> = {
  400: 'bad_request',
  404: 'not_found',
  405: 'method_not_allowed',
  413: 'file_too_large',
  415: 'unsupported_file_type',
};

/** Postgres SQLSTATE -> a clean 409 instead of a 500 (races that slipped past the service checks). */
const PG_CONFLICTS: Record<string, string> = {
  '23505': 'This record already exists',
  '23503': 'This record is still referenced by other data',
};

interface Described {
  status: number;
  error: string;
  message: Message | string;
  details?: unknown;
  headers?: Record<string, string>;
  unexpected?: boolean;
}

/**
 * ONE place that defines how every error looks. Same envelope as a success
 * response, so clients can always read `code`:
 *
 *   { success: false, message, code: <http status>, error: <reason>, details? }
 *
 *   * `message` is translated to the request's language (?lang= / Accept-Language)
 *   * `error` is a stable machine-readable code: clients should branch on it, never on `message`
 *   * unexpected errors (bugs) -> generic 500 + full log + Discord alert
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(
    private readonly config: AppConfig,
    private readonly alerting: AlertingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & Partial<AuthedRequest> & { id?: string }>();
    const res = http.getResponse<Response>();
    const described = this.describe(exception);

    if (described.unexpected) {
      this.logger.error(
        `Unhandled error on ${req.method} ${req.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      const scope = req.auth?.scope;
      this.alerting.reportError(exception, {
        method: req.method,
        path: req.originalUrl,
        requestId: req.id ? String(req.id) : undefined,
        account: scope ? `${scope.type}:${scope.account.id}` : undefined,
        storeId: scope?.storeId,
      });
    }

    const lang = requestLanguage(req, this.config.i18n.defaultLanguage);
    const body: Record<string, unknown> = {
      success: false,
      message: translate(described.message, lang),
      code: described.status,
      error: described.error,
    };
    if (described.details !== undefined) body.details = described.details;

    if (described.headers) res.set(described.headers);
    res.set('Content-Language', lang);
    res.status(described.status).json(body);
  }

  private describe(exception: unknown): Described {
    if (exception instanceof RequestValidationError) {
      return { status: exception.status, error: exception.code, message: exception.i18n, details: exception.details };
    }
    if (exception instanceof AppError) {
      return { status: exception.status, error: exception.code, message: exception.i18n, headers: exception.headers };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const raw = typeof response === 'string' ? response : (response as { message?: unknown }).message;
      let message = Array.isArray(raw) ? raw.join(', ') : String(raw ?? exception.message);
      if (status === 404 && message.startsWith('Cannot ')) message = 'Route not found'; // "Cannot GET /x"
      return { status, error: HTTP_ERROR_CODES[status] ?? 'http_error', message, unexpected: status >= 500 };
    }
    const pgCode =
      (exception as { cause?: { code?: unknown } })?.cause?.code ?? (exception as { code?: unknown })?.code;
    if (typeof pgCode === 'string' && PG_CONFLICTS[pgCode]) {
      this.logger.warn(`Database constraint ${pgCode}: ${(exception as Error).message}`);
      return { status: HttpStatus.CONFLICT, error: 'conflict', message: PG_CONFLICTS[pgCode] };
    }
    // A bug: details stay on the server, the client gets a generic message.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'internal_error',
      message: 'Internal server error',
      unexpected: true,
    };
  }
}

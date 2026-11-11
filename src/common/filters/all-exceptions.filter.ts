import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AppError, RequestValidationError } from '../errors/app-error.js';

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

/**
 * ONE place that defines how every error looks. Same envelope as a success
 * response, so clients can always read `code`:
 *
 *   { success: false, message, code: <http status>, error: <reason>, details? }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, error, message, details, headers } = this.describe(exception);

    if (headers) res.set(headers);
    const body: Record<string, unknown> = { success: false, message, code: status, error };
    if (details !== undefined) body.details = details;
    res.status(status).json(body);
  }

  private describe(exception: unknown): {
    status: number;
    error: string;
    message: string;
    details?: unknown;
    headers?: Record<string, string>;
  } {
    if (exception instanceof RequestValidationError) {
      return { status: exception.status, error: exception.code, message: exception.message, details: exception.details };
    }
    if (exception instanceof AppError) {
      return { status: exception.status, error: exception.code, message: exception.message, headers: exception.headers };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const raw = typeof response === 'string' ? response : (response as { message?: unknown }).message;
      const message = Array.isArray(raw) ? raw.join(', ') : String(raw ?? exception.message);
      return { status, error: HTTP_ERROR_CODES[status] ?? 'http_error', message };
    }
    const pgCode = (exception as { code?: unknown; cause?: { code?: unknown } })?.cause?.code
      ?? (exception as { code?: unknown })?.code;
    if (typeof pgCode === 'string' && PG_CONFLICTS[pgCode]) {
      this.logger.warn(`Database constraint ${pgCode}: ${(exception as Error).message}`);
      return { status: HttpStatus.CONFLICT, error: 'conflict', message: PG_CONFLICTS[pgCode] };
    }
    // A bug: full trace in the server log, a generic message for the client.
    this.logger.error('Unhandled error', exception instanceof Error ? exception.stack : String(exception));
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, error: 'internal_error', message: 'Internal server error' };
  }
}

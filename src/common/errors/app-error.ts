import { HttpStatus } from '@nestjs/common';

/**
 * Domain errors. Services throw these and know nothing about HTTP;
 * the global AllExceptionsFilter turns them into the standard JSON body:
 *
 *   { "success": false, "message": "...", "code": 404, "error": "not_found" }
 *
 * Adding a new error type = a 3-line subclass, no filter changes.
 */
export class AppError extends Error {
  readonly status: number = HttpStatus.INTERNAL_SERVER_ERROR;
  readonly code: string = 'internal_error';

  constructor(
    message = 'Something went wrong',
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 404: the requested thing does not exist (or belongs to another store). */
export class NotFoundError extends AppError {
  override readonly status = HttpStatus.NOT_FOUND;
  override readonly code = 'not_found';
}

/** 409: clashes with existing data (duplicate barcode, username...). */
export class ConflictError extends AppError {
  override readonly status = HttpStatus.CONFLICT;
  override readonly code = 'conflict';
}

/** 401: not logged in / bad credentials / invalid or expired token. */
export class UnauthorizedError extends AppError {
  override readonly status = HttpStatus.UNAUTHORIZED;
  override readonly code = 'unauthorized';
}

/** 403: logged in, but not allowed. */
export class ForbiddenError extends AppError {
  override readonly status = HttpStatus.FORBIDDEN;
  override readonly code = 'forbidden';
}

/** 422: well-formed request that breaks a business rule. */
export class BusinessRuleError extends AppError {
  override readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  override readonly code = 'business_rule_violation';
}

/** 429: rate limit hit. Carries Retry-After. */
export class TooManyRequestsError extends AppError {
  override readonly status = HttpStatus.TOO_MANY_REQUESTS;
  override readonly code = 'too_many_requests';
}

/** 503: a dependency (Redis) is down and the action can't be done safely. */
export class ServiceUnavailableError extends AppError {
  override readonly status = HttpStatus.SERVICE_UNAVAILABLE;
  override readonly code = 'service_unavailable';
}

/** 413: upload larger than MAX_UPLOAD_SIZE_MB. */
export class FileTooLargeError extends AppError {
  override readonly status = HttpStatus.PAYLOAD_TOO_LARGE;
  override readonly code = 'file_too_large';
}

/** 415: not a JPEG / PNG / WEBP / GIF. */
export class UnsupportedFileError extends AppError {
  override readonly status = HttpStatus.UNSUPPORTED_MEDIA_TYPE;
  override readonly code = 'unsupported_file_type';
}

export interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/** 422 for request bodies / query strings that fail validation. */
export class RequestValidationError extends AppError {
  override readonly status = HttpStatus.UNPROCESSABLE_ENTITY;
  override readonly code = 'validation_error';

  constructor(public details: ValidationIssue[]) {
    super('Request validation failed');
  }
}

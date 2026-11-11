import { ArgumentMetadata, Injectable, ValidationError, ValidationPipe } from '@nestjs/common';
import { RequestValidationError, ValidationIssue } from '../errors/app-error.js';

/** class-validator errors (nested) -> flat [{ loc, msg, type }] like the FastAPI version. */
function flatten(errors: ValidationError[], parent: (string | number)[] = []): ValidationIssue[] {
  return errors.flatMap((err) => {
    const loc = [...parent, /^\d+$/.test(err.property) ? Number(err.property) : err.property];
    const own = Object.entries(err.constraints ?? {}).map(([type, msg]) => ({ loc, msg, type }));
    return [...own, ...flatten(err.children ?? [], loc)];
  });
}

/**
 * Global validation:
 *   * transform   -> query strings become numbers/booleans, bodies become DTO instances
 *   * whitelist   -> unknown fields are dropped (never reach the database)
 *   * errors      -> 422 { error: "validation_error", details: [{ loc: ["body","price"], ... }] }
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => new RequestValidationError(flatten(errors)),
    });
  }

  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    try {
      return await super.transform(value, metadata);
    } catch (err) {
      if (err instanceof RequestValidationError) {
        const where = metadata.type === 'custom' ? 'body' : metadata.type;   // "body" | "query" | "param"
        err.details = err.details.map((d) => ({ ...d, loc: [where, ...d.loc] }));
      }
      throw err;
    }
  }
}

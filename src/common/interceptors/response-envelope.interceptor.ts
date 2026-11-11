import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import { RAW_RESPONSE, RESPONSE_MESSAGE } from '../decorators/response.decorators.js';

export interface ApiResponse<T> {
  success: true;
  message: string;
  code: number;
  data: T;
}

/**
 * Wraps whatever a controller returns into the standard success envelope:
 *
 *   return product;   ->   { success: true, message: "Product retrieved", code: 200, data: product }
 *
 * Controllers stay focused on data; the format is defined once, here.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T | undefined> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T | undefined> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, targets)) return next.handle();

    const message = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE, targets) ?? 'Success';
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (res.statusCode === HttpStatus.NO_CONTENT) return undefined;   // 204 has no body
        return { success: true as const, message, code: res.statusCode, data: (data ?? null) as T };
      }),
    );
  }
}

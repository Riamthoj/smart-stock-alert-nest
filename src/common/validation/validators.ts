import { applyDecorators, Param, ParseUUIDPipe } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RequestValidationError } from '../errors/app-error.js';
import { MAX_MONEY } from '../utils/money.js';

/** `@IdParam('product_id') id: string` -> 422 (not 500) when the id is not a UUID. */
export const IdParam = (name: string) =>
  Param(
    name,
    new ParseUUIDPipe({
      version: 'all' as never,
      exceptionFactory: () =>
        new RequestValidationError([{ loc: ['path', name], msg: 'Input should be a valid UUID', type: 'uuid_parsing' }]),
    }),
  );

/** Money: number >= 0 with at most 2 decimals ("8000" strings accepted too). */
export const IsMoney = (opts: { positive?: boolean } = {}) =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)) ? Number(value) : value)),
    IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }),
    opts.positive ? Min(0.01) : Min(0),
    Max(MAX_MONEY),
  );

/** Optional UUID (absent or null allowed). */
export const OptionalUuid = () => applyDecorators(IsOptional(), IsUUID('all'));

/** Optional string with length bounds; null allowed (= clear the value on PATCH). */
export const OptionalText = (min: number, max: number) =>
  applyDecorators(IsOptional(), IsString(), min > 0 ? Length(min, max) : MaxLength(max));

/** Query-string boolean: "true"/"1" -> true, "false"/"0" -> false. */
export const QueryBool = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => {
      if (value === undefined || value === '') return undefined;
      if (['true', '1', 'yes', 'on'].includes(String(value).toLowerCase())) return true;
      if (['false', '0', 'no', 'off'].includes(String(value).toLowerCase())) return false;
      return value;
    }),
    IsBoolean(),
  );

/** Query-string date-time (ISO 8601) -> Date. */
export const QueryDate = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Date),
    IsDate({ message: '$property must be an ISO 8601 date-time, e.g. 2026-11-08T00:00:00+07:00' }),
  );

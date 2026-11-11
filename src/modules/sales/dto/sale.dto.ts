import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { IsMoney, OptionalUuid, QueryDate } from '../../../common/validation/validators.js';

export class SalesQueryDto extends StoreFilterQueryDto {
  /** Only this seller */
  @OptionalUuid()
  owner_id?: string;

  /** Only this customer */
  @OptionalUuid()
  customer_id?: string;

  /** sold_at >= this, e.g. 2026-11-08T00:00:00+07:00 */
  @QueryDate()
  date_from?: Date;

  /** sold_at < this (exclusive) */
  @QueryDate()
  date_to?: Date;
}

export class SaleItemCreateDto {
  /** Product sold (must belong to the sale's store) */
  @IsUUID('all')
  product_id!: string;

  /** Units sold @example 2 */
  @IsInt()
  @Min(1)
  qty!: number;

  /** Override the selling price (default: the product's current price) */
  @IsOptional()
  @IsMoney()
  unit_price?: number | null;
}

export class SaleCreateDto {
  /** Store making the sale. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Seller (an owner / member of the store). Optional with an owner login: defaults to you */
  @OptionalUuid()
  owner_id?: string;

  /** Customer, or null for a walk-in sale */
  @OptionalUuid()
  customer_id?: string | null;

  /** Discount AMOUNT for the whole sale @example 0 */
  @IsOptional()
  @IsMoney()
  discount: number = 0;

  /** Tax AMOUNT for the whole sale @example 0 */
  @IsOptional()
  @IsMoney()
  tax: number = 0;

  /** When it happened (default: now) */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  sold_at?: Date | null;

  /** What was sold */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemCreateDto)
  items!: SaleItemCreateDto[];
}

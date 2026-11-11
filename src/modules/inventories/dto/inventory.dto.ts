import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, NotEquals } from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { OptionalUuid, QueryBool } from '../../../common/validation/validators.js';

export class InventoriesQueryDto extends StoreFilterQueryDto {
  /** Only this product */
  @OptionalUuid()
  product_id?: string;

  /** true = only low stock, false = only OK stock */
  @QueryBool()
  low_stock?: boolean;
}

export class InventoryCreateDto {
  /** Store (must be the product's store). Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Product to track */
  @IsUUID('all')
  product_id!: string;

  /** Units physically in stock (recorded as an "initial stock" move) @example 100 */
  @IsOptional()
  @IsInt()
  @Min(0)
  qty: number = 0;

  /** Units reserved for orders (<= qty) @example 0 */
  @IsOptional()
  @IsInt()
  @Min(0)
  reserved_qty: number = 0;

  /** Low-stock alert when available_qty <= this @example 10 */
  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_level: number = 10;
}

export class InventoryUpdateDto {
  /** Units physically in stock (the difference is recorded as an "adjust" move) */
  @IsOptional()
  @IsInt()
  @Min(0)
  qty?: number | null;

  /** Units reserved for orders (<= qty) */
  @IsOptional()
  @IsInt()
  @Min(0)
  reserved_qty?: number | null;

  /** Low-stock alert when available_qty <= this */
  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_level?: number | null;
}

export class StockAdjustmentDto {
  /** Positive = restock, negative = sale / shrinkage @example -3 */
  @IsInt()
  @NotEquals(0)
  delta!: number;

  /** Why @example damaged */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reason?: string | null;
}

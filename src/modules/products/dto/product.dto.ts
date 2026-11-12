import { IsOptional, IsString, Length } from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { IsMoney, OptionalText, OptionalUuid, QueryBool } from '../../../common/validation/validators.js';

export class ProductsQueryDto extends StoreFilterQueryDto {
  /** Only products of this category */
  @OptionalUuid()
  category_id?: string;

  /** true = show the trash (soft-deleted products) instead */
  @QueryBool()
  deleted?: boolean;
}

export class ProductCreateDto {
  /** Store this product belongs to. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Category (must belong to the same store); null = uncategorized */
  @OptionalUuid()
  category_id?: string | null;

  /** Name of the product @example Coca-Cola 330ml */
  @IsString()
  @Length(1, 255)
  name!: string;

  /** Image URL. Usually set by uploading a file: PUT /products/{id}/image */
  @OptionalText(0, 500)
  image?: string | null;

  /** Barcode (unique within a store) @example 8851959132012 */
  @OptionalText(1, 64)
  bar_code?: string | null;

  /** Purchase cost per unit @example 6000 */
  @IsMoney()
  cost_price!: number;

  /** Selling price per unit @example 8000 */
  @IsMoney()
  price!: number;
}

export class ProductUpdateDto {
  /** Category (same store), or null to remove */
  @OptionalUuid()
  category_id?: string | null;

  /** Name of the product */
  @OptionalText(1, 255)
  name?: string | null;

  /** Image URL (or null to remove it) */
  @OptionalText(0, 500)
  image?: string | null;

  /** Barcode (unique within a store), or null to remove */
  @OptionalText(1, 64)
  bar_code?: string | null;

  /** Purchase cost per unit */
  @IsOptional()
  @IsMoney()
  cost_price?: number | null;

  /** Selling price per unit */
  @IsOptional()
  @IsMoney()
  price?: number | null;
}

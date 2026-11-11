import { IsOptional, IsString, Length } from 'class-validator';
import { OptionalText, OptionalUuid } from '../../../common/validation/validators.js';

export class CategoryCreateDto {
  /** Store this category belongs to. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Category name (unique within a store) @example Drinks */
  @IsString()
  @Length(1, 255)
  name!: string;

  /** Image URL. Usually set by uploading a file: PUT /categories/{id}/image */
  @OptionalText(0, 500)
  image?: string | null;

  /** Description of the category @example Soft drinks and water */
  @IsOptional()
  @IsString()
  detail?: string | null;
}

export class CategoryUpdateDto {
  /** Category name (unique within a store) */
  @OptionalText(1, 255)
  name?: string | null;

  /** Image URL (or null to remove it) */
  @OptionalText(0, 500)
  image?: string | null;

  /** Description of the category */
  @IsOptional()
  @IsString()
  detail?: string | null;
}

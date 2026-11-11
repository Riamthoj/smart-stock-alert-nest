import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto.js';
import { OptionalText } from '../../../common/validation/validators.js';
import { STORE_STATUSES, type StoreStatus } from '../../../database/schema/index.js';
import { OwnerAccountDto } from '../../owners/dto/owner.dto.js';

export class StoresQueryDto extends PaginationQueryDto {
  /** Filter by status: active / pending / block */
  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;
}

export class StoreCreateDto {
  /** Store name @example Vientiane Central */
  @IsString()
  @Length(1, 255)
  name!: string;

  /** Image / logo URL */
  @OptionalText(0, 500)
  image?: string | null;

  /** Description of the store @example Open 8:00-20:00 */
  @IsOptional()
  @IsString()
  detail?: string | null;

  /** The store's first owner (becomes the primary owner) */
  @ValidateNested()
  @Type(() => OwnerAccountDto)
  owner!: OwnerAccountDto;
}

export class StoreUpdateDto {
  /** Store name */
  @OptionalText(1, 255)
  name?: string | null;

  /** Image / logo URL (or null to remove it) */
  @OptionalText(0, 500)
  image?: string | null;

  /** Description of the store */
  @IsOptional()
  @IsString()
  detail?: string | null;
}

export class StoreStatusDto {
  /** active / pending / block */
  @IsIn(STORE_STATUSES)
  status!: StoreStatus;
}

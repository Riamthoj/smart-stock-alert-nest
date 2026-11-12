import { IsBoolean, IsString, Length } from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { OptionalText, OptionalUuid, QueryBool } from '../../../common/validation/validators.js';

export class CustomersQueryDto extends StoreFilterQueryDto {
  /** true = show the trash (soft-deleted customers) instead */
  @QueryBool()
  deleted?: boolean;
}

export class CustomerCreateDto {
  /** Store this customer belongs to. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Customer full name @example John Smith */
  @IsString()
  @Length(1, 255)
  full_name!: string;

  /** Phone number (unique within a store) @example +8562055555555 */
  @OptionalText(1, 15)
  phone?: string | null;

  /** Profile image URL. Usually set by uploading a file: PUT /customers/{id}/profile */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class CustomerUpdateDto {
  /** Customer full name */
  @OptionalText(1, 255)
  full_name?: string | null;

  /** Phone number (or null to remove it) */
  @OptionalText(1, 15)
  phone?: string | null;

  /** Profile image URL (or null to remove it) */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class CustomerActiveDto {
  /** false = deactivate the customer */
  @IsBoolean()
  is_active!: boolean;
}

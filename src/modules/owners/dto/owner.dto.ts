import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { OptionalText, OptionalUuid } from '../../../common/validation/validators.js';

/** Login + profile of a store account (used by POST /owners and inside POST /stores). */
export class OwnerAccountDto {
  /** Unique login name @example shop_owner */
  @IsString()
  @Length(3, 64)
  username!: string;

  /** Plain password (stored hashed) @example password123 */
  @IsString()
  @Length(8, 128)
  password!: string;

  /** Phone number @example +8562055555555 */
  @OptionalText(1, 15)
  phone?: string | null;

  /** Profile image URL. Usually set by uploading a file: PUT /owners/{id}/profile */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class OwnerCreateDto extends OwnerAccountDto {
  /** Store this owner belongs to. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** true = owner, false = normal store member (staff) */
  @IsOptional()
  @IsBoolean()
  is_owner: boolean = false;
}

export class OwnerUpdateDto {
  /** Phone number (or null to remove it) */
  @OptionalText(1, 15)
  phone?: string | null;

  /** Profile image URL (or null to remove it) */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class OwnerIsOwnerDto {
  /** true = owner, false = normal store member (not allowed for the primary owner) */
  @IsBoolean()
  is_owner!: boolean;
}

export class OwnerResetPasswordDto {
  /** New password */
  @IsString()
  @Length(8, 128)
  password!: string;
}

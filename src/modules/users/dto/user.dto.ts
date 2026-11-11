import { IsBoolean, IsString, Length } from 'class-validator';
import { OptionalText } from '../../../common/validation/validators.js';

export class UserCreateDto {
  /** Unique login name @example john */
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

  /** Profile image URL. Usually set by uploading a file: PUT /users/{id}/profile */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class UserUpdateDto {
  /** Phone number (or null to remove it) */
  @OptionalText(1, 15)
  phone?: string | null;

  /** Profile image URL (or null to remove it) */
  @OptionalText(0, 500)
  profile?: string | null;
}

export class ResetPasswordDto {
  /** New password */
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class UserActiveDto {
  /** false = disable the account */
  @IsBoolean()
  is_active!: boolean;
}

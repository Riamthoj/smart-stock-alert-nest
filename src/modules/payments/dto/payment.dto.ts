import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { IsMoney, OptionalUuid } from '../../../common/validation/validators.js';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '../../../database/schema/index.js';

export class PaymentsQueryDto extends StoreFilterQueryDto {
  /** Only this sale */
  @OptionalUuid()
  sale_id?: string;

  /** pending / paid / failed / refunded */
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  /** cash / bank_transfer / qr / card */
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  payment_method?: PaymentMethod;
}

export class PaymentCreateDto {
  /** Sale being paid */
  @IsUUID('all')
  sale_id!: string;

  /** cash / bank_transfer / qr / card */
  @IsIn(PAYMENT_METHODS)
  payment_method!: PaymentMethod;

  /** Amount paid with this method @example 25000 */
  @IsMoney({ positive: true })
  amount!: number;

  /** paid (default) or pending (e.g. waiting for a bank transfer) */
  @IsOptional()
  @IsIn([PaymentStatus.PAID, PaymentStatus.PENDING])
  status: typeof PaymentStatus.PAID | typeof PaymentStatus.PENDING = PaymentStatus.PAID;
}

export class PaymentStatusDto {
  /** Allowed: pending -> paid / failed, paid -> refunded */
  @IsIn(PAYMENT_STATUSES)
  status!: PaymentStatus;
}

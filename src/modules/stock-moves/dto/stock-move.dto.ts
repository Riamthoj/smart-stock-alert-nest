import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, NotEquals, ValidateBy } from 'class-validator';
import { StoreFilterQueryDto } from '../../../common/pagination/store-filter.dto.js';
import { OptionalUuid } from '../../../common/validation/validators.js';
import { MOVE_TYPES, MoveType } from '../../../database/schema/index.js';

export class StockMovesQueryDto extends StoreFilterQueryDto {
  /** Only this product */
  @OptionalUuid()
  product_id?: string;

  /** in / out / adjust */
  @IsOptional()
  @IsIn(MOVE_TYPES)
  move_type?: MoveType;
}

export class StockMoveCreateDto {
  /** Store. Optional with an owner login: defaults to your store */
  @OptionalUuid()
  store_id?: string;

  /** Product (must have an inventory in this store) */
  @IsUUID('all')
  product_id!: string;

  /** in / out / adjust */
  @IsIn(MOVE_TYPES)
  move_type!: MoveType;

  /**
   * in/out: a POSITIVE number of units (the type gives the direction).
   * adjust: the signed change, e.g. -2 or 5.
   * @example 5
   */
  @IsInt()
  @NotEquals(0, { message: 'qty cannot be 0' })
  @ValidateBy({
    name: 'positiveForInOut',
    validator: {
      validate: (qty, args) => (args?.object as StockMoveCreateDto).move_type === MoveType.ADJUST || Number(qty) > 0,
      defaultMessage: () => 'qty must be positive for move_type in/out (the type gives the direction)',
    },
  })
  qty!: number;

  /** Order / invoice number or a note @example INV-0001 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string | null;

  /** The signed change to apply to the inventory. */
  get delta(): number {
    return this.move_type === MoveType.OUT ? -this.qty : this.qty;
  }
}

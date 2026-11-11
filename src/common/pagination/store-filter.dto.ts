import { PaginationQueryDto } from './pagination.dto.js';
import { OptionalUuid } from '../validation/validators.js';

/**
 * ?store_id= filter shared by most list endpoints.
 * Admins: any store (or all). Owners: forced to their own store (another -> 403).
 */
export class StoreFilterQueryDto extends PaginationQueryDto {
  /** Only rows of this store */
  @OptionalUuid()
  store_id?: string;
}

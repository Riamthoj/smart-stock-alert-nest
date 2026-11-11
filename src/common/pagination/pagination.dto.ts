import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/**
 * ?page=1&limit=10&search=coke&q=all
 *
 * Extend it for endpoints with more filters:
 *     export class ProductsQueryDto extends PaginationQueryDto { category_id?: string }
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number, starting at 1', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Rows per page (default 10)', default: 10, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 10;

  @ApiPropertyOptional({ description: 'Case-insensitive text search', maxLength: 100 })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'q=all -> return every row; anything else -> paginated', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  q?: string;

  /** ?q=all -> a plain list of every row instead of one page. */
  get all(): boolean {
    return (this.q ?? '').trim().toLowerCase() === 'all';
  }

  get offset(): number {
    return this.all ? 0 : (this.page - 1) * this.limit;
  }

  /** undefined = no LIMIT (q=all). */
  get rowLimit(): number | undefined {
    return this.all ? undefined : this.limit;
  }
}

export interface PageData<T> {
  count: number;
  pages: number;
  currentPage: number;
  nextPage: number | null;
  previousPage: number | null;
  rows: T[];
}

/** What a repository list returns: one page of rows + the total across all pages. */
export interface Page<T> {
  rows: T[];
  total: number;
}

/**
 * `data` of a list endpoint:
 *   ?q=all  -> [ {...}, {...} ]
 *   default -> { count, pages, currentPage, nextPage, previousPage, rows }
 */
export function paginate<T>(rows: T[], count: number, query: PaginationQueryDto): PageData<T> | T[] {
  if (query.all) return rows;
  const pages = Math.ceil(count / query.limit);
  return {
    count,
    pages,
    currentPage: query.page,
    nextPage: query.page < pages ? query.page + 1 : null,
    previousPage: query.page > 1 && pages > 0 ? Math.min(query.page - 1, pages) : null,
    rows,
  };
}

/** Map the rows of a repository page and paginate them in one go. */
export function presentPage<R, T>(page: Page<R>, query: PaginationQueryDto, present: (row: R) => T) {
  return paginate(page.rows.map(present), page.total, query);
}

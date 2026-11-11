import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { paginate, PaginationQueryDto } from './pagination.dto.js';

const query = (q: Record<string, string>) => plainToInstance(PaginationQueryDto, q);

describe('pagination', () => {
  it('builds the page envelope (camelCase, like the FastAPI version)', () => {
    expect(paginate(['a', 'b'], 25, query({ page: '2', limit: '10' }))).toEqual({
      count: 25,
      pages: 3,
      currentPage: 2,
      nextPage: 3,
      previousPage: 1,
      rows: ['a', 'b'],
    });
  });

  it('has no next page on the last page and no previous on the first', () => {
    expect(paginate([], 5, query({ page: '1', limit: '10' }))).toMatchObject({ nextPage: null, previousPage: null });
  });

  it('q=all returns a plain array with no LIMIT', () => {
    const q = query({ q: 'ALL', page: '3' });
    expect(q.all).toBe(true);
    expect(q.offset).toBe(0);
    expect(q.rowLimit).toBeUndefined();
    expect(paginate([1, 2], 2, q)).toEqual([1, 2]);
  });

  it('computes offset from page and limit', () => {
    expect(query({ page: '3', limit: '20' }).offset).toBe(40);
  });
});

import { Injectable } from '@nestjs/common';
import { and, desc, count, eq, gte, lt } from 'drizzle-orm';
import type { Page } from '../../common/pagination/pagination.dto.js';
import { activityLogs, type ActivityLog } from '../schema/index.js';
import { BaseRepository, ListOptions } from './base.repository.js';

export interface ActivityLogFilter {
  storeId?: string;
  accountId?: string;
  method?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class ActivityLogsRepository extends BaseRepository<typeof activityLogs> {
  protected readonly table = activityLogs;

  /** Newest first (an audit trail is read backwards). */
  async listFiltered(filter: ActivityLogFilter, { offset, limit }: ListOptions): Promise<Page<ActivityLog>> {
    const where = and(
      filter.storeId ? eq(activityLogs.store_id, filter.storeId) : undefined,
      filter.accountId ? eq(activityLogs.account_id, filter.accountId) : undefined,
      filter.method ? eq(activityLogs.method, filter.method) : undefined,
      filter.dateFrom ? gte(activityLogs.created_at, filter.dateFrom) : undefined,
      filter.dateTo ? lt(activityLogs.created_at, filter.dateTo) : undefined,
    );
    const query = this.db.select().from(activityLogs).where(where).orderBy(desc(activityLogs.id)).offset(offset);
    const [rows, [{ total }]] = await Promise.all([
      limit === undefined ? query : query.limit(limit),
      this.db.select({ total: count() }).from(activityLogs).where(where),
    ]);
    return { rows, total };
  }

  /** Retention: delete entries older than `before`. Returns how many were removed. */
  async purgeOlderThan(before: Date): Promise<number> {
    const result = await this.db.delete(activityLogs).where(lt(activityLogs.created_at, before));
    return result.rowCount ?? 0;
  }
}

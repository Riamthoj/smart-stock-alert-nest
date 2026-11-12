import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { OptionalUuid, QueryDate } from '../../common/validation/validators.js';
import { ActivityLogsRepository } from '../../database/repositories/activity-logs.repository.js';
import type { ActivityLog } from '../../database/schema/index.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';

export class ActivityLogsQueryDto extends StoreFilterQueryDto {
  /** Only this account (user or owner id) */
  @OptionalUuid()
  account_id?: string;

  /** POST / PUT / PATCH / DELETE */
  @IsOptional()
  @IsIn(['POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  /** created_at >= this, e.g. 2026-11-01T00:00:00+07:00 */
  @QueryDate()
  date_from?: Date;

  /** created_at < this (exclusive) */
  @QueryDate()
  date_to?: Date;
}

const present = (l: ActivityLog) => ({
  id: l.id,
  account_type: l.account_type,
  account_id: l.account_id,
  store_id: l.store_id,
  method: l.method,
  route: l.route,
  path: l.path,
  status_code: l.status_code,
  request_id: l.request_id,
  ip: l.ip,
  user_agent: l.user_agent,
  body: l.body,
  created_at: l.created_at,
});

/** The audit trail. Admins: everything. Store owners: their own store (staff: no access). */
@ApiTags('activity-logs')
@ApiAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly logs: ActivityLogsRepository) {}

  @Get()
  @ApiOperation({ summary: 'Who changed what, when (newest first)' })
  @ResponseMessage('Activity logs retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: ActivityLogsQueryDto) {
    scope.requireStoreOwner(); // staff can't read the audit trail
    const page = await this.logs.listFiltered(
      {
        storeId: scope.listStore(query.store_id),
        accountId: query.account_id,
        method: query.method,
        dateFrom: query.date_from,
        dateTo: query.date_to,
      },
      { offset: query.offset, limit: query.rowLimit },
    );
    return presentPage(page, query, present);
  }
}

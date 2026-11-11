import { Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { AlertsQueryDto, AlertsService, presentAlert } from './alerts.service.js';

/** Alerts are opened / refreshed / resolved automatically by stock changes: no "create" endpoint. */
@ApiTags('stock-alerts')
@ApiAuth()
@Controller('stock-alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Get stock alerts' })
  @ResponseMessage('Stock alerts retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: AlertsQueryDto) {
    return presentPage(await this.alerts.list(scope, query), query, presentAlert);
  }

  @Get(':alert_id')
  @ApiOperation({ summary: 'Get a stock alert by ID' })
  @ResponseMessage('Stock alert retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('alert_id') id: string) {
    return presentAlert(await this.alerts.get(scope, id));
  }

  @Patch(':alert_id/resolve')
  @ApiOperation({ summary: 'Resolve a stock alert manually' })
  @ApiResponse({ status: 422, description: 'Alert is already resolved' })
  @ResponseMessage('Stock alert resolved')
  async resolve(@CurrentScope() scope: Scope, @IdParam('alert_id') id: string) {
    return presentAlert(await this.alerts.resolve(scope, id));
  }
}

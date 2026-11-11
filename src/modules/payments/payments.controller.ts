import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { PaymentCreateDto, PaymentsQueryDto, PaymentStatusDto } from './dto/payment.dto.js';
import { PaymentsService, presentPayment } from './payments.service.js';

@ApiTags('payments')
@ApiAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get payments' })
  @ResponseMessage('Payments retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: PaymentsQueryDto) {
    return presentPage(await this.payments.list(scope, query), query, presentPayment);
  }

  @Get(':payment_id')
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ResponseMessage('Payment retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('payment_id') id: string) {
    return presentPayment(await this.payments.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Add a payment to a sale' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  @ApiResponse({ status: 422, description: 'Payment would exceed the sale total' })
  @ResponseMessage('Payment created')
  async create(@CurrentScope() scope: Scope, @Body() dto: PaymentCreateDto) {
    return presentPayment(await this.payments.create(scope, dto));
  }

  @Patch(':payment_id/status')
  @ApiOperation({ summary: "Change a payment's status (pending -> paid/failed, paid -> refunded)" })
  @ApiResponse({ status: 422, description: 'Status change not allowed' })
  @ResponseMessage('Payment status updated')
  async setStatus(@CurrentScope() scope: Scope, @IdParam('payment_id') id: string, @Body() dto: PaymentStatusDto) {
    return presentPayment(await this.payments.setStatus(scope, id, dto.status));
  }
}

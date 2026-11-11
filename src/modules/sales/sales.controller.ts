import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples, EXAMPLE_PRODUCT_ID } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { SaleCreateDto, SalesQueryDto } from './dto/sale.dto.js';
import { presentSale } from './sale.presenter.js';
import { SalesService } from './sales.service.js';

/** Sales are never edited: they are snapshots (prices, costs) of the moment of sale. */
@ApiTags('sales')
@ApiAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'Get sales (search: receipt number)' })
  @ResponseMessage('Sales retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: SalesQueryDto) {
    return presentPage(await this.sales.list(scope, query), query, presentSale);
  }

  @Get(':sale_id')
  @ApiOperation({ summary: 'Get a sale by ID' })
  @ResponseMessage('Sale retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('sale_id') id: string) {
    return presentSale(await this.sales.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a sale (removes stock, may open stock alerts)' })
  @ApiBody({
    type: SaleCreateDto,
    examples: createExamples({ customer_id: null, discount: 0, tax: 0, items: [{ product_id: EXAMPLE_PRODUCT_ID, qty: 2 }] }),
  })
  @ApiResponse({ status: 404, description: 'Store, owner, customer or product not found' })
  @ApiResponse({ status: 422, description: 'Not enough stock, wrong store, blocked store, or discount > subtotal' })
  @ResponseMessage('Sale created')
  async create(@CurrentScope() scope: Scope, @Body() dto: SaleCreateDto) {
    return presentSale(await this.sales.create(scope, dto));
  }
}

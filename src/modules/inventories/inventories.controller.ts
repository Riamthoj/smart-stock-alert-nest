import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples, EXAMPLE_PRODUCT_ID } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { InventoriesQueryDto, InventoryCreateDto, InventoryUpdateDto, StockAdjustmentDto } from './dto/inventory.dto.js';
import { InventoriesService, presentInventory } from './inventories.service.js';

@ApiTags('inventories')
@ApiAuth()
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventories: InventoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all inventories (?low_stock=true for the reorder list)' })
  @ResponseMessage('Inventories retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: InventoriesQueryDto) {
    return presentPage(await this.inventories.list(scope, query), query, presentInventory);
  }

  @Get(':inventory_id')
  @ApiOperation({ summary: 'Get an inventory by ID' })
  @ResponseMessage('Inventory retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('inventory_id') id: string) {
    return presentInventory(await this.inventories.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create an inventory for a product' })
  @ApiBody({
    type: InventoryCreateDto,
    examples: createExamples({ product_id: EXAMPLE_PRODUCT_ID, qty: 100, reserved_qty: 0, reorder_level: 10 }),
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Product already has an inventory in this store' })
  @ApiResponse({ status: 422, description: 'Product belongs to a different store, or reserved_qty > qty' })
  @ResponseMessage('Inventory created')
  async create(@CurrentScope() scope: Scope, @Body() dto: InventoryCreateDto) {
    return presentInventory(await this.inventories.create(scope, dto));
  }

  @Patch(':inventory_id')
  @ApiOperation({ summary: 'Update an inventory (qty changes are recorded as "adjust" moves)' })
  @ApiResponse({ status: 422, description: 'reserved_qty > qty' })
  @ResponseMessage('Inventory updated')
  async update(@CurrentScope() scope: Scope, @IdParam('inventory_id') id: string, @Body() dto: InventoryUpdateDto) {
    return presentInventory(await this.inventories.update(scope, id, dto));
  }

  @Post(':inventory_id/stock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add or remove stock' })
  @ApiResponse({ status: 422, description: 'Not enough available stock' })
  @ResponseMessage('Stock adjusted')
  async adjust(@CurrentScope() scope: Scope, @IdParam('inventory_id') id: string, @Body() dto: StockAdjustmentDto) {
    return presentInventory(await this.inventories.adjustStock(scope, id, dto));
  }

  @Delete(':inventory_id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an inventory' })
  async delete(@CurrentScope() scope: Scope, @IdParam('inventory_id') id: string) {
    await this.inventories.delete(scope, id);
  }
}

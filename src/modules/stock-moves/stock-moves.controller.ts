import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples, EXAMPLE_PRODUCT_ID } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { StockMovesRepository } from '../../database/repositories/stock.repository.js';
import type { StockMove } from '../../database/schema/index.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { InventoriesService, presentInventory } from '../inventories/inventories.service.js';
import { StockMoveCreateDto, StockMovesQueryDto } from './dto/stock-move.dto.js';

const present = (m: StockMove) => ({
  id: m.id,
  store_id: m.store_id,
  product_id: m.product_id,
  move_type: m.move_type,
  qty: m.qty,
  reference: m.reference,
  created_at: m.created_at,
});

/** The stock LEDGER: read it, or append to it (which updates the inventory). Moves are never edited. */
@ApiTags('stock-moves')
@ApiAuth()
@Controller('stock-moves')
export class StockMovesController {
  constructor(
    private readonly moves: StockMovesRepository,
    private readonly inventories: InventoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get stock moves (search: reference)' })
  @ResponseMessage('Stock moves retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: StockMovesQueryDto) {
    const page = await this.moves.listFiltered(
      {
        storeId: scope.listStore(query.store_id),
        productId: query.product_id,
        moveType: query.move_type,
        search: query.search,
      },
      { offset: query.offset, limit: query.rowLimit },
    );
    return presentPage(page, query, present);
  }

  @Get(':move_id')
  @ApiOperation({ summary: 'Get a stock move by ID' })
  @ResponseMessage('Stock move retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('move_id') id: string) {
    return present(scope.visible(await this.moves.findById(id), 'Stock move', id));
  }

  @Post()
  @ApiOperation({ summary: 'Record a stock move (updates the inventory and its alert)' })
  @ApiBody({
    type: StockMoveCreateDto,
    examples: createExamples({ product_id: EXAMPLE_PRODUCT_ID, move_type: 'in', qty: 50, reference: 'INV-0001' }),
  })
  @ApiResponse({ status: 404, description: 'No inventory for this product in this store' })
  @ApiResponse({ status: 422, description: 'Not enough available stock, or invalid qty for the move type' })
  @ResponseMessage('Stock move recorded')
  async create(@CurrentScope() scope: Scope, @Body() dto: StockMoveCreateDto) {
    const storeId = scope.checkCreate(dto.store_id);
    const { move, inventory } = await this.inventories.recordMove(storeId, dto.product_id, {
      delta: dto.delta,
      moveType: dto.move_type,
      reference: dto.reference,
    });
    return { ...present(move), inventory: presentInventory(inventory) };
  }
}

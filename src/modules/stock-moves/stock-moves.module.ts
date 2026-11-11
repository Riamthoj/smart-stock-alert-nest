import { Module } from '@nestjs/common';
import { InventoriesModule } from '../inventories/inventories.module.js';
import { StockMovesController } from './stock-moves.controller.js';

@Module({
  imports: [InventoriesModule],
  controllers: [StockMovesController],
})
export class StockMovesModule {}

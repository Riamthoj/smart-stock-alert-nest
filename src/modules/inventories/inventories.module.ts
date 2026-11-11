import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { InventoriesController } from './inventories.controller.js';
import { InventoriesService } from './inventories.service.js';

@Module({
  imports: [AlertsModule],
  controllers: [InventoriesController],
  providers: [InventoriesService],
  exports: [InventoriesService], // stock moves + sales change stock through it
})
export class InventoriesModule {}

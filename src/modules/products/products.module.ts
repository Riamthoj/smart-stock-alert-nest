import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [AlertsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}

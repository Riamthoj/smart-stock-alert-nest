import { Module } from '@nestjs/common';
import { OwnersModule } from '../owners/owners.module.js';
import { StoresController } from './stores.controller.js';
import { StoresService } from './stores.service.js';

@Module({
  imports: [OwnersModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}

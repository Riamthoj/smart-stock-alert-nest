import { Module } from '@nestjs/common';
import { OwnersController } from './owners.controller.js';
import { OwnersService } from './owners.service.js';

@Module({
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService], // StoresService creates the first owner
})
export class OwnersModule {}

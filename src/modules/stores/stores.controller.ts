import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { AdminOnly, ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { presentOwner } from '../owners/owner.presenter.js';
import { StoreCreateDto, StoresQueryDto, StoreStatusDto, StoreUpdateDto } from './dto/store.dto.js';
import { presentStore } from './store.presenter.js';
import { StoresService } from './stores.service.js';

@ApiTags('stores')
@ApiAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stores (owners: only their own)' })
  @ResponseMessage('Stores retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: StoresQueryDto) {
    return presentPage(await this.stores.list(scope, query), query, presentStore);
  }

  @Get(':store_id')
  @ApiOperation({ summary: 'Get a store by ID' })
  @ResponseMessage('Store retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('store_id') id: string) {
    return presentStore(await this.stores.get(scope, id));
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new store with its first owner' })
  @ApiResponse({ status: 409, description: 'Owner username or phone already exists' })
  @ResponseMessage('Store created')
  async create(@CurrentScope() scope: Scope, @Body() dto: StoreCreateDto) {
    const { store, owner } = await this.stores.create(scope, dto);
    return { ...presentStore(store), owner: presentOwner(owner) };
  }

  @Patch(':store_id')
  @ApiOperation({ summary: 'Update a store' })
  @ResponseMessage('Store updated')
  async update(@CurrentScope() scope: Scope, @IdParam('store_id') id: string, @Body() dto: StoreUpdateDto) {
    return presentStore(await this.stores.update(scope, id, dto));
  }

  @Patch(':store_id/status')
  @AdminOnly()
  @ApiOperation({ summary: "Change a store's status (approve / block)" })
  @ResponseMessage('Store status updated')
  async setStatus(@CurrentScope() scope: Scope, @IdParam('store_id') id: string, @Body() dto: StoreStatusDto) {
    return presentStore(await this.stores.setStatus(scope, id, dto.status));
  }

  @Delete(':store_id')
  @AdminOnly()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a store and all its data' })
  async delete(@CurrentScope() scope: Scope, @IdParam('store_id') id: string) {
    await this.stores.delete(scope, id);
  }

  @Put(':store_id/image')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload store image' })
  @ResponseMessage('Image uploaded')
  async uploadImage(
    @CurrentScope() scope: Scope,
    @IdParam('store_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return presentStore(await this.stores.uploadImage(scope, id, file));
  }
}

import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { OwnerCreateDto, OwnerIsOwnerDto, OwnerResetPasswordDto, OwnerUpdateDto } from './dto/owner.dto.js';
import { presentOwner } from './owner.presenter.js';
import { OwnersService } from './owners.service.js';

@ApiTags('owners')
@ApiAuth()
@Controller('owners')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all owners / staff' })
  @ResponseMessage('Owners retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: StoreFilterQueryDto) {
    return presentPage(await this.owners.list(scope, query.store_id, query), query, presentOwner);
  }

  @Get(':owner_id')
  @ApiOperation({ summary: 'Get an owner by ID' })
  @ResponseMessage('Owner retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('owner_id') id: string) {
    return presentOwner(await this.owners.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Add an owner / staff member to a store' })
  @ApiBody({
    type: OwnerCreateDto,
    examples: createExamples({ username: 'cashier01', password: 'password123', phone: '+8562099999999', is_owner: false }),
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 409, description: 'Username or phone already exists' })
  @ResponseMessage('Owner created')
  async create(@CurrentScope() scope: Scope, @Body() dto: OwnerCreateDto) {
    return presentOwner(await this.owners.create(scope, dto));
  }

  @Patch(':owner_id')
  @ApiOperation({ summary: 'Update an owner (staff: only themselves)' })
  @ResponseMessage('Owner updated')
  async update(@CurrentScope() scope: Scope, @IdParam('owner_id') id: string, @Body() dto: OwnerUpdateDto) {
    return presentOwner(await this.owners.update(scope, id, dto));
  }

  @Patch(':owner_id/is-owner')
  @ApiOperation({ summary: 'Make a member an owner, or an owner a member' })
  @ApiResponse({ status: 422, description: 'Cannot remove is_owner from the primary owner' })
  @ResponseMessage('Owner role updated')
  async setIsOwner(@CurrentScope() scope: Scope, @IdParam('owner_id') id: string, @Body() dto: OwnerIsOwnerDto) {
    return presentOwner(await this.owners.setIsOwner(scope, id, dto.is_owner));
  }

  @Put(':owner_id/password')
  @ApiOperation({ summary: "Reset an owner's password (logs out all their devices)" })
  @ResponseMessage('Password updated')
  async resetPassword(
    @CurrentScope() scope: Scope,
    @IdParam('owner_id') id: string,
    @Body() dto: OwnerResetPasswordDto,
  ) {
    return presentOwner(await this.owners.resetPassword(scope, id, dto.password));
  }

  @Delete(':owner_id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an owner' })
  @ApiResponse({ status: 409, description: 'The owner has made sales' })
  @ApiResponse({ status: 422, description: 'The primary owner cannot be deleted' })
  async delete(@CurrentScope() scope: Scope, @IdParam('owner_id') id: string) {
    await this.owners.delete(scope, id);
  }

  @Put(':owner_id/profile')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload owner profile picture' })
  @ResponseMessage('Profile picture uploaded')
  async uploadProfile(
    @CurrentScope() scope: Scope,
    @IdParam('owner_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return presentOwner(await this.owners.uploadProfile(scope, id, file));
  }
}

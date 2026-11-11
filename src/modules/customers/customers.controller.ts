import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { presentPage } from '../../common/pagination/pagination.dto.js';
import { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import type { Customer } from '../../database/schema/index.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { CustomersService } from './customers.service.js';
import { CustomerActiveDto, CustomerCreateDto, CustomerUpdateDto } from './dto/customer.dto.js';

const present = (c: Customer) => ({
  id: c.id,
  store_id: c.store_id,
  code: c.code,
  full_name: c.full_name,
  phone: c.phone,
  profile: c.profile,
  is_active: c.is_active,
  created_at: c.created_at,
  updated_at: c.updated_at,
});

@ApiTags('customers')
@ApiAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all customers (search: code, name, phone)' })
  @ResponseMessage('Customers retrieved')
  async list(@CurrentScope() scope: Scope, @Query() query: StoreFilterQueryDto) {
    return presentPage(await this.customers.list(scope, query), query, present);
  }

  @Get(':customer_id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @ResponseMessage('Customer retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('customer_id') id: string) {
    return present(await this.customers.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer (code CUS + MMDDYY + counter is generated)' })
  @ApiBody({ type: CustomerCreateDto, examples: createExamples({ full_name: 'John Smith', phone: '+8562055555555' }) })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 409, description: 'Phone already registered in this store' })
  @ResponseMessage('Customer created')
  async create(@CurrentScope() scope: Scope, @Body() dto: CustomerCreateDto) {
    return present(await this.customers.create(scope, dto));
  }

  @Patch(':customer_id')
  @ApiOperation({ summary: 'Update a customer' })
  @ResponseMessage('Customer updated')
  async update(@CurrentScope() scope: Scope, @IdParam('customer_id') id: string, @Body() dto: CustomerUpdateDto) {
    return present(await this.customers.update(scope, id, dto));
  }

  @Patch(':customer_id/active')
  @ApiOperation({ summary: 'Activate or deactivate a customer' })
  @ResponseMessage('Customer status updated')
  async setActive(@CurrentScope() scope: Scope, @IdParam('customer_id') id: string, @Body() dto: CustomerActiveDto) {
    return present(await this.customers.setActive(scope, id, dto.is_active));
  }

  @Delete(':customer_id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a customer' })
  async delete(@CurrentScope() scope: Scope, @IdParam('customer_id') id: string) {
    await this.customers.delete(scope, id);
  }

  @Put(':customer_id/profile')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload customer profile picture' })
  @ResponseMessage('Profile picture uploaded')
  async uploadProfile(
    @CurrentScope() scope: Scope,
    @IdParam('customer_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return present(await this.customers.uploadProfile(scope, id, file));
  }
}

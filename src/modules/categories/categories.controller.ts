import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { StoreFilterQueryDto } from '../../common/pagination/store-filter.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { CategoriesService, presentCategory } from './categories.service.js';
import { CategoryCreateDto, CategoryUpdateDto } from './dto/category.dto.js';

@ApiTags('categories')
@ApiAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories (cached)' })
  @ResponseMessage('Categories retrieved')
  list(@CurrentScope() scope: Scope, @Query() query: StoreFilterQueryDto) {
    return this.categories.list(scope, query);
  }

  @Get(':category_id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ResponseMessage('Category retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('category_id') id: string) {
    return presentCategory(await this.categories.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiBody({ type: CategoryCreateDto, examples: createExamples({ name: 'Drinks', detail: 'Soft drinks and water' }) })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 409, description: 'Name already used in this store' })
  @ResponseMessage('Category created')
  async create(@CurrentScope() scope: Scope, @Body() dto: CategoryCreateDto) {
    return presentCategory(await this.categories.create(scope, dto));
  }

  @Patch(':category_id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 409, description: 'Name already used in this store' })
  @ResponseMessage('Category updated')
  async update(@CurrentScope() scope: Scope, @IdParam('category_id') id: string, @Body() dto: CategoryUpdateDto) {
    return presentCategory(await this.categories.update(scope, id, dto));
  }

  @Delete(':category_id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a category (its products become uncategorized)' })
  async delete(@CurrentScope() scope: Scope, @IdParam('category_id') id: string) {
    await this.categories.delete(scope, id);
  }

  @Put(':category_id/image')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload category image' })
  @ResponseMessage('Image uploaded')
  async uploadImage(
    @CurrentScope() scope: Scope,
    @IdParam('category_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return presentCategory(await this.categories.uploadImage(scope, id, file));
  }
}

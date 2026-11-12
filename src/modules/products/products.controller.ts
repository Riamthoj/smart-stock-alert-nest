import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createExamples } from '../../common/api-examples.js';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { IdParam } from '../../common/validation/validators.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { ApiAuth, CurrentScope } from '../auth/auth.decorators.js';
import type { Scope } from '../auth/scope.js';
import { ProductCreateDto, ProductsQueryDto, ProductUpdateDto } from './dto/product.dto.js';
import { presentProduct, ProductsService } from './products.service.js';

@ApiTags('products')
@ApiAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all products (cached; search: name, barcode)' })
  @ResponseMessage('Products retrieved')
  list(@CurrentScope() scope: Scope, @Query() query: ProductsQueryDto) {
    return this.products.list(scope, query);
  }

  @Get(':product_id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ResponseMessage('Product retrieved')
  async get(@CurrentScope() scope: Scope, @IdParam('product_id') id: string) {
    return presentProduct(await this.products.get(scope, id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({
    type: ProductCreateDto,
    examples: createExamples({
      name: 'Coca-Cola 330ml',
      bar_code: '8851959132012',
      cost_price: 6000,
      price: 8000,
      category_id: null,
    }),
  })
  @ApiResponse({ status: 404, description: 'Store or category not found' })
  @ApiResponse({ status: 409, description: 'Barcode already used in this store' })
  @ApiResponse({ status: 422, description: 'Category belongs to a different store' })
  @ResponseMessage('Product created')
  async create(@CurrentScope() scope: Scope, @Body() dto: ProductCreateDto) {
    return presentProduct(await this.products.create(scope, dto));
  }

  @Patch(':product_id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 409, description: 'Barcode already used in this store' })
  @ResponseMessage('Product updated')
  async update(@CurrentScope() scope: Scope, @IdParam('product_id') id: string, @Body() dto: ProductUpdateDto) {
    return presentProduct(await this.products.update(scope, id, dto));
  }

  @Delete(':product_id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a product (soft: restorable, sale history kept; removes its inventory and open alert)',
  })
  async delete(@CurrentScope() scope: Scope, @IdParam('product_id') id: string) {
    await this.products.delete(scope, id);
  }

  @Post(':product_id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a deleted product (create a new inventory to sell it again)' })
  @ApiResponse({ status: 422, description: 'The product is not deleted' })
  @ResponseMessage('Product restored')
  async restore(@CurrentScope() scope: Scope, @IdParam('product_id') id: string) {
    return presentProduct(await this.products.restore(scope, id));
  }

  @Put(':product_id/image')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload product image' })
  @ResponseMessage('Image uploaded')
  async uploadImage(
    @CurrentScope() scope: Scope,
    @IdParam('product_id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return presentProduct(await this.products.uploadImage(scope, id, file));
  }
}

import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query, UploadedFile } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { PaginationQueryDto, presentPage } from '../../common/pagination/pagination.dto.js';
import { IdParam } from '../../common/validation/validators.js';
import { ImageUpload } from '../../infrastructure/storage/image-upload.decorator.js';
import { AdminOnly, ApiAuth } from '../auth/auth.decorators.js';
import { ResetPasswordDto, UserActiveDto, UserCreateDto, UserUpdateDto } from './dto/user.dto.js';
import { presentUser } from './user.presenter.js';
import { UsersService } from './users.service.js';

/** Platform admin accounts. Admin-only. */
@ApiTags('users')
@ApiAuth()
@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ResponseMessage('Users retrieved')
  async list(@Query() query: PaginationQueryDto) {
    return presentPage(await this.users.list(query), query, presentUser);
  }

  @Get(':user_id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ResponseMessage('User retrieved')
  async get(@IdParam('user_id') id: string) {
    return presentUser(await this.users.get(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 409, description: 'Username or phone already exists' })
  @ResponseMessage('User created')
  async create(@Body() dto: UserCreateDto) {
    return presentUser(await this.users.create(dto));
  }

  @Patch(':user_id')
  @ApiOperation({ summary: 'Update a user' })
  @ResponseMessage('User updated')
  async update(@IdParam('user_id') id: string, @Body() dto: UserUpdateDto) {
    return presentUser(await this.users.update(id, dto));
  }

  @Put(':user_id/password')
  @ApiOperation({ summary: "Reset a user's password (logs out all their devices)" })
  @ResponseMessage('Password updated')
  async resetPassword(@IdParam('user_id') id: string, @Body() dto: ResetPasswordDto) {
    return presentUser(await this.users.resetPassword(id, dto.password));
  }

  @Patch(':user_id/active')
  @ApiOperation({ summary: 'Enable or disable a user' })
  @ResponseMessage('User status updated')
  async setActive(@IdParam('user_id') id: string, @Body() dto: UserActiveDto) {
    return presentUser(await this.users.setActive(id, dto.is_active));
  }

  @Delete(':user_id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a user' })
  async delete(@IdParam('user_id') id: string) {
    await this.users.delete(id);
  }

  @Put(':user_id/profile')
  @ImageUpload()
  @ApiOperation({ summary: 'Upload user profile picture' })
  @ResponseMessage('Profile picture uploaded')
  async uploadProfile(@IdParam('user_id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return presentUser(await this.users.uploadProfile(id, file));
  }
}

import { applyDecorators, Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ResponseMessage } from '../../common/decorators/response.decorators.js';
import { RateLimitService } from '../../infrastructure/rate-limit/rate-limit.service.js';
import type { Owner, User } from '../../database/schema/index.js';
import { presentOwner } from '../owners/owner.presenter.js';
import { presentUser } from '../users/user.presenter.js';
import { ApiAuth, Auth, CurrentClaims, CurrentScope, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { Scope } from './scope.js';
import type { AccessClaims } from './token.service.js';

const LoginErrors = () =>
  applyDecorators(
    ApiResponse({ status: 401, description: 'Incorrect username or password' }),
    ApiResponse({ status: 403, description: 'Account disabled / store blocked' }),
    ApiResponse({ status: 429, description: 'Too many login attempts (see Retry-After header)' }),
  );

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Public()
  @Post('users/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User (platform admin) login' })
  @LoginErrors()
  @ResponseMessage('Login successful')
  async userLogin(@Body() dto: LoginDto, @Req() req: Request) {
    await this.rateLimit.login(req, dto.username); // before the (slow) password check
    const { token, expiresIn, account } = await this.auth.loginUser(dto);
    return { access_token: token, token_type: 'bearer', expires_in: expiresIn, user: presentUser(account) };
  }

  @Get('users/me')
  @Auth('user')
  @ApiAuth()
  @ApiOperation({ summary: 'Current user' })
  @ResponseMessage('Current user')
  userMe(@CurrentScope() scope: Scope) {
    return presentUser(scope.account as User);
  }

  @Public()
  @Post('owners/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owner / store staff login' })
  @LoginErrors()
  @ResponseMessage('Login successful')
  async ownerLogin(@Body() dto: LoginDto, @Req() req: Request) {
    await this.rateLimit.login(req, dto.username);
    const { token, expiresIn, account } = await this.auth.loginOwner(dto);
    return { access_token: token, token_type: 'bearer', expires_in: expiresIn, owner: presentOwner(account) };
  }

  @Get('owners/me')
  @Auth('owner')
  @ApiAuth()
  @ApiOperation({ summary: 'Current owner' })
  @ResponseMessage('Current owner')
  ownerMe(@CurrentScope() scope: Scope) {
    return presentOwner(scope.account as Owner);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiAuth()
  @ApiOperation({ summary: 'Logout (this device)' })
  @ApiResponse({ status: 503, description: 'Redis unavailable, try again' })
  @ResponseMessage('Logged out')
  async logout(@CurrentClaims() claims: AccessClaims) {
    await this.auth.logout(claims);
    return null;
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 503, description: 'Redis unavailable, try again' })
  @ResponseMessage('Logged out from all devices')
  async logoutAll(@CurrentClaims() claims: AccessClaims) {
    await this.auth.logoutAll(claims);
    return null;
  }
}

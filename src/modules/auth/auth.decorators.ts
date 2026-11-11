import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Scope, TokenType } from './scope.js';
import type { AccessClaims } from './token.service.js';

export const IS_PUBLIC = 'auth:public';
export const TOKEN_TYPE = 'auth:token-type';
export const ADMIN_ONLY = 'auth:admin-only';

/** What AuthGuard attaches to the request. */
export interface RequestAuth {
  token: string;
  claims: AccessClaims;
  scope: Scope;
}
export type AuthedRequest = Request & { auth: RequestAuth };

/** No login needed (login, health). Every other route requires a valid token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Only accept this kind of token: @Auth('owner'). Without it, both kinds are accepted. */
export const Auth = (type: TokenType) => SetMetadata(TOKEN_TYPE, type);

/** Platform admins (user tokens) only -> 403 for store logins. */
export const AdminOnly = () =>
  applyDecorators(SetMetadata(ADMIN_ONLY, true), ApiResponse({ status: 403, description: 'Admin users only' }));

/** Swagger: lock icon + the 401 every protected route can return. */
export const ApiAuth = () =>
  applyDecorators(ApiBearerAuth(), ApiResponse({ status: 401, description: 'Missing / invalid / expired token' }));

const fromRequest = <T>(pick: (auth: RequestAuth) => T) =>
  createParamDecorator((_: unknown, ctx: ExecutionContext) => pick(ctx.switchToHttp().getRequest<AuthedRequest>().auth));

/** The data scope of the logged-in account: `@CurrentScope() scope: Scope`. */
export const CurrentScope = fromRequest((a) => a.scope);

/** Verified token claims (logout). */
export const CurrentClaims = fromRequest((a) => a.claims);

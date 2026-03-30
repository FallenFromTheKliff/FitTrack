import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import type { RequestWithUser } from '../types/request.types';

// Extracts the authenticated user payload injected by JwtAuthGuard.
// Usage: getMe(@CurrentUser() user: JwtPayload)

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

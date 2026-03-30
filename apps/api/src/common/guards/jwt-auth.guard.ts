import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UserStatus } from '@prisma/client';
import { JwtPayload } from '../../auth/types/jwt-payload.type';
import { RequestWithUser } from '../types/request.types';

// Validates the Bearer JWT, checks JTI blacklist in Redis,
// and rejects suspended/banned accounts.

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@InjectRedis() private readonly redis: Redis) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isValid = await (super.canActivate(context) as Promise<boolean>);
    if (!isValid) return false;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    const blacklisted = await this.redis.get(`token_blacklist:${user.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException({
        type: 'TOKEN_REVOKED',
        title: 'Token Revoked',
        status: 401,
        detail: 'This token has been revoked. Please log in again.',
      });
    }

    if (user.status !== UserStatus.active) {
      throw new ForbiddenException({
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        status: 403,
        detail: `Your account is ${user.status}. Contact support.`,
      });
    }

    return true;
  }

  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: JwtPayload | false | null,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    void info;
    void context;
    void status;

    if (err || !user) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }
    return user as TUser;
  }
}

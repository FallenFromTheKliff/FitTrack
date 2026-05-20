import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { RequestWithUser } from '../types/request.types';

@Injectable()
export class ActiveMemberAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user.role !== UserRole.member) {
      return true;
    }

    if (user.status === UserStatus.active) {
      return true;
    }

    throw new ForbiddenException({
      type: 'ACTIVE_MEMBER_REQUIRED',
      title: 'Active Member Required',
      status: 403,
      detail: 'An active member account is required to use meal logging.',
    });
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import type { RequestWithUser } from '../common/types/request.types';
import { MembershipCardService } from '../membership/card/card.service';

const BRODIGY_ROLES = [
  UserRole.admin,
  UserRole.coach,
  UserRole.staff,
  UserRole.member,
] as const;

@Injectable()
export class BrodigyAccessGuard implements CanActivate {
  constructor(private readonly membershipCardService: MembershipCardService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!BRODIGY_ROLES.includes(user.role)) {
      throw this.buildAccessDeniedException();
    }

    if (user.role !== UserRole.member) {
      return true;
    }

    if (user.status !== UserStatus.active) {
      throw this.buildAccessDeniedException();
    }

    const hasActiveMembershipCard =
      await this.membershipCardService.hasActiveMembershipCardAccess(user.sub);

    if (!hasActiveMembershipCard) {
      throw this.buildAccessDeniedException();
    }

    return true;
  }

  private buildAccessDeniedException(): ForbiddenException {
    return new ForbiddenException({
      type: 'BRODIGY_ACCESS_DENIED',
      title: 'BrodigyAI Access Denied',
      status: 403,
      detail:
        'BrodigyAI requires an active member account or an admin, coach, or staff account.',
    });
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { MembershipCardService } from '../../membership/card/card.service';
import { RequestWithUser } from '../types/request.types';

@Injectable()
export class ActiveMemberCardGuard implements CanActivate {
  constructor(private readonly membershipCardService: MembershipCardService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user.role !== UserRole.member) {
      return true;
    }

    const hasActiveMembershipCard =
      await this.membershipCardService.hasActiveMembershipCardAccess(user.sub);

    if (!hasActiveMembershipCard) {
      throw new ForbiddenException({
        type: 'MEMBERSHIP_CARD_REQUIRED',
        title: 'Active Membership Card Required',
        status: 403,
        detail:
          'An active membership card is required to use this member fitness feature.',
      });
    }

    return true;
  }
}

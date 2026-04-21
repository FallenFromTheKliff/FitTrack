import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { RequestWithUser } from '../types/request.types';

@Injectable()
export class ActiveMemberPlanGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user.role !== UserRole.member) {
      return true;
    }

    const hasActivePlan = await this.subscriptionService.hasActivePlanAccess(
      user.sub,
    );

    if (!hasActivePlan) {
      throw new ForbiddenException({
        type: 'MEMBERSHIP_PLAN_REQUIRED',
        title: 'Active Membership Required',
        status: 403,
        detail:
          'An active membership plan is required to use this premium fitness feature.',
      });
    }

    return true;
  }
}

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { MembershipCardService } from '../membership/card/card.service';
import { BrodigyAccessGuard } from './brodigy-access.guard';

describe('BrodigyAccessGuard', () => {
  const membershipCardService = {
    hasActiveMembershipCardAccess: jest.fn(),
  };

  const buildContext = (user: {
    sub: string;
    role: UserRole;
    status: UserStatus;
  }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  let guard: BrodigyAccessGuard;

  beforeEach(() => {
    guard = new BrodigyAccessGuard(
      membershipCardService as unknown as MembershipCardService,
    );
    jest.clearAllMocks();
  });

  it.each([UserRole.admin, UserRole.coach, UserRole.staff])(
    'allows active operator role %s without membership-card lookup',
    async (role) => {
      await expect(
        guard.canActivate(
          buildContext({
            sub: `${role}-1`,
            role,
            status: UserStatus.active,
          }),
        ),
      ).resolves.toBe(true);

      expect(
        membershipCardService.hasActiveMembershipCardAccess,
      ).not.toHaveBeenCalled();
    },
  );

  it('allows an active member with an active membership card', async () => {
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        buildContext({
          sub: 'member-1',
          role: UserRole.member,
          status: UserStatus.active,
        }),
      ),
    ).resolves.toBe(true);
  });

  it('returns a consistent 403 for an active member without an active card', async () => {
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(
      false,
    );

    const result = guard.canActivate(
      buildContext({
        sub: 'member-1',
        role: UserRole.member,
        status: UserStatus.active,
      }),
    );

    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toMatchObject({
      response: {
        type: 'BRODIGY_ACCESS_DENIED',
        status: 403,
      },
    });
  });

  it('returns a consistent 403 for a pending member before membership lookup', async () => {
    const result = guard.canActivate(
      buildContext({
        sub: 'member-pending-1',
        role: UserRole.member,
        status: UserStatus.pending,
      }),
    );

    await expect(result).rejects.toMatchObject({
      response: {
        type: 'BRODIGY_ACCESS_DENIED',
        status: 403,
      },
    });
    expect(
      membershipCardService.hasActiveMembershipCardAccess,
    ).not.toHaveBeenCalled();
  });
});

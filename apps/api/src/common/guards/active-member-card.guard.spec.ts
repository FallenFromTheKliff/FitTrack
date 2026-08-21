import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ActiveMemberCardGuard } from './active-member-card.guard';

function createExecutionContext(user: {
  role: UserRole;
  sub: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('ActiveMemberCardGuard', () => {
  const membershipCardService = {
    hasActiveMembershipCardAccess: jest.fn(),
  };

  let guard: ActiveMemberCardGuard;

  beforeEach(() => {
    guard = new ActiveMemberCardGuard(membershipCardService as never);
    jest.clearAllMocks();
  });

  it('allows non-member roles without checking membership-card state', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.staff, sub: 'staff-1' }),
      ),
    ).resolves.toBe(true);

    expect(
      membershipCardService.hasActiveMembershipCardAccess,
    ).not.toHaveBeenCalled();
  });

  it('allows member accounts that have an active membership card', async () => {
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        createExecutionContext({ role: UserRole.member, sub: 'user-1' }),
      ),
    ).resolves.toBe(true);

    expect(
      membershipCardService.hasActiveMembershipCardAccess,
    ).toHaveBeenCalledWith('user-1');
  });

  it.each([
    ['missing card', false],
    ['pending card', false],
    ['revoked card', false],
  ])(
    'rejects member accounts with %s',
    async (_label, hasActiveMembershipCard) => {
      membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(
        hasActiveMembershipCard,
      );

      await expect(
        guard.canActivate(
          createExecutionContext({ role: UserRole.member, sub: 'user-1' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    },
  );
});

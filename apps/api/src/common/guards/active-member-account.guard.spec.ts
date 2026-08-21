import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { ActiveMemberAccountGuard } from './active-member-account.guard';

function createExecutionContext(user: {
  role: UserRole;
  status: UserStatus;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('ActiveMemberAccountGuard', () => {
  let guard: ActiveMemberAccountGuard;

  beforeEach(() => {
    guard = new ActiveMemberAccountGuard();
  });

  it('allows non-member roles without checking member status', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.staff,
          status: UserStatus.suspended,
        }),
      ),
    ).toBe(true);
  });

  it('allows active member accounts without requiring a membership card', () => {
    expect(
      guard.canActivate(
        createExecutionContext({
          role: UserRole.member,
          status: UserStatus.active,
        }),
      ),
    ).toBe(true);
  });

  it.each([UserStatus.pending, UserStatus.suspended, UserStatus.banned])(
    'rejects %s member accounts',
    (status) => {
      expect(() =>
        guard.canActivate(
          createExecutionContext({
            role: UserRole.member,
            status,
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );
});

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

import { RolesGuard } from '../common/guards/roles.guard';
import { AdminUsersController } from './admin-users.controller';

describe('AdminUsersController', () => {
  it('allows admin/staff directory access and rejects coach access', () => {
    const guard = new RolesGuard(new Reflector());
    const getAllUsers = AdminUsersController.prototype.getAllUsers;
    const contextFor = (role: UserRole) =>
      ({
        getHandler: () => getAllUsers,
        getClass: () => AdminUsersController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as never;

    expect(guard.canActivate(contextFor(UserRole.admin))).toBe(true);
    expect(guard.canActivate(contextFor(UserRole.staff))).toBe(true);
    expect(() => guard.canActivate(contextFor(UserRole.coach))).toThrow(
      ForbiddenException,
    );
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { ROLES_KEY } from './common/decorators/roles.decorator';
import { RolesGuard } from './common/guards/roles.guard';
import { ACCOUNT_ACTIVITY_EVENT } from './user/events/account-activity.event';
import { AdminDeletionRequestsController } from './admin/admin-deletion-requests.controller';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { UpdateMembershipCardDto } from './admin/dto/admin.dto';

function getHandler(
  controller: object,
  methodName: string,
): Function {
  return Object.getOwnPropertyDescriptor(
    (controller as { constructor: { prototype: object } }).constructor
      .prototype,
    methodName,
  )?.value as Function;
}

function makeRoleContext(
  role: UserRole,
  handler: Function,
  controller: object,
) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
}

function makeMembershipCard(status: 'active' | 'revoked') {
  return {
    activated_at: new Date('2026-08-01T00:00:00.000Z'),
    id: 'card-1',
    purchased_at: new Date('2026-07-01T00:00:00.000Z'),
    revoke_reason: status === 'revoked' ? 'Manual review' : null,
    revoked_at:
      status === 'revoked' ? new Date('2026-08-02T00:00:00.000Z') : null,
    source: 'cash',
    status,
    updated_at: new Date('2026-08-02T00:00:00.000Z'),
    verified_at: new Date('2026-08-01T00:00:00.000Z'),
  };
}

function makeActiveMember() {
  return {
    id: 'member-1',
    role: UserRole.member,
    status: UserStatus.active,
    qr_code_token: 'member-qr-token',
    deletedAt: null,
    auth_identities: [
      {
        identifier: 'member@fittrack.test',
        is_primary: true,
        provider: AuthProvider.email,
      },
    ],
    membership_card: makeMembershipCard('active'),
    profile: { first_name: 'Member', last_name: 'One' },
  };
}

describe('Terra lifecycle repair contract', () => {
  it.each([
    [UserRole.admin, true],
    [UserRole.staff, true],
    [UserRole.member, false],
    [UserRole.coach, false],
  ])(
    'allows account managers and forbids other roles from rejecting termination requests: %s',
    (role, allowed) => {
      const handler = getHandler(
        AdminDeletionRequestsController.prototype,
        'rejectDeletionRequest',
      );
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];
      const guard = new RolesGuard(new Reflector());

      expect(roles).toEqual([UserRole.admin, UserRole.staff]);
      if (allowed) {
        expect(
          guard.canActivate(
            makeRoleContext(role, handler, AdminDeletionRequestsController),
          ),
        ).toBe(true);
      } else {
        expect(() =>
          guard.canActivate(
            makeRoleContext(role, handler, AdminDeletionRequestsController),
          ),
        ).toThrow(ForbiddenException);
      }
    },
  );

  it('forwards staff rejection through the deletion-request controller', async () => {
    const deletionService = {
      reject: jest.fn().mockResolvedValue({
        message: 'Deletion request rejected',
      }),
    };
    const controller = new AdminDeletionRequestsController(
      deletionService as never,
    );

    await expect(
      controller.rejectDeletionRequest(
        'request-1',
        { sub: 'staff-1' } as never,
        { reviewNotes: 'Keep account active.' } as never,
      ),
    ).resolves.toEqual({ message: 'Deletion request rejected' });
    expect(deletionService.reject).toHaveBeenCalledWith(
      'request-1',
      'staff-1',
      'Keep account active.',
    );
  });

  it('forwards the documented remove membership operation through the controller', async () => {
    const usersService = {
      updateMembershipCard: jest.fn().mockResolvedValue({
        membershipCard: null,
        message: 'Membership removed. Account is now a non-member.',
      }),
    };
    const controller = new AdminUsersController(usersService as never);
    const dto = Object.assign(new UpdateMembershipCardDto(), {
      action: 'remove',
      reason: 'Account module repair',
    });

    await expect(
      controller.updateMembershipCard(
        'member-1',
        dto,
        { sub: 'staff-1' } as never,
      ),
    ).resolves.toEqual({
      membershipCard: null,
      message: 'Membership removed. Account is now a non-member.',
    });
    expect(usersService.updateMembershipCard).toHaveBeenCalledWith(
      'member-1',
      dto,
      'staff-1',
    );
  });

  describe('membership-card service semantics', () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      membershipCard: {
        delete: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('removes active membership access without banning or archiving the account', async () => {
      prisma.user.findUnique.mockResolvedValue(makeActiveMember());
      prisma.membershipCard.delete.mockResolvedValue({ id: 'card-1' });
      const service = new AdminUsersService(
        prisma as never,
        eventEmitter as never,
      );

      await expect(
        service.updateMembershipCard(
          'member-1',
          { action: 'remove', reason: 'Account module repair' },
          'staff-1',
        ),
      ).resolves.toEqual({
        membershipCard: null,
        message: 'Membership removed. Account is now a non-member.',
      });

      expect(prisma.membershipCard.delete).toHaveBeenCalledWith({
        where: { user_id: 'member-1' },
      });
      expect(prisma.membershipCard.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        ACCOUNT_ACTIVITY_EVENT,
        expect.objectContaining({
          action: 'membership_card_removed',
          actorId: 'staff-1',
        }),
      );
    });

    it('keeps revoke distinct from remove by retaining the card as revoked access', async () => {
      prisma.user.findUnique.mockResolvedValue(makeActiveMember());
      prisma.membershipCard.update.mockResolvedValue(
        makeMembershipCard('revoked'),
      );
      const service = new AdminUsersService(
        prisma as never,
        eventEmitter as never,
      );

      await expect(
        service.updateMembershipCard(
          'member-1',
          { action: 'revoke', reason: 'Manual review' },
          'staff-1',
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          message: 'Membership card access revoked.',
          membershipCard: expect.objectContaining({ status: 'revoked' }),
        }),
      );

      expect(prisma.membershipCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'member-1' },
          data: expect.objectContaining({
            status: 'revoked',
            revoke_reason: 'Manual review',
          }),
        }),
      );
      expect(prisma.membershipCard.delete).not.toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        ACCOUNT_ACTIVITY_EVENT,
        expect.objectContaining({
          action: 'membership_card_revoked',
          actorId: 'staff-1',
        }),
      );
    });
  });
});

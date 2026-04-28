import {
  AccountDeletionRequestStatus,
  AuthProvider,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  const prisma = {
    accountDeletionRequest: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membershipCard: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    coachProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AdminUsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminUsersService(prisma as never);
  });

  it('maps directory users without fake memberships for non-member roles', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        role: UserRole.admin,
        status: UserStatus.active,
        qr_code_token: null,
        email_verified_at: new Date('2026-04-01T00:00:00.000Z'),
        deletedAt: null,
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        updated_at: new Date('2026-03-02T00:00:00.000Z'),
        auth_identities: [
          {
            provider: AuthProvider.email,
            identifier: 'admin@fittrack.test',
            is_primary: true,
          },
        ],
        attendance_logs: [],
        membership_card: null,
        profile: {
          first_name: 'Sera',
          last_name: 'Admin',
          date_of_birth: null,
          gender: null,
          activity_level: null,
          fitness_goal: null,
          weight_kg: null,
          height_cm: null,
          avatar_url: 'https://cdn.fittrack.test/sera-admin.png',
          phone: '09171111111',
        },
      },
      {
        id: 'member-1',
        role: UserRole.member,
        status: UserStatus.pending,
        qr_code_token: 'member-qr-token',
        email_verified_at: null,
        deletedAt: null,
        created_at: new Date('2026-03-03T00:00:00.000Z'),
        updated_at: new Date('2026-03-04T00:00:00.000Z'),
        auth_identities: [
          {
            provider: AuthProvider.email,
            identifier: 'member@fittrack.test',
            is_primary: true,
          },
        ],
        attendance_logs: [],
        membership_card: {
          activated_at: new Date('2026-03-03T02:00:00.000Z'),
          purchased_at: new Date('2026-03-03T00:00:00.000Z'),
          revoke_reason: null,
          revoked_at: null,
          source: 'paymongo',
          status: 'active',
          updated_at: new Date('2026-03-04T00:00:00.000Z'),
          verified_at: new Date('2026-03-03T01:00:00.000Z'),
        },
        profile: {
          first_name: 'Ava',
          last_name: 'Rivera',
          date_of_birth: null,
          gender: null,
          activity_level: 'moderate',
          fitness_goal: 'maintenance',
          weight_kg: null,
          height_cm: null,
          avatar_url: null,
          phone: '09172222222',
        },
      },
    ]);

    await expect(service.getAll()).resolves.toEqual([
      {
        id: 'admin-1',
        email: 'admin@fittrack.test',
        phone_no: '09171111111',
        role: { id: 1, name: 'ADMIN' },
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        lastCheckInAt: null,
        membershipCard: null,
        qrCodeReady: false,
        attendanceQrReady: false,
        updatedAt: '2026-03-02T00:00:00.000Z',
        profile: {
          firstName: 'Sera',
          lastName: 'Admin',
          dateOfBirth: null,
          gender: null,
          activityLevel: null,
          fitnessGoal: null,
          currentWeightKg: null,
          heightCm: null,
          avatarUrl: 'https://cdn.fittrack.test/sera-admin.png',
          membershipType: null,
        },
      },
      {
        id: 'member-1',
        email: 'member@fittrack.test',
        phone_no: '09172222222',
        role: { id: 4, name: 'USER' },
        status: 'pending',
        emailVerified: false,
        phoneVerified: false,
        deletedAt: null,
        createdAt: '2026-03-03T00:00:00.000Z',
        lastCheckInAt: null,
        membershipCard: {
          activatedAt: '2026-03-03T02:00:00.000Z',
          purchasedAt: '2026-03-03T00:00:00.000Z',
          revokeReason: null,
          revokedAt: null,
          source: 'paymongo',
          status: 'active',
          updatedAt: '2026-03-04T00:00:00.000Z',
          verifiedAt: '2026-03-03T01:00:00.000Z',
        },
        qrCodeReady: true,
        attendanceQrReady: true,
        updatedAt: '2026-03-04T00:00:00.000Z',
        profile: {
          firstName: 'Ava',
          lastName: 'Rivera',
          dateOfBirth: null,
          gender: null,
          activityLevel: 'moderate',
          fitnessGoal: 'maintenance',
          currentWeightKg: null,
          heightCm: null,
          avatarUrl: null,
          membershipType: 'member',
        },
      },
    ]);
  });

  it('keeps QR unavailable when the membership card is pending or revoked', async () => {
    prisma.user.findMany.mockResolvedValue(
      ['pending_verification', 'revoked'].map((status, index) => ({
        id: `member-${index + 1}`,
        role: UserRole.member,
        status: UserStatus.active,
        qr_code_token: `member-qr-token-${index + 1}`,
        email_verified_at: null,
        deletedAt: null,
        created_at: new Date('2026-03-03T00:00:00.000Z'),
        updated_at: new Date('2026-03-04T00:00:00.000Z'),
        auth_identities: [
          {
            provider: AuthProvider.email,
            identifier: `member-${index + 1}@fittrack.test`,
            is_primary: true,
          },
        ],
        attendance_logs: [],
        membership_card: {
          activated_at: null,
          purchased_at: new Date('2026-03-03T00:00:00.000Z'),
          revoke_reason: status === 'revoked' ? 'Manual review failed' : null,
          revoked_at:
            status === 'revoked' ? new Date('2026-03-04T01:00:00.000Z') : null,
          source: 'cash',
          status,
          updated_at: new Date('2026-03-04T00:00:00.000Z'),
          verified_at: null,
        },
        profile: {
          first_name: 'Ava',
          last_name: 'Rivera',
          date_of_birth: null,
          gender: null,
          activity_level: null,
          fitness_goal: null,
          weight_kg: null,
          height_cm: null,
          avatar_url: null,
          phone: '09172222222',
        },
      })),
    );

    const result = await service.getAll();

    expect(result).toHaveLength(2);
    expect(result.map((member) => member.qrCodeReady)).toEqual([true, true]);
    expect(result.map((member) => member.attendanceQrReady)).toEqual([
      false,
      false,
    ]);
    expect(result.map((member) => member.membershipCard?.status)).toEqual([
      'pending_verification',
      'revoked',
    ]);
  });

  it('promotes pending member accounts when granting membership-card access', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      status: UserStatus.pending,
      qr_code_token: null,
      deletedAt: null,
      auth_identities: [
        {
          provider: AuthProvider.email,
          identifier: 'member@fittrack.test',
          is_primary: true,
        },
      ],
      membership_card: null,
    });
    prisma.$transaction.mockImplementation(
      (
        callback: (tx: {
          membershipCard: {
            upsert: typeof prisma.membershipCard.upsert;
          };
          user: { update: typeof prisma.user.update };
        }) => unknown,
      ) =>
        callback({
          membershipCard: {
            upsert: prisma.membershipCard.upsert,
          },
          user: {
            update: prisma.user.update,
          },
        }),
    );
    prisma.membershipCard.upsert.mockResolvedValue({
      activated_at: new Date('2026-04-28T10:00:00.000Z'),
      purchased_at: new Date('2026-04-28T09:00:00.000Z'),
      revoke_reason: null,
      revoked_at: null,
      source: 'admin_grant',
      status: 'active',
      updated_at: new Date('2026-04-28T10:00:00.000Z'),
      verified_at: new Date('2026-04-28T10:00:00.000Z'),
    });
    prisma.user.update.mockResolvedValue({
      id: 'member-1',
      status: UserStatus.active,
      qr_code_token: 'generated-qr-token',
    });

    const result = await service.updateMembershipCard(
      'member-1',
      { action: 'grant' },
      'admin-1',
    );

    expect(prisma.membershipCard.upsert).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: expect.objectContaining({
        status: UserStatus.active,
        qr_code_token: expect.any(String),
      }),
    });
    expect(result).toEqual({
      membershipCard: {
        activatedAt: '2026-04-28T10:00:00.000Z',
        purchasedAt: '2026-04-28T09:00:00.000Z',
        revokeReason: null,
        revokedAt: null,
        source: 'admin_grant',
        status: 'active',
        updatedAt: '2026-04-28T10:00:00.000Z',
        verifiedAt: '2026-04-28T10:00:00.000Z',
      },
      message: 'Membership card access granted.',
    });
  });

  it('soft deletes eligible directory users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValue({
      id: 'member-1',
      deletedAt: new Date('2026-04-10T00:00:00.000Z'),
    });

    await expect(
      service.softDeleteUser('member-1', 'admin-1'),
    ).resolves.toEqual({
      message: 'User archived successfully',
      user: {
        id: 'member-1',
        deletedAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    });
  });

  it('blocks archiving the signed-in admin account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: UserRole.admin,
      deletedAt: null,
    });

    await expect(service.softDeleteUser('admin-1', 'admin-1')).rejects.toThrow(
      'You cannot archive your own account from the members directory',
    );
  });

  it('restores archived users and cancels any pending deletion request', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      deletedAt: new Date('2026-04-10T00:00:00.000Z'),
    });
    prisma.accountDeletionRequest.findFirst.mockResolvedValue({
      id: 'request-1',
    });
    prisma.$transaction.mockImplementation(
      (
        callback: (tx: {
          accountDeletionRequest: {
            update: typeof prisma.accountDeletionRequest.update;
          };
          user: { update: typeof prisma.user.update };
        }) => unknown,
      ) =>
        callback({
          accountDeletionRequest: {
            update: prisma.accountDeletionRequest.update,
          },
          user: {
            update: prisma.user.update,
          },
        }),
    );
    prisma.accountDeletionRequest.update.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.cancelled,
    });
    prisma.user.update.mockResolvedValue({
      id: 'member-1',
      deletedAt: null,
    });

    await expect(service.restoreUser('member-1', 'admin-1')).resolves.toEqual({
      message: 'User restored successfully',
      user: {
        id: 'member-1',
        deletedAt: null,
      },
    });
  });
});

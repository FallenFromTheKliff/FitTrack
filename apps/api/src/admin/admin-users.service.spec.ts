import {
  AccountDeletionRequestStatus,
  AuthProvider,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
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
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    coachProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  let service: AdminUsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([]);
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
        restoredAt: null,
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
        restoredAt: null,
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

  it('limits coach directory reads to member accounts', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.getAll(UserRole.coach);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: UserRole.member },
      }),
    );
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

  it('maps the latest restore timestamp from account activity notifications', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'member-1',
        role: UserRole.member,
        status: UserStatus.active,
        qr_code_token: null,
        email_verified_at: null,
        deletedAt: null,
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
        auth_identities: [],
        attendance_logs: [],
        membership_card: null,
        profile: null,
      },
    ]);
    const restoredActivityRows: Array<{
      occurredAt: Date;
      targetUserId: string;
    }> = [
      {
        occurredAt: new Date('2026-04-30T08:15:00.000Z'),
        targetUserId: 'member-1',
      },
    ];
    prisma.$queryRaw.mockResolvedValue(restoredActivityRows);

    await expect(service.getAll()).resolves.toEqual([
      expect.objectContaining({
        id: 'member-1',
        restoredAt: '2026-04-30T08:15:00.000Z',
      }),
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
          payment: {
            create: typeof prisma.payment.create;
            findFirst: typeof prisma.payment.findFirst;
            update: typeof prisma.payment.update;
          };
          user: { update: typeof prisma.user.update };
        }) => unknown,
      ) =>
        callback({
          membershipCard: {
            upsert: prisma.membershipCard.upsert,
          },
          payment: {
            create: prisma.payment.create,
            findFirst: prisma.payment.findFirst,
            update: prisma.payment.update,
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
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      amount: new Prisma.Decimal(400),
      id: 'payment-1',
      payable_id: 'card-1',
      payable_type: PayableType.membership_card,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      verified_at: new Date('2026-04-28T10:00:00.000Z'),
      verified_by: 'admin-1',
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
    const updateCalls = (
      prisma.user.update as unknown as {
        mock: {
          calls: Array<
            [
              {
                data: {
                  qr_code_token: string;
                  status: UserStatus;
                };
                where: { id: string };
              },
            ]
          >;
        };
      }
    ).mock.calls;
    const updateArgs = updateCalls[0]?.[0];
    expect(updateArgs?.where).toEqual({ id: 'member-1' });
    expect(updateArgs?.data.status).toBe(UserStatus.active);
    expect(updateArgs?.data.qr_code_token).toEqual(expect.any(String));
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: new Prisma.Decimal(400),
        payable_type: PayableType.membership_card,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.cash,
        status: PaymentStatus.completed,
        user: { connect: { id: 'member-1' } },
        verifier: { connect: { id: 'admin-1' } },
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
      service.softDeleteUser('member-1', 'admin-1', UserRole.admin),
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

    await expect(
      service.softDeleteUser('admin-1', 'admin-1', UserRole.admin),
    ).rejects.toThrow(
      'You cannot archive your own account from the members directory',
    );
  });

  it('blocks staff from archiving staff accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-2',
      role: UserRole.staff,
      deletedAt: null,
    });

    await expect(
      service.softDeleteUser('staff-2', 'staff-1', UserRole.staff),
    ).rejects.toThrow('Staff accounts can archive member accounts only');
  });

  it('restores archived users and cancels any pending deletion request', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: new Date('2026-04-10T00:00:00.000Z'),
      membership_card: null,
      auth_identities: [],
      profile: null,
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
          membershipCard: { update: typeof prisma.membershipCard.update };
          user: { update: typeof prisma.user.update };
        }) => unknown,
      ) =>
        callback({
          accountDeletionRequest: {
            update: prisma.accountDeletionRequest.update,
          },
          membershipCard: {
            update: prisma.membershipCard.update,
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

    const result = await service.restoreUser(
      'member-1',
      'admin-1',
      UserRole.admin,
    );

    expect(result.message).toBe('User restored successfully');
    expect(result.user.id).toBe('member-1');
    expect(result.user.deletedAt).toBeNull();
    expect(typeof result.user.restoredAt).toBe('string');
  });

  it('blocks staff from restoring staff accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-2',
      role: UserRole.staff,
      deletedAt: new Date('2026-04-10T00:00:00.000Z'),
      membership_card: null,
      auth_identities: [],
      profile: null,
    });

    await expect(
      service.restoreUser('staff-2', 'staff-1', UserRole.staff),
    ).rejects.toThrow(
      'Staff accounts can restore member and non-member accounts only',
    );
  });
});

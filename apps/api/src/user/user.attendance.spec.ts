import {
  AttendanceAccessSource,
  AttendanceCheckInMethod,
} from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { UserRepository, getManilaGymDay } from './user.repository';

function makeTransaction() {
  const tx = {
    $executeRaw: jest.fn(),
    accountDeletionRequest: { findFirst: jest.fn() },
    attendanceLog: { create: jest.fn(), findFirst: jest.fn() },
    payment: { count: jest.fn() },
    subscription: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { prisma, tx };
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    deletedAt: null,
    email_verified_at: new Date('2026-08-01T00:00:00.000Z'),
    free_day_pass_expires_at: null,
    free_day_pass_granted_at: null,
    free_day_pass_redeemed_at: null,
    free_day_pass_revoked_at: null,
    id: 'member-1',
    membership_card: null,
    phone_verified_at: null,
    profile: { first_name: 'Mina', last_name: 'Santos' },
    role: 'member',
    status: 'active',
    ...overrides,
  };
}

describe('UserRepository authorized attendance', () => {
  it('uses the Asia/Manila calendar day across UTC midnight', () => {
    expect(getManilaGymDay(new Date('2026-08-27T15:59:59.000Z'))).toEqual(
      new Date('2026-08-27T00:00:00.000Z'),
    );
    expect(getManilaGymDay(new Date('2026-08-27T16:00:00.000Z'))).toEqual(
      new Date('2026-08-28T00:00:00.000Z'),
    );
  });

  it('rejects a second check-in for the same Manila gym day before resolving access', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-27T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValue(member());
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue({ id: 'attendance-existing' });

    await expect(
      repository.createAuthorizedAttendance({
        method: AttendanceCheckInMethod.qr,
        now,
        scannerId: 'staff-1',
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        title: 'Already Checked In',
        type: 'ALREADY_CHECKED_IN',
      },
    });

    expect(tx.subscription.findMany).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.attendanceLog.create).not.toHaveBeenCalled();
  });

  it('records a reusable membership check-in with explicit provenance', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-27T10:00:00.000Z');
    const log = { id: 'attendance-1', user_id: 'member-1', check_in_at: now };
    tx.user.findUnique.mockResolvedValue(member());
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([
      {
        access_consumed_at: null,
        created_at: now,
        duration_days_snapshot: 30,
        expires_at: new Date('2026-09-26T10:00:00.000Z'),
        id: 'subscription-1',
        plan: { duration_days: 30 },
      },
    ]);
    tx.attendanceLog.create.mockResolvedValue(log);

    const result = await repository.createAuthorizedAttendance({
      method: AttendanceCheckInMethod.manual,
      now,
      scannerId: 'staff-1',
      userId: 'member-1',
    });

    expect(result.access_source).toBe(AttendanceAccessSource.gym_membership);
    expect(tx.attendanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        access_source: AttendanceAccessSource.gym_membership,
        check_in_method: AttendanceCheckInMethod.manual,
        gym_day: new Date('2026-08-27T00:00:00.000Z'),
        subscription: { connect: { id: 'subscription-1' } },
      }),
    });
  });

  it('consumes a paid one-day pass exactly when the check-in is created', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-27T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValue(member());
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([
      {
        access_consumed_at: null,
        created_at: now,
        duration_days_snapshot: 1,
        expires_at: new Date('2026-08-28T10:00:00.000Z'),
        id: 'subscription-day-pass',
        plan: { duration_days: 1 },
      },
    ]);
    tx.subscription.updateMany.mockResolvedValue({ count: 1 });
    tx.attendanceLog.create.mockResolvedValue({
      id: 'attendance-day-pass',
      user_id: 'member-1',
      check_in_at: now,
    });

    const result = await repository.createAuthorizedAttendance({
      method: AttendanceCheckInMethod.qr,
      now,
      scannerId: 'staff-1',
      userId: 'member-1',
    });

    expect(result.access_source).toBe(AttendanceAccessSource.paid_one_day_pass);
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      data: { access_consumed_at: now, status: 'expired' },
      where: expect.objectContaining({
        access_consumed_at: null,
        id: 'subscription-day-pass',
      }),
    });
  });

  it('redeems the free pass only for the first eligible QR check-in', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-27T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValueOnce(
      member({
        free_day_pass_expires_at: new Date('2026-08-28T10:00:00.000Z'),
        free_day_pass_granted_at: new Date('2026-08-27T10:00:00.000Z'),
      }),
    );
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([]);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.attendanceLog.create.mockResolvedValue({
      id: 'attendance-free',
      user_id: 'member-1',
      check_in_at: now,
    });

    const result = await repository.createAuthorizedAttendance({
      method: AttendanceCheckInMethod.qr,
      now,
      scannerId: 'staff-1',
      userId: 'member-1',
    });

    expect(result.access_source).toBe(AttendanceAccessSource.free_one_day_pass);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      data: { free_day_pass_redeemed_at: now },
      where: {
        free_day_pass_expires_at: { gt: now },
        free_day_pass_granted_at: { not: null },
        free_day_pass_redeemed_at: null,
        free_day_pass_revoked_at: null,
        id: 'member-1',
      },
    });
    expect(tx.payment.count).not.toHaveBeenCalled();
  });

  it('never redeems the free pass for manual check-in', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    tx.user.findUnique.mockResolvedValue(member());
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([]);

    await expect(
      repository.createAuthorizedAttendance({
        method: AttendanceCheckInMethod.manual,
        scannerId: 'staff-1',
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: {
        detail:
          'No active Gym Membership. Record a cash membership from the Memberships page or ask the member to purchase a plan through the app.',
      },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.attendanceLog.create).not.toHaveBeenCalled();
  });

  it('does not redeem a previously redeemed free pass on a later QR check-in', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-28T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValueOnce(
      member({
        free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
        free_day_pass_granted_at: new Date('2026-08-27T10:00:00.000Z'),
        free_day_pass_redeemed_at: new Date('2026-08-27T10:00:00.000Z'),
      }),
    );
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([]);
    await expect(
      repository.createAuthorizedAttendance({
        method: AttendanceCheckInMethod.qr,
        now,
        scannerId: 'staff-1',
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        type: 'NO_ACTIVE_GYM_MEMBERSHIP',
      },
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.attendanceLog.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'expired',
      fields: {
        free_day_pass_expires_at: new Date('2026-08-28T09:59:59.000Z'),
        free_day_pass_granted_at: new Date('2026-08-27T10:00:00.000Z'),
      },
    },
    {
      label: 'revoked',
      fields: {
        free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
        free_day_pass_granted_at: new Date('2026-08-28T09:00:00.000Z'),
        free_day_pass_revoked_at: new Date('2026-08-28T09:30:00.000Z'),
      },
    },
  ])('does not accept an explicitly $label free pass', async ({ fields }) => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-28T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValue(member(fields));
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([]);

    await expect(
      repository.createAuthorizedAttendance({
        method: AttendanceCheckInMethod.qr,
        now,
        scannerId: 'staff-1',
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: { status: 409, type: 'NO_ACTIVE_GYM_MEMBERSHIP' },
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.attendanceLog.create).not.toHaveBeenCalled();
  });

  it('keeps the free pass separate from Membership Card access', async () => {
    const { prisma, tx } = makeTransaction();
    const repository = new UserRepository(prisma);
    const now = new Date('2026-08-28T10:00:00.000Z');
    tx.user.findUnique.mockResolvedValueOnce(
      member({
        free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
        free_day_pass_granted_at: new Date('2026-08-28T10:00:00.000Z'),
        membership_card: null,
      }),
    );
    tx.accountDeletionRequest.findFirst.mockResolvedValue(null);
    tx.attendanceLog.findFirst.mockResolvedValue(null);
    tx.subscription.findMany.mockResolvedValue([]);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.attendanceLog.create.mockResolvedValue({
      id: 'attendance-free-card-separate',
      user_id: 'member-1',
      check_in_at: now,
    });

    const result = await repository.createAuthorizedAttendance({
      method: AttendanceCheckInMethod.qr,
      now,
      scannerId: 'staff-1',
      userId: 'member-1',
    });

    expect(result.access_source).toBe(AttendanceAccessSource.free_one_day_pass);
    expect(tx.user.updateMany).toHaveBeenCalled();
    expect(tx.attendanceLog.create).toHaveBeenCalled();
  });
});

import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  RecurringCoachingPlanStatus,
} from '@prisma/client';

import { RecurringCoachingPlanRepository } from './recurring-coaching-plan.repository';

describe('RecurringCoachingPlanRepository', () => {
  const enrollmentInput = {
    coachId: 'coach-1',
    memberId: 'member-1',
  };

  const createEnrollmentPrisma = (
    planResults: unknown[],
    holdResult: unknown,
  ) => ({
    recurringCoachingPlan: {
      findFirst: jest.fn()
        .mockResolvedValueOnce(planResults[0] ?? null)
        .mockResolvedValueOnce(planResults[1] ?? null),
    },
    commerceCheckoutHold: {
      findFirst: jest.fn().mockResolvedValue(holdResult),
    },
  });

  const staffEnrollmentInput = {
    actorId: 'staff-1',
    amount: new Prisma.Decimal('12000'),
    coachId: 'coach-1',
    durationMinutes: 60,
    endDate: new Date('2026-05-31T00:00:00.000Z'),
    idempotencyKey: 'cash-enrollment-1',
    memberId: 'member-1',
    preferredDays: [1],
    preferredTime: new Date('1970-01-01T09:00:00.000Z'),
    sessionCount: 4,
    startDate: new Date('2026-05-01T00:00:00.000Z'),
  };

  it('ignores stale awaiting-payment plans without a live checkout hold', async () => {
    const prisma = createEnrollmentPrisma(
      [
        null,
        { id: 'legacy-plan-1', status: RecurringCoachingPlanStatus.awaiting_payment },
      ],
      null,
    );

    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.findMemberCoachEnrollment(enrollmentInput),
    ).resolves.toBeNull();
    expect(prisma.commerceCheckoutHold.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coach_id: 'coach-1',
          kind: CommerceCheckoutHoldKind.monthly,
          status: CommerceCheckoutHoldStatus.held,
          user_id: 'member-1',
          payment: {
            is: expect.objectContaining({
              payable_type: PayableType.commerce_checkout_hold,
              payment_stage: PaymentStage.full,
              provider: PaymentProvider.paymongo,
              status: {
                in: [PaymentStatus.pending, PaymentStatus.processing],
              },
            }),
          },
        }),
      }),
    );
  });

  it('reconciles an awaiting-payment plan only when its hold and payment are live', async () => {
    const awaitingPlan = {
      id: 'legacy-plan-1',
      status: RecurringCoachingPlanStatus.awaiting_payment,
    };
    const now = new Date(Date.now() + 60 * 60 * 1000);
    const prisma = createEnrollmentPrisma(
      [null, awaitingPlan],
      {
        id: 'hold-1',
        appointment_id: null,
        booking_id: null,
        expires_at: now,
        membership_card_id: null,
        recurring_plan_id: null,
        status: CommerceCheckoutHoldStatus.held,
        subscription_id: null,
        payment: {
          payable_id: 'hold-1',
          payable_type: PayableType.commerce_checkout_hold,
          payment_stage: PaymentStage.full,
          provider: PaymentProvider.paymongo,
          status: PaymentStatus.pending,
        },
      },
    );
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.findMemberCoachEnrollment(enrollmentInput),
    ).resolves.toBe(awaitingPlan);
  });

  it.each([
    CommerceCheckoutHoldStatus.expired,
    CommerceCheckoutHoldStatus.failed,
  ])('does not reconcile a terminal %s hold as a live awaiting enrollment', async (status) => {
    const prisma = createEnrollmentPrisma(
      [
        null,
        { id: 'legacy-plan-1', status: RecurringCoachingPlanStatus.awaiting_payment },
      ],
      {
        id: 'hold-terminal',
        appointment_id: null,
        booking_id: null,
        expires_at: new Date('2020-01-01T00:00:00.000Z'),
        membership_card_id: null,
        recurring_plan_id: null,
        status,
        subscription_id: null,
        payment: {
          payable_id: 'hold-terminal',
          payable_type: PayableType.commerce_checkout_hold,
          payment_stage: PaymentStage.full,
          provider: PaymentProvider.paymongo,
          status: PaymentStatus.failed,
        },
      },
    );
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.findMemberCoachEnrollment(enrollmentInput),
    ).resolves.toBeNull();
  });

  it('maps a concurrent active-pair unique violation to an actionable conflict', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate active pair', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['coach_id', 'member_id'] },
      }),
    );
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.createPlanWithSessions({} as never),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Another recurring coaching enrollment for this coach and member was created concurrently. Refresh and continue with the existing enrollment.',
        status: 409,
        title: 'Recurring Coaching Enrollment Already Exists',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('blocks staff cash enrollment when the member already has another active plan', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      recurringCoachingPlan: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'active-plan-1' }),
      },
      commerceCheckoutHold: { findFirst: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.createStaffCashEnrollment(staffEnrollmentInput),
    ).rejects.toMatchObject({
      response: {
        conflict_kind: 'active_entitlement',
        status: 409,
        type: 'RECURRING_COACHING_ACTIVE_ENTITLEMENT',
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.recurringCoachingPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          member_id: 'member-1',
        }),
      }),
    );
    expect(tx.commerceCheckoutHold.findFirst).not.toHaveBeenCalled();
  });

  it('blocks staff cash enrollment when another monthly checkout is live', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      recurringCoachingPlan: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      commerceCheckoutHold: {
        findFirst: jest.fn().mockResolvedValue({ id: 'live-hold-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.createStaffCashEnrollment(staffEnrollmentInput),
    ).rejects.toMatchObject({
      response: {
        conflict_kind: 'live_checkout',
        status: 409,
        type: 'RECURRING_COACHING_ACTIVE_ENTITLEMENT',
      },
    });
    expect(tx.commerceCheckoutHold.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: CommerceCheckoutHoldKind.monthly,
          user_id: 'member-1',
          payment: { is: expect.any(Object) },
        }),
      }),
    );
  });

  it('maps the member-wide active unique index to the entitlement conflict', async () => {
    const prisma = { $transaction: jest.fn() };
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate active member', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: 'recurring_coaching_plans_active_member_unique' },
      }),
    );
    const repository = new RecurringCoachingPlanRepository(prisma as never);

    await expect(
      repository.createStaffCashEnrollment(staffEnrollmentInput),
    ).rejects.toMatchObject({
      response: {
        conflict_kind: 'active_entitlement',
        status: 409,
        type: 'RECURRING_COACHING_ACTIVE_ENTITLEMENT',
      },
    });
  });
});

import { ConflictException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppointmentRepository } from './appointment.repository';

describe('AppointmentRepository', () => {
  const coachProfile = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  };

  const coachAvailabilitySlot = {
    updateMany: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
  };

  const coachAppointment = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  };

  const prisma = {
    coachProfile,
    coachAvailabilitySlot,
    coachAppointment,
    $transaction: jest.fn(),
  };

  let repo: AppointmentRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repo = new AppointmentRepository(prisma as never);
  });

  it('replaces active availability inside one transaction', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    await repo.replaceAvailabilitySlots({
      coachId: 'coach-1',
      slots: [
        {
          dayOfWeek: 1,
          startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)),
        },
      ],
    });

    expect(coachAvailabilitySlot.updateMany).toHaveBeenCalledWith({
      where: { coach_id: 'coach-1', is_active: true },
      data: { is_active: false },
    });
    expect(coachAvailabilitySlot.createMany).toHaveBeenCalledWith({
      data: [
        {
          coach_id: 'coach-1',
          day_of_week: 1,
          start_time: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
          end_time: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)),
          is_active: true,
        },
      ],
    });
  });

  it('loads the active coach profile id by user id', async () => {
    coachProfile.findFirst.mockResolvedValue({ id: 'coach-1' });

    await expect(
      repo.findCoachByUserIdOrThrow('coach-user-1'),
    ).resolves.toEqual({ id: 'coach-1' });

    expect(coachProfile.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'coach-user-1',
        user: {
          role: 'coach',
          status: 'active',
        },
      },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('creates pending coach appointments when slot and conflict checks pass', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    coachAvailabilitySlot.findFirst.mockResolvedValue({ id: 'slot-1' });
    coachAppointment.findMany.mockResolvedValue([]);
    coachAppointment.create.mockResolvedValue({ id: 'appt-1' });

    await repo.createPendingAppointment({
      userId: 'member-1',
      coachId: 'coach-1',
      scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
      appointmentEndsAt: new Date('2099-04-01T09:00:00.000Z'),
      dayOfWeek: 3,
      slotStart: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
      slotEnd: new Date(Date.UTC(1970, 0, 1, 9, 0, 0, 0)),
      durationMinutes: 60,
      isFreeSession: false,
      totalAmount: new Prisma.Decimal('1200.00'),
      downpaymentAmount: new Prisma.Decimal('360.00'),
      balanceAmount: new Prisma.Decimal('840.00'),
      gymRevenue: new Prisma.Decimal('240.00'),
      coachEarnings: new Prisma.Decimal('960.00'),
      memberNotes: 'Focus on mobility.',
    });

    const createCalls = coachAppointment.create.mock.calls as Array<
      [
        {
          data: {
            status: string;
            is_free_session: boolean;
            duration_minutes: number;
          };
        },
      ]
    >;
    const createArgs = createCalls[0]?.[0] as {
      data: {
        status: string;
        is_free_session: boolean;
        duration_minutes: number;
      };
    };

    expect(createArgs?.data.status).toBe('pending_coach');
    expect(createArgs?.data.is_free_session).toBe(false);
    expect(createArgs?.data.duration_minutes).toBe(60);
  });

  it('throws when no active slot covers the requested appointment window', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    coachAvailabilitySlot.findFirst.mockResolvedValue(null);

    await expect(
      repo.createPendingAppointment({
        userId: 'member-1',
        coachId: 'coach-1',
        scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
        appointmentEndsAt: new Date('2099-04-01T09:00:00.000Z'),
        dayOfWeek: 3,
        slotStart: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
        slotEnd: new Date(Date.UTC(1970, 0, 1, 9, 0, 0, 0)),
        durationMinutes: 60,
        isFreeSession: false,
        totalAmount: new Prisma.Decimal('1200.00'),
        downpaymentAmount: new Prisma.Decimal('360.00'),
        balanceAmount: new Prisma.Decimal('840.00'),
        gymRevenue: new Prisma.Decimal('240.00'),
        coachEarnings: new Prisma.Decimal('960.00'),
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('throws when another active appointment overlaps the requested slot', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    coachAvailabilitySlot.findFirst.mockResolvedValue({ id: 'slot-1' });
    coachAppointment.findMany.mockResolvedValue([
      {
        id: 'appt-existing',
        scheduled_at: new Date('2099-04-01T08:30:00.000Z'),
        duration_minutes: 60,
      },
    ]);

    await expect(
      repo.createPendingAppointment({
        userId: 'member-1',
        coachId: 'coach-1',
        scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
        appointmentEndsAt: new Date('2099-04-01T09:00:00.000Z'),
        dayOfWeek: 3,
        slotStart: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
        slotEnd: new Date(Date.UTC(1970, 0, 1, 9, 0, 0, 0)),
        durationMinutes: 60,
        isFreeSession: false,
        totalAmount: new Prisma.Decimal('1200.00'),
        downpaymentAmount: new Prisma.Decimal('360.00'),
        balanceAmount: new Prisma.Decimal('840.00'),
        gymRevenue: new Prisma.Decimal('240.00'),
        coachEarnings: new Prisma.Decimal('960.00'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows another appointment on the same gym day when time windows do not overlap', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    coachAvailabilitySlot.findFirst.mockResolvedValue({ id: 'slot-1' });
    coachAppointment.findMany.mockResolvedValue([
      {
        id: 'appt-existing',
        scheduled_at: new Date('2099-04-01T10:00:00.000Z'),
        duration_minutes: 60,
      },
    ]);
    coachAppointment.create.mockResolvedValue({ id: 'appt-1' });

    await repo.createPendingAppointment({
      userId: 'member-1',
      coachId: 'coach-1',
      scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
      appointmentEndsAt: new Date('2099-04-01T09:00:00.000Z'),
      dayOfWeek: 3,
      slotStart: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
      slotEnd: new Date(Date.UTC(1970, 0, 1, 9, 0, 0, 0)),
      durationMinutes: 60,
      isFreeSession: false,
      totalAmount: new Prisma.Decimal('1200.00'),
      downpaymentAmount: new Prisma.Decimal('360.00'),
      balanceAmount: new Prisma.Decimal('840.00'),
      gymRevenue: new Prisma.Decimal('240.00'),
      coachEarnings: new Prisma.Decimal('960.00'),
    });

    expect(coachAppointment.create).toHaveBeenCalled();
  });

  it('loads paginated member appointments by scheduled date range', async () => {
    coachAppointment.findMany.mockResolvedValue([]);
    coachAppointment.count.mockResolvedValue(0);

    await repo.getMyAppointments('member-1', {
      page: 2,
      limit: 5,
      start_date: '2099-04-01',
      end_date: '2099-04-30',
    });

    expect(coachAppointment.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'member-1',
        scheduled_at: {
          gte: new Date('2099-03-31T16:00:00.000Z'),
          lte: new Date('2099-04-30T15:59:59.999Z'),
        },
      },
      orderBy: { scheduled_at: 'desc' },
      include: expect.objectContaining({
        coach: expect.any(Object),
        review: expect.any(Object),
      }),
      select: undefined,
      skip: 5,
      take: 5,
    });
  });

  it('updates appointment lifecycle state by id', async () => {
    coachAppointment.update.mockResolvedValue({
      id: 'appt-1',
      status: 'cancelled',
    });

    await repo.updateAppointment('appt-1', {
      status: 'cancelled',
      cancellation_reason: 'Need to reschedule.',
    });

    expect(coachAppointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: {
        status: 'cancelled',
        cancellation_reason: 'Need to reschedule.',
      },
      include: undefined,
    });
  });

  it('marks confirmed appointments as no_show only when the grace window has passed', async () => {
    coachAppointment.updateMany.mockResolvedValue({ count: 1 });

    await repo.markAppointmentNoShowIfEligible(
      'appt-1',
      new Date('2026-03-26T09:30:00.000Z'),
      new Date('2026-03-26T10:00:00.000Z'),
    );

    expect(coachAppointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appt-1',
        status: 'confirmed',
        scheduled_at: { lte: new Date('2026-03-26T09:30:00.000Z') },
      },
      data: {
        status: 'no_show',
        no_show_at: new Date('2026-03-26T10:00:00.000Z'),
      },
    });
  });

  it('marks free confirmed appointments as completed during cleanup', async () => {
    coachAppointment.updateMany.mockResolvedValue({ count: 1 });

    await repo.completeFreeAppointmentIfEligible(
      'appt-1',
      new Date('2026-03-26T11:00:00.000Z'),
    );

    expect(coachAppointment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'appt-1',
        status: 'confirmed',
        is_free_session: true,
        balance_amount: new Prisma.Decimal('0'),
      },
      data: {
        status: 'completed',
        completed_at: new Date('2026-03-26T11:00:00.000Z'),
      },
    });
  });
});

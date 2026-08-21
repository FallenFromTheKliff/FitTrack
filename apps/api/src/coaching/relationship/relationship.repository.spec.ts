import { AppointmentStatus, RelationshipStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RelationshipRepository } from './relationship.repository';

describe('RelationshipRepository one-time client access', () => {
  let repository: RelationshipRepository;
  let coachClientRelationship: { findMany: jest.Mock };
  let coachAppointment: { findMany: jest.Mock };
  let recurringCoachingPlan: { findFirst: jest.Mock; findMany: jest.Mock };
  let payment: { findMany: jest.Mock };
  let commerceCheckoutHold: { findMany: jest.Mock };

  const makeAppointment = (overrides: Record<string, unknown> = {}) => ({
    id: 'appointment-1',
    user_id: 'member-1',
    coach_id: 'coach-1',
    scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
    duration_minutes: 60,
    created_at: new Date('2026-08-12T10:00:00.000Z'),
    updated_at: new Date('2026-08-12T10:00:00.000Z'),
    coach: {
      id: 'coach-1',
      specialization: 'Strength',
      is_available_for_booking: true,
    },
    user: {
      id: 'member-1',
      status: 'active',
      email_verified_at: null,
      phone_verified_at: null,
      auth_identities: [],
      attendance_logs: [],
      membership_card: null,
      member_appointments: [],
      profile: null,
    },
    ...overrides,
  });

  beforeEach(() => {
    coachClientRelationship = { findMany: jest.fn().mockResolvedValue([]) };
    coachAppointment = { findMany: jest.fn().mockResolvedValue([]) };
    recurringCoachingPlan = {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    };
    payment = { findMany: jest.fn().mockResolvedValue([]) };
    commerceCheckoutHold = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = {
      coachClientRelationship,
      coachAppointment,
      commerceCheckoutHold,
      payment,
      recurringCoachingPlan,
    } as unknown as PrismaService;
    repository = new RelationshipRepository(prisma);
  });

  it('keeps monthly clients unchanged and adds one current paid one-time client once', async () => {
    const monthlyRelationship = {
      id: 'relationship-1',
      coach_id: 'coach-1',
      member_id: 'member-1',
      status: RelationshipStatus.active,
      created_at: new Date('2026-08-11T10:00:00.000Z'),
      updated_at: new Date('2026-08-11T10:00:00.000Z'),
    };
    const oneTimeClient = makeAppointment({
      id: 'appointment-2',
      user_id: 'member-2',
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    coachClientRelationship.findMany.mockResolvedValue([monthlyRelationship]);
    recurringCoachingPlan.findMany.mockResolvedValue([
      { member_id: 'member-1' },
    ]);
    coachAppointment.findMany.mockResolvedValue([
      makeAppointment(),
      oneTimeClient,
    ]);
    payment.findMany.mockResolvedValue([
      { payable_id: 'appointment-1' },
      { payable_id: 'appointment-2' },
    ]);

    const result = await repository.getCoachClients('coach-1', {
      page: 1,
      limit: 20,
    });

    expect(result.data.map((client) => client.id)).toEqual([
      'appointment-2',
      'relationship-1',
    ]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'appointment-2',
        coach_id: 'coach-1',
        member_id: 'member-2',
        status: RelationshipStatus.active,
        notes: null,
        started_at: oneTimeClient.scheduled_at,
        ended_at: new Date(
          oneTimeClient.scheduled_at.getTime() + 60 * 60 * 1000,
        ),
      }),
    );
    expect(coachClientRelationship.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          coach_id: 'coach-1',
          member_id: { in: ['member-1'] },
          status: RelationshipStatus.active,
        },
      }),
    );

    const clientQuery = coachAppointment.findMany.mock.calls[0][0];
    expect(clientQuery.select.user.select.profile.select).toEqual({
      activity_level: true,
      avatar_url: true,
      date_of_birth: true,
      first_name: true,
      fitness_goal: true,
      gender: true,
      height_cm: true,
      last_name: true,
      phone: true,
      weight_kg: true,
    });
    expect(clientQuery.select.user.select.membership_card).toEqual({
      select: { status: true },
    });
  });

  it('queries only paid confirmed or completed non-recurring appointments and verifies full-payment provenance', async () => {
    coachAppointment.findMany.mockResolvedValue([makeAppointment()]);
    payment.findMany.mockResolvedValue([{ payable_id: 'appointment-1' }]);
    await repository.findValidPaidOneTimeAppointment('coach-1', 'member-1');

    const query = coachAppointment.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      coach_id: 'coach-1',
      user_id: 'member-1',
      status: {
        in: [AppointmentStatus.confirmed, AppointmentStatus.completed],
      },
      cancelled_at: null,
      no_show_at: null,
      recurring_plan_id: null,
      recurring_schedule_item_id: null,
      is_free_session: false,
      total_amount: { gt: 0 },
    });
    expect(payment.findMany).toHaveBeenCalledWith({
      where: {
        payable_id: { in: ['appointment-1'] },
        payable_type: 'coaching',
        payment_stage: 'full',
        status: 'completed',
      },
      select: { payable_id: true },
    });
  });

  it('does not authorize an appointment without completed full-payment provenance', async () => {
    coachAppointment.findMany.mockResolvedValue([
      makeAppointment({
        status: AppointmentStatus.completed,
      }),
    ]);

    await expect(
      repository.findValidPaidOneTimeAppointment('coach-1', 'member-1'),
    ).resolves.toBeNull();
  });

  it('accepts a consumed PayMongo checkout hold as full-payment provenance', async () => {
    coachAppointment.findMany.mockResolvedValue([
      makeAppointment({ status: AppointmentStatus.completed }),
    ]);
    commerceCheckoutHold.findMany.mockResolvedValue([
      { appointment_id: 'appointment-1' },
    ]);

    await expect(
      repository.findValidPaidOneTimeAppointment('coach-1', 'member-1'),
    ).resolves.toMatchObject({ id: 'appointment-1' });
  });

  it('limits monthly access to the owning coach, active plan window, and paid current cycle', async () => {
    await repository.findActivePaidMonthlyPlan(
      'coach-1',
      'member-1',
      new Date('2026-08-13T15:30:00.000Z'),
    );

    const query = recurringCoachingPlan.findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({
      coach_id: 'coach-1',
      member_id: 'member-1',
      status: 'active',
      frequency: 'monthly',
      billing_cycles: {
        some: {
          status: 'paid',
        },
      },
    });
    expect(query.where.end_date.gte).toEqual(
      new Date('2026-08-13T00:00:00.000Z'),
    );
    expect(query.where.billing_cycles.some.cycle_end_date.gte).toEqual(
      new Date('2026-08-13T00:00:00.000Z'),
    );
  });
});

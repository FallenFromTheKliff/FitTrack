import { AnalyticsRepository } from './analytics.repository';

describe('AnalyticsRepository', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    attendanceLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    amenityBooking: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    coachAppointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    gymEquipmentItem: {
      findMany: jest.fn(),
    },
    retailProduct: {
      findMany: jest.fn(),
    },
    saleTransaction: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let repo: AnalyticsRepository;

  beforeEach(() => {
    repo = new AnalyticsRepository(prisma as never);
    jest.clearAllMocks();
  });

  function getQueryText(callIndex: number): string {
    const calls = prisma.$queryRaw.mock.calls as [
      TemplateStringsArray,
      ...unknown[],
    ][];
    return calls[callIndex][0].join('');
  }

  function getQueryValue(callIndex: number, valueIndex: number): unknown {
    const calls = prisma.$queryRaw.mock.calls as [
      TemplateStringsArray,
      ...unknown[],
    ][];
    return calls[callIndex][valueIndex];
  }

  it('queries overview metrics from payments, appointments, attendance, and users', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw
      .mockResolvedValueOnce([{ membership_revenue: 0 }])
      .mockResolvedValueOnce([{ coaching_gym_revenue: 0 }])
      .mockResolvedValueOnce([{ total_check_ins: 0 }])
      .mockResolvedValueOnce([{ new_members: 0 }]);

    await repo.getOverviewMetrics(start, end);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(getQueryText(0)).toContain('FROM payments');
    expect(getQueryText(1)).toContain('FROM coach_appointments');
    expect(getQueryText(2)).toContain('FROM attendance_logs');
    expect(getQueryText(3)).toContain('FROM membership_cards');
    expect(getQueryText(3)).toContain('JOIN users');
    expect(getQueryValue(0, 1)).toBe(start);
    expect(getQueryValue(0, 2)).toBe(end);
  });

  it('groups revenue metrics using the requested period bucket', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw
      .mockResolvedValueOnce([{ membership_revenue: 0 }])
      .mockResolvedValueOnce([{ coaching_gym_revenue: 0 }])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z') },
      ]);

    await repo.getRevenueMetrics(start, end, 'monthly');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(getQueryText(2)).toContain("date_trunc('month', created_at)");
    expect(getQueryText(3)).toContain(
      "date_trunc('month', COALESCE(payments.verified_at, payments.created_at))",
    );
    expect(getQueryText(3)).toContain('coach_appointments.gym_revenue');
  });

  it('groups attendance trends using the requested period bucket', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw
      .mockResolvedValueOnce([{ total_check_ins: 12 }])
      .mockResolvedValueOnce([{ hour_of_day: 9, check_ins: 4 }])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z'), check_ins: 12 },
      ]);

    await repo.getAttendanceMetrics(start, end, 'weekly');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(getQueryText(0)).toContain('COUNT(*) AS total_check_ins');
    expect(getQueryText(1)).toContain(
      "EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'UTC')::int AS hour_of_day",
    );
    expect(getQueryText(2)).toContain("date_trunc('week', check_in_at)");
    expect(getQueryText(2)).toContain('FROM attendance_logs');
  });

  it('labels maintenance cancellations as operational work instead of customer cancellation', async () => {
    prisma.attendanceLog.findMany.mockResolvedValue([]);
    prisma.amenityBooking.findMany.mockResolvedValue([
      {
        amenity: { name: 'Boxing Ring' },
        cancellation_reason: 'VENUE_MAINTENANCE',
        cancelled_at: new Date('2026-08-14T10:00:00.000Z'),
        completed_at: null,
        created_at: new Date('2026-08-10T10:00:00.000Z'),
        id: 'booking-1',
        status: 'cancelled',
        user: { profile: { first_name: 'Ava', last_name: 'Rivera' } },
      },
    ]);
    prisma.coachAppointment.findMany.mockResolvedValue([]);
    prisma.saleTransaction.findMany.mockResolvedValue([]);

    await expect(repo.listRecentActivities()).resolves.toEqual([
      expect.objectContaining({
        id: 'booking-1',
        status: 'operational_maintenance',
      }),
    ]);
  });

  it('queries member metrics from users and subscriptions', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw
      .mockResolvedValueOnce([{ new_members: 10 }])
      .mockResolvedValueOnce([{ active_members: 24 }]);

    await repo.getMemberMetrics(start, end);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(getQueryText(0)).toContain('FROM membership_cards');
    expect(getQueryText(1)).toContain('FROM users');
    expect(getQueryText(1)).toContain('LEFT JOIN subscriptions');
    expect(getQueryText(0)).toContain("membership_cards.status = 'active'");
  });

  it('queries coach earnings rollups with coach profile joins', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw.mockResolvedValueOnce([{ coach_id: 'coach-1' }]);

    await repo.getCoachEarningsMetrics(start, end);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getQueryText(0)).toContain('JOIN coach_profiles');
    expect(getQueryText(0)).toContain('LEFT JOIN user_profiles');
    expect(getQueryText(0)).toContain('SUM(coach_appointments.coach_earnings)');
  });

  it('maps custom insight periods to daily revenue and attendance buckets', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw
      .mockResolvedValueOnce([{ membership_revenue: 0 }])
      .mockResolvedValueOnce([{ coaching_gym_revenue: 0 }])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([
        { bucket_start: new Date('2025-01-01T00:00:00.000Z'), check_ins: 12 },
      ]);

    await repo.getRevenueMetrics(start, end, 'custom');
    await repo.getAttendanceMetrics(start, end, 'custom');

    expect(getQueryText(2)).toContain("date_trunc('day', created_at)");
    expect(getQueryText(3)).toContain(
      "date_trunc('day', COALESCE(payments.verified_at, payments.created_at))",
    );
    expect(getQueryText(6)).toContain("date_trunc('day', check_in_at)");
  });

  it('queries attendance peak hours with deterministic hour ordering', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw.mockResolvedValueOnce([{ hour_of_day: 9, check_ins: 18 }]);

    await repo.getAttendancePeakHours(start, end, 5);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getQueryText(0)).toContain(
      "EXTRACT(HOUR FROM check_in_at AT TIME ZONE 'UTC')::int AS hour_of_day",
    );
    expect(getQueryText(0)).toContain(
      'ORDER BY check_ins DESC, hour_of_day ASC',
    );
    expect(getQueryValue(0, 3)).toBe(5);
  });

  it('queries top membership plans from completed subscription payments', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw.mockResolvedValueOnce([
      { name: 'Elite', subscriber_count: 3, revenue: 4500 },
    ]);

    await repo.getTopMembershipPlans(start, end, 5);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getQueryText(0)).toContain('JOIN subscriptions');
    expect(getQueryText(0)).toContain('JOIN membership_plans');
    expect(getQueryText(0)).toContain(
      "WHERE payments.payable_type = 'subscription'",
    );
    expect(getQueryText(0)).toContain('ORDER BY revenue DESC');
  });

  it('queries top inventory products from completed sale transactions', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw.mockResolvedValueOnce([
      { name: 'Protein Bar', quantity_sold: 10, revenue: 1200 },
    ]);

    await repo.getTopInventoryProducts(start, end, 5);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getQueryText(0)).toContain('FROM sale_transactions');
    expect(getQueryText(0)).toContain('JOIN sale_transaction_items');
    expect(getQueryText(0)).toContain('JOIN retail_products');
    expect(getQueryText(0)).toContain(
      "WHERE sale_transactions.status = 'completed'",
    );
  });

  it('builds warning alerts from low-stock products and equipment attention items', async () => {
    prisma.retailProduct.findMany.mockResolvedValueOnce([
      {
        id: 'product-1',
        name: 'Creatine',
        stock_quantity: 1,
        reorder_threshold: 10,
      },
    ]);
    prisma.gymEquipmentItem.findMany.mockResolvedValueOnce([
      {
        id: 'equipment-1',
        name: 'Treadmill belt',
        quantity_total: 4,
        quantity_current: 2,
        unit: 'units',
      },
    ]);

    await expect(repo.listSystemAlerts()).resolves.toEqual([
      {
        id: 'product-1',
        kind: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Alert',
        body: 'Creatine is down to 1 units and needs replenishment to stay above the 10-unit threshold.',
        action_label: 'OPEN RESTOCK',
        href: '/inventory?tab=retail&modal=restock&productId=product-1',
      },
      {
        id: 'equipment-1',
        kind: 'maintenance_due',
        severity: 'warning',
        title: 'Maintenance Due',
        body: 'Treadmill belt has 2 units unavailable and needs maintenance follow-up.',
        action_label: 'REVIEW EQUIPMENT',
        href: '/inventory?tab=equipment&modal=details&equipmentId=equipment-1',
      },
    ]);
  });


  it('filters retail alerts using each product threshold before limiting the lane', async () => {
    prisma.retailProduct.findMany.mockResolvedValueOnce([
      {
        id: 'product-8-threshold-5',
        name: 'Product A',
        stock_quantity: 8,
        reorder_threshold: 5,
      },
      {
        id: 'product-15-threshold-20',
        name: 'Product B',
        stock_quantity: 15,
        reorder_threshold: 20,
      },
      {
        id: 'product-20-threshold-20',
        name: 'Product C',
        stock_quantity: 20,
        reorder_threshold: 20,
      },
      {
        id: 'product-21-threshold-20',
        name: 'Product D',
        stock_quantity: 21,
        reorder_threshold: 20,
      },
      {
        id: 'product-30-threshold-40',
        name: 'Product E',
        stock_quantity: 30,
        reorder_threshold: 40,
      },
    ]);
    prisma.gymEquipmentItem.findMany.mockResolvedValueOnce([
      {
        id: 'equipment-1',
        name: 'Treadmill belt',
        quantity_total: 4,
        quantity_current: 2,
        unit: 'units',
      },
      {
        id: 'equipment-2',
        name: 'Cable handle',
        quantity_total: 3,
        quantity_current: 0,
        unit: 'units',
      },
      {
        id: 'equipment-3',
        name: 'Bench pad',
        quantity_total: 6,
        quantity_current: 6,
        unit: 'units',
      },
      {
        id: 'equipment-4',
        name: 'Rowing strap',
        quantity_total: 2,
        quantity_current: 1,
        unit: 'units',
      },
    ]);

    const alerts = await repo.listSystemAlerts();

    expect(alerts.map((alert) => alert.id)).toEqual([
      'product-15-threshold-20',
      'product-20-threshold-20',
      'product-30-threshold-40',
      'equipment-1',
      'equipment-2',
      'equipment-4',
    ]);
    expect(prisma.retailProduct.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
      },
      orderBy: [{ stock_quantity: 'asc' }, { updated_at: 'desc' }],
    });
    expect(prisma.gymEquipmentItem.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
      },
      orderBy: [{ quantity_current: 'asc' }, { updated_at: 'desc' }],
    });
  });
});

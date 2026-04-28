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
    expect(getQueryText(3)).toContain('FROM users');
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
    expect(getQueryText(3)).toContain("date_trunc('month', completed_at)");
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

  it('queries member metrics from users and subscriptions', async () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    prisma.$queryRaw.mockResolvedValueOnce([
      { new_members: 10, active_members: 24 },
    ]);

    await repo.getMemberMetrics(start, end);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getQueryText(0)).toContain('FROM subscriptions');
    expect(getQueryText(0)).toContain(
      "subscriptions.status IN ('active', 'past_due', 'cancelled', 'expired')",
    );
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
    expect(getQueryText(3)).toContain("date_trunc('day', completed_at)");
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

    await expect(repo.listSystemAlerts(4)).resolves.toEqual([
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
});

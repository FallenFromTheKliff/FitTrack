import { InventoryLifecycleRepository } from './inventory-lifecycle.repository';

describe('InventoryLifecycleRepository', () => {
  const retailProduct = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };

  const user = {
    findMany: jest.fn(),
  };

  const prisma = {
    retailProduct,
    user,
  };

  let repo: InventoryLifecycleRepository;

  beforeEach(() => {
    repo = new InventoryLifecycleRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('returns an empty list without querying Prisma when no product ids are supplied', async () => {
    await expect(repo.findProductsByIds([])).resolves.toEqual([]);
    expect(retailProduct.findMany).not.toHaveBeenCalled();
  });

  it('marks a low-stock alert as sent only when the cooldown window allows it', async () => {
    const now = new Date('2026-03-27T08:00:00.000Z');
    const cooldownCutoff = new Date('2026-03-26T08:00:00.000Z');
    retailProduct.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repo.markLowStockAlertSentIfDue('product-1', now, cooldownCutoff),
    ).resolves.toBe(true);

    expect(retailProduct.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'product-1',
        OR: [
          { last_low_stock_alert_at: null },
          { last_low_stock_alert_at: { lt: cooldownCutoff } },
        ],
      },
      data: {
        last_low_stock_alert_at: now,
      },
    });
  });

  it('maps active admin recipients to their first eligible identity email', async () => {
    user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        profile: {
          first_name: 'Morgan',
          last_name: 'Reyes',
        },
        auth_identities: [{ identifier: 'morgan@example.com' }],
      },
      {
        id: 'admin-2',
        profile: null,
        auth_identities: [],
      },
    ]);

    await expect(repo.listAdminAlertRecipients()).resolves.toEqual([
      {
        user_id: 'admin-1',
        display_name: 'Morgan Reyes',
        email: 'morgan@example.com',
      },
      {
        user_id: 'admin-2',
        display_name: 'Admin',
        email: null,
      },
    ]);

    expect(user.findMany).toHaveBeenCalledWith({
      where: {
        role: 'admin',
        status: 'active',
        notification_prefs: {
          is: {
            system_email: true,
          },
        },
      },
      select: {
        id: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        auth_identities: {
          where: {
            provider: {
              in: ['email', 'google'],
            },
          },
          orderBy: {
            created_at: 'asc',
          },
          select: {
            identifier: true,
          },
          take: 1,
        },
      },
    });
  });
});

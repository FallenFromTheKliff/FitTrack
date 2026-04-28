import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';

import type { NotificationDispatchPayload } from '../notifications/notification-dispatch.types';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryLifecycleRepository } from './inventory-lifecycle.repository';
import { InventoryLifecycleService } from './inventory-lifecycle.service';

describe('InventoryLifecycleService', () => {
  let service: InventoryLifecycleService;

  const repo = {
    findProductsByIds: jest.fn(),
    markLowStockAlertSentIfDue: jest.fn(),
    listAdminAlertRecipients: jest.fn(),
    listInventoryActivityRecipients: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryLifecycleService,
        { provide: InventoryLifecycleRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<InventoryLifecycleService>(InventoryLifecycleService);
    jest.clearAllMocks();
  });

  it('queues low-stock alerts only when the cooldown stamp succeeds', async () => {
    repo.findProductsByIds.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        stock_quantity: 2,
        reorder_threshold: 10,
      },
    ]);
    repo.markLowStockAlertSentIfDue.mockResolvedValue(true);
    repo.listAdminAlertRecipients.mockResolvedValue([
      {
        user_id: 'admin-1',
        display_name: 'Admin One',
        email: 'admin@example.com',
      },
    ]);

    await service.handleProductStockChanged({
      productIds: ['product-1', 'product-1'],
    });

    expect(repo.findProductsByIds).toHaveBeenCalledWith(['product-1']);
    expect(repo.markLowStockAlertSentIfDue).toHaveBeenCalledTimes(1);
    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('admin-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.low_stock);
    expect(dispatchCalls[0]?.[2].title).toBe(
      'Low stock alert: Whey Protein Isolate',
    );
    expect(dispatchCalls[0]?.[2].email?.subject).toBe(
      'Low stock alert: Whey Protein Isolate',
    );
  });

  it('skips low-stock email delivery when the cooldown is still active', async () => {
    repo.findProductsByIds.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Whey Protein Isolate',
        stock_quantity: 2,
        reorder_threshold: 10,
      },
    ]);
    repo.markLowStockAlertSentIfDue.mockResolvedValue(false);

    await service.handleProductStockChanged({
      productIds: ['product-1'],
    });

    expect(notificationsService.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches admin notifications for equipment write-off alerts', async () => {
    repo.listAdminAlertRecipients.mockResolvedValue([
      {
        user_id: 'admin-1',
        display_name: 'Admin One',
        email: 'admin@example.com',
      },
    ]);

    await service.handleEquipmentWriteOff({
      equipmentId: 'equipment-1',
      equipmentName: 'Adjustable Bench',
      quantityBefore: 6,
      quantitySetTo: 4,
      quantityLost: 2,
      reason: 'Damaged equipment removed.',
      performedBy: 'staff-1',
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls[0]?.[0]).toBe('admin-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.equipment_write_off);
    expect(dispatchCalls[0]?.[2].title).toBe(
      'Equipment write-off: Adjustable Bench',
    );
    expect(dispatchCalls[0]?.[2].email?.subject).toBe(
      'Equipment write-off: Adjustable Bench',
    );
  });

  it('dispatches in-app system notifications for inventory activity updates', async () => {
    repo.listInventoryActivityRecipients.mockResolvedValue([
      {
        user_id: 'admin-1',
        display_name: 'Admin One',
        email: 'admin@example.com',
      },
      {
        user_id: 'staff-1',
        display_name: 'Staff One',
        email: 'staff@example.com',
      },
    ]);

    await service.handleInventoryActivity({
      action: 'product_updated',
      actorId: 'admin-1',
      entityId: 'product-1',
      entityName: 'Creatine',
      details: {
        stock_quantity: 8,
      },
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls).toHaveLength(2);
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.system);
    expect(dispatchCalls[0]?.[2]).toMatchObject({
      title: 'Retail product updated: Creatine',
      body: 'Creatine was updated in the retail inventory catalog.',
    });
    expect(dispatchCalls[0]?.[2].email).toBeUndefined();
  });

  it('maps recorded retail sales into inventory activity notifications', async () => {
    repo.listInventoryActivityRecipients.mockResolvedValue([
      {
        user_id: 'admin-1',
        display_name: 'Admin One',
        email: 'admin@example.com',
      },
    ]);

    await service.handleInventoryActivity({
      action: 'product_sale_recorded',
      actorId: 'staff-1',
      entityId: 'sale-1',
      entityName: 'Whey Protein Isolate',
      details: {
        item_count: 1,
        payment_method: 'cash',
        quantity_sold: 2,
        sale_id: 'sale-1',
        source: 'manual',
        status: 'completed',
        total_amount: '2998.00',
      },
    });

    const dispatchCalls = notificationsService.dispatch.mock.calls as Array<
      [string, NotificationType, NotificationDispatchPayload]
    >;

    expect(dispatchCalls).toHaveLength(1);
    expect(dispatchCalls[0]?.[0]).toBe('admin-1');
    expect(dispatchCalls[0]?.[1]).toBe(NotificationType.system);
    expect(dispatchCalls[0]?.[2]).toMatchObject({
      title: 'Retail sale recorded: Whey Protein Isolate',
      body: '2 unit(s) sold for PHP 2998.00 through manual sale.',
    });
    expect(dispatchCalls[0]?.[2].data).toMatchObject({
      action: 'product_sale_recorded',
      inventory_domain: 'retail',
      sale_id: 'sale-1',
    });
    expect(dispatchCalls[0]?.[2].email).toBeUndefined();
  });
});

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import type { NotificationDispatchPayload } from '../notifications/notification-dispatch.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  EQUIPMENT_WRITEOFF_EVENT,
  type EquipmentWriteOffEvent,
} from './events/equipment-write-off.event';
import {
  PRODUCT_STOCK_CHANGED_EVENT,
  type ProductStockChangedEvent,
} from './events/product-stock-changed.event';
import { InventoryLifecycleRepository } from './inventory-lifecycle.repository';

const LOW_STOCK_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InventoryLifecycleService {
  constructor(
    private readonly repo: InventoryLifecycleRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(PRODUCT_STOCK_CHANGED_EVENT, { async: true })
  async handleProductStockChanged(
    event: ProductStockChangedEvent,
  ): Promise<void> {
    const productIds = [...new Set(event.productIds)];

    if (productIds.length === 0) {
      return;
    }

    const products = await this.repo.findProductsByIds(productIds);
    const now = new Date();
    const cooldownCutoff = new Date(
      now.getTime() - LOW_STOCK_ALERT_COOLDOWN_MS,
    );

    for (const product of products) {
      if (product.stock_quantity >= product.reorder_threshold) {
        continue;
      }

      const shouldAlert = await this.repo.markLowStockAlertSentIfDue(
        product.id,
        now,
        cooldownCutoff,
      );

      if (!shouldAlert) {
        continue;
      }

      await this.notifyAdmins(NotificationType.low_stock, {
        title: `Low stock alert: ${product.name}`,
        body: `${product.name} is below its reorder threshold. Current stock: ${product.stock_quantity}.`,
        data: {
          product_id: product.id,
          product_name: product.name,
          stock_quantity: product.stock_quantity,
          reorder_threshold: product.reorder_threshold,
        },
        email: {
          subject: `Low stock alert: ${product.name}`,
          html: this.buildLowStockHtml(product.name, product.stock_quantity),
        },
      });
    }
  }

  @OnEvent(EQUIPMENT_WRITEOFF_EVENT, { async: true })
  async handleEquipmentWriteOff(event: EquipmentWriteOffEvent): Promise<void> {
    await this.notifyAdmins(NotificationType.equipment_write_off, {
      title: `Equipment write-off: ${event.equipmentName}`,
      body: `${event.equipmentName} was written off by ${event.performedBy}. Reason: ${event.reason}`,
      data: {
        equipment_id: event.equipmentId,
        equipment_name: event.equipmentName,
        quantity_before: event.quantityBefore,
        quantity_set_to: event.quantitySetTo,
        quantity_lost: event.quantityLost,
        reason: event.reason,
        performed_by: event.performedBy,
      },
      email: {
        subject: `Equipment write-off: ${event.equipmentName}`,
        html: this.buildEquipmentWriteOffHtml(event),
      },
    });
  }

  private async notifyAdmins(
    type: NotificationType,
    payload: NotificationDispatchPayload,
  ): Promise<void> {
    const recipients = await this.repo.listAdminAlertRecipients();

    for (const recipient of recipients) {
      await this.notificationsService.dispatch(
        recipient.user_id,
        type,
        payload,
      );
    }
  }

  private buildLowStockHtml(
    productName: string,
    stockQuantity: number,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Low stock alert</h2>
        <p style="color:#555">
          <strong>${productName}</strong> is below its reorder threshold.
        </p>
        <p style="color:#555">Current stock: <strong>${stockQuantity}</strong>.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildEquipmentWriteOffHtml(event: EquipmentWriteOffEvent): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Equipment write-off recorded</h2>
        <p style="color:#555">
          <strong>${event.equipmentName}</strong> was written off by ${event.performedBy}.
        </p>
        <p style="color:#555">
          Quantity before: <strong>${event.quantityBefore}</strong><br/>
          Quantity set to: <strong>${event.quantitySetTo}</strong><br/>
          Quantity lost: <strong>${event.quantityLost}</strong>
        </p>
        <p style="color:#555">Reason: ${event.reason}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }
}

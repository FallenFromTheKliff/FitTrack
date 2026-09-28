import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { NotificationsModule } from '../notifications/notifications.module';
import { EquipmentModule } from './equipment/equipment.module';
import { InventoryLifecycleRepository } from './inventory-lifecycle.repository';
import { InventoryLifecycleService } from './inventory-lifecycle.service';
import { RetailProductModule } from './retail-product/retail-product.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [
    EventEmitterModule,
    NotificationsModule,
    RetailProductModule,
    EquipmentModule,
    SalesModule,
  ],
  providers: [InventoryLifecycleRepository, InventoryLifecycleService],
  exports: [RetailProductModule, EquipmentModule, SalesModule],
})
export class InventoryModule {}

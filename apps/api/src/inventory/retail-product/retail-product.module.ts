import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { RetailProductController } from './retail-product.controller';
import { RetailProductRepository } from './retail-product.repository';
import { RetailProductService } from './retail-product.service';

@Module({
  imports: [EventEmitterModule],
  controllers: [RetailProductController],
  providers: [RetailProductService, RetailProductRepository],
  exports: [RetailProductService, RetailProductRepository],
})
export class RetailProductModule {}

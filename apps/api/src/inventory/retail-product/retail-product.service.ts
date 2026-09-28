import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RetailProduct } from '@prisma/client';

import { AuditAction, type AuditEvent } from '../../audit/audit.service';
import { type PaginatedResult } from '../../common/base-repository/base-repository';
import {
  INVENTORY_ACTIVITY_EVENT,
  type InventoryActivityEvent,
} from '../events/inventory-activity.event';
import {
  CreateRetailProductDTO,
  ProductFilterDTO,
  RestockProductDTO,
  RetailProductResponseDTO,
  UpdateRetailProductDTO,
} from './dto/retail-product.dto';
import { RetailProductRepository } from './retail-product.repository';

const RETAIL_PRODUCT_UPDATE_FIELDS = [
  'category',
  'name',
  'description',
  'price',
  'cost',
  'stock_quantity',
  'reorder_threshold',
  'image_url',
  'is_active',
] as const;

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class RetailProductService {
  constructor(
    private readonly repo: RetailProductRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listProducts(
    dto: ProductFilterDTO,
  ): Promise<PaginatedResult<RetailProductResponseDTO>> {
    const result = await this.repo.listProducts(dto);

    return {
      data: result.data.map((product) => this.toResponse(product)),
      meta: result.meta,
    };
  }

  async getProductById(
    id: string,
    includeArchived = false,
  ): Promise<RetailProductResponseDTO> {
    const product = includeArchived
      ? await this.repo.findProductByIdOrThrow(id)
      : await this.repo.findActiveProductByIdOrThrow(id);
    return this.toResponse(product);
  }

  async createProduct(
    actorId: string,
    dto: CreateRetailProductDTO,
  ): Promise<RetailProductResponseDTO> {
    const product = await this.repo.createProduct(this.toCreateInput(dto));

    await this.emitInventoryActivity({
      action: 'product_created',
      actorId,
      entityId: product.id,
      entityName: product.name,
      details: {
        category: product.category,
        stock_quantity: product.stock_quantity,
      },
    });

    return this.toResponse(product);
  }

  async updateProduct(
    actorId: string,
    id: string,
    dto: UpdateRetailProductDTO,
  ): Promise<RetailProductResponseDTO> {
    const product = await this.repo.updateProduct(id, this.toUpdateInput(dto));
    const action =
      dto.is_active === false ? 'product_archived' : 'product_updated';

    await this.emitInventoryActivity({
      action,
      actorId,
      entityId: product.id,
      entityName: product.name,
      details: {
        category: product.category,
        is_active: product.is_active ? 'true' : 'false',
        stock_quantity: product.stock_quantity,
      },
    });

    return this.toResponse(product);
  }

  async restockProduct(
    actorId: string,
    id: string,
    dto: RestockProductDTO,
  ): Promise<RetailProductResponseDTO> {
    const before = await this.repo.findProductByIdOrThrow(id);
    const restocked = await this.repo.restockProduct(id, dto.quantity);

    this.emitAudit({
      userId: actorId,
      action: AuditAction.PRODUCT_RESTOCKED,
      entity: 'RetailProduct',
      entityId: restocked.id,
      before: {
        stock_quantity: before.stock_quantity,
      },
      after: {
        stock_quantity: restocked.stock_quantity,
        quantity_added: dto.quantity,
        notes: dto.notes ?? null,
      },
    });
    await this.emitInventoryActivity({
      action: 'product_restocked',
      actorId,
      entityId: restocked.id,
      entityName: restocked.name,
      details: {
        quantity_added: dto.quantity,
        stock_quantity: restocked.stock_quantity,
      },
    });

    return this.toResponse(restocked);
  }

  private toCreateInput(
    dto: CreateRetailProductDTO,
  ): Prisma.RetailProductCreateInput {
    return {
      category: dto.category ?? 'other',
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      cost: dto.cost ?? 0,
      stock_quantity: dto.stock_quantity ?? 0,
      reorder_threshold: dto.reorder_threshold ?? 10,
      image_url: dto.image_url ?? null,
    };
  }

  private toUpdateInput(
    dto: UpdateRetailProductDTO,
  ): Prisma.RetailProductUpdateInput {
    return {
      ...pickDefined(dto, RETAIL_PRODUCT_UPDATE_FIELDS),
    };
  }

  private toResponse(product: RetailProduct): RetailProductResponseDTO {
    return {
      category: product.category,
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: product.price.toFixed(2),
      cost: product.cost.toFixed(2),
      stock_quantity: product.stock_quantity,
      reorder_threshold: product.reorder_threshold,
      image_url: product.image_url ?? null,
      is_active: product.is_active,
      created_at: product.created_at.toISOString(),
      updated_at: product.updated_at.toISOString(),
    };
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private async emitInventoryActivity(
    event: InventoryActivityEvent,
  ): Promise<void> {
    await this.eventEmitter.emitAsync(INVENTORY_ACTIVITY_EVENT, event);
  }
}

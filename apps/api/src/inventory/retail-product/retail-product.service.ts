import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RetailProduct } from '@prisma/client';

import { AuditAction, type AuditEvent } from '../../audit/audit.service';
import { type PaginatedResult } from '../../common/base-repository/base-repository';
import {
  CreateRetailProductDTO,
  ProductFilterDTO,
  RestockProductDTO,
  RetailProductResponseDTO,
  UpdateRetailProductDTO,
} from './dto/retail-product.dto';
import { RetailProductRepository } from './retail-product.repository';

const RETAIL_PRODUCT_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
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

  async getProductById(id: string): Promise<RetailProductResponseDTO> {
    return this.toResponse(await this.repo.findActiveProductByIdOrThrow(id));
  }

  async createProduct(
    dto: CreateRetailProductDTO,
  ): Promise<RetailProductResponseDTO> {
    return this.toResponse(
      await this.repo.createProduct(this.toCreateInput(dto)),
    );
  }

  async updateProduct(
    id: string,
    dto: UpdateRetailProductDTO,
  ): Promise<RetailProductResponseDTO> {
    return this.toResponse(
      await this.repo.updateProduct(id, this.toUpdateInput(dto)),
    );
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

    return this.toResponse(restocked);
  }

  private toCreateInput(
    dto: CreateRetailProductDTO,
  ): Prisma.RetailProductCreateInput {
    return {
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
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
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      price: product.price.toFixed(2),
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
}

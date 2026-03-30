import { Injectable } from '@nestjs/common';
import { Prisma, RetailProduct } from '@prisma/client';

import {
  BaseRepository,
  type PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductFilterDTO } from './dto/retail-product.dto';

const retailProductOrderBy: Prisma.RetailProductOrderByWithRelationInput[] = [
  { name: 'asc' },
  { created_at: 'desc' },
];

@Injectable()
export class RetailProductRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listProducts(dto: ProductFilterDTO): Promise<PaginatedResult<RetailProduct>> {
    const where: Prisma.RetailProductWhereInput = {
      is_active: true,
    };

    if (dto.in_stock_only) {
      where.stock_quantity = {
        gt: 0,
      };
    }

    if (dto.search) {
      const term = dto.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.paginate<RetailProduct>(
      this.prisma.retailProduct,
      {
        where,
        orderBy: retailProductOrderBy,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findActiveProductByIdOrThrow(id: string): Promise<RetailProduct> {
    return this.findOneOrThrow<RetailProduct>(
      this.prisma.retailProduct,
      { id, is_active: true },
      'RetailProduct',
    );
  }

  findProductByIdOrThrow(id: string): Promise<RetailProduct> {
    return this.findByIdOrThrow<RetailProduct>(
      this.prisma.retailProduct,
      id,
      'RetailProduct',
    );
  }

  createProduct(data: Prisma.RetailProductCreateInput): Promise<RetailProduct> {
    return this.create<RetailProduct>(this.prisma.retailProduct, data);
  }

  updateProduct(
    id: string,
    data: Prisma.RetailProductUpdateInput,
  ): Promise<RetailProduct> {
    return this.updateById<RetailProduct>(this.prisma.retailProduct, id, data);
  }

  restockProduct(id: string, quantity: number): Promise<RetailProduct> {
    return this.updateById<RetailProduct>(this.prisma.retailProduct, id, {
      stock_quantity: {
        increment: quantity,
      },
    });
  }
}

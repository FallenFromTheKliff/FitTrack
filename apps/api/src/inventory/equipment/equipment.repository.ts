import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, GymEquipmentItem } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDTO } from '../../user/dto/user-dto';

const equipmentOrderBy: Prisma.GymEquipmentItemOrderByWithRelationInput[] = [
  { name: 'asc' },
  { created_at: 'desc' },
];

const writeOffOrderBy: Prisma.EquipmentWriteOffOrderByWithRelationInput[] = [
  { created_at: 'desc' },
];

const equipmentWriteOffInclude = {
  equipment: {
    select: {
      id: true,
      name: true,
    },
  },
  performer: {
    select: {
      id: true,
      profile: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
  },
} satisfies Prisma.EquipmentWriteOffInclude;

const equipmentDetailInclude = {
  write_offs: {
    orderBy: { created_at: 'desc' },
    include: equipmentWriteOffInclude,
  },
} satisfies Prisma.GymEquipmentItemInclude;

export type EquipmentWriteOffRecord = Prisma.EquipmentWriteOffGetPayload<{
  include: typeof equipmentWriteOffInclude;
}>;

export type EquipmentDetailRecord = Prisma.GymEquipmentItemGetPayload<{
  include: typeof equipmentDetailInclude;
}>;

@Injectable()
export class EquipmentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listEquipmentItems(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymEquipmentItem>> {
    return this.paginate<GymEquipmentItem>(
      this.prisma.gymEquipmentItem,
      {
        where: {
          is_active: true,
        },
        orderBy: equipmentOrderBy,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findEquipmentItemByIdOrThrow(id: string): Promise<EquipmentDetailRecord> {
    return this.findByIdOrThrow<EquipmentDetailRecord>(
      this.prisma.gymEquipmentItem,
      id,
      'GymEquipmentItem',
      equipmentDetailInclude,
    );
  }

  findEquipmentItemRecordByIdOrThrow(id: string): Promise<GymEquipmentItem> {
    return this.findByIdOrThrow<GymEquipmentItem>(
      this.prisma.gymEquipmentItem,
      id,
      'GymEquipmentItem',
    );
  }

  createEquipmentItem(
    data: Prisma.GymEquipmentItemCreateInput,
  ): Promise<GymEquipmentItem> {
    return this.create<GymEquipmentItem>(this.prisma.gymEquipmentItem, data);
  }

  updateEquipmentItem(
    id: string,
    data: Prisma.GymEquipmentItemUpdateInput,
  ): Promise<GymEquipmentItem> {
    return this.updateById<GymEquipmentItem>(
      this.prisma.gymEquipmentItem,
      id,
      data,
    );
  }

  listWriteOffHistory(
    equipmentId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<EquipmentWriteOffRecord>> {
    return this.paginate<EquipmentWriteOffRecord>(
      this.prisma.equipmentWriteOff,
      {
        where: {
          equipment_id: equipmentId,
        },
        orderBy: writeOffOrderBy,
        include: equipmentWriteOffInclude,
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  writeOffEquipment(
    performerId: string,
    equipmentId: string,
    quantitySetTo: number,
    reason: string,
  ): Promise<EquipmentWriteOffRecord> {
    return this.transaction(async (tx) => {
      const equipment = await tx.gymEquipmentItem.findUnique({
        where: { id: equipmentId },
      });

      if (!equipment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipmentItem Not Found',
          status: 404,
          detail: `GymEquipmentItem with id "${equipmentId}" does not exist.`,
        });
      }

      if (quantitySetTo > equipment.quantity_current) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Invalid Equipment Write-Off',
            status: 422,
            detail:
              'quantity_set_to cannot be greater than the current equipment quantity.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const quantityBefore = equipment.quantity_current;
      const quantityLost = quantityBefore - quantitySetTo;

      const updateResult = await tx.gymEquipmentItem.updateMany({
        where: {
          id: equipmentId,
          quantity_current: quantityBefore,
        },
        data: {
          quantity_current: quantitySetTo,
        },
      });

      if (updateResult.count !== 1) {
        const latestEquipment = await tx.gymEquipmentItem.findUnique({
          where: { id: equipmentId },
          select: { quantity_current: true },
        });

        if (!latestEquipment) {
          throw new NotFoundException({
            type: 'NOT_FOUND',
            title: 'GymEquipmentItem Not Found',
            status: 404,
            detail: `GymEquipmentItem with id "${equipmentId}" does not exist.`,
          });
        }

        if (quantitySetTo > latestEquipment.quantity_current) {
          throw new HttpException(
            {
              type: 'BUSINESS_RULE_VIOLATION',
              title: 'Invalid Equipment Write-Off',
              status: 422,
              detail:
                'quantity_set_to cannot be greater than the current equipment quantity.',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Equipment Quantity Changed',
          status: 409,
          detail:
            'Equipment quantity changed before the write-off could be recorded. Refresh the item and try again.',
        });
      }

      return tx.equipmentWriteOff.create({
        data: {
          quantity_before: quantityBefore,
          quantity_set_to: quantitySetTo,
          quantity_lost: quantityLost,
          reason,
          equipment: { connect: { id: equipmentId } },
          performer: { connect: { id: performerId } },
        },
        include: equipmentWriteOffInclude,
      });
    });
  }
}

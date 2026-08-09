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
import type { EquipmentStatusBucket } from './dto/equipment-status-transition.dto';

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

const equipmentLayoutInclude = {
  layout_nodes: {
    where: { is_active: true },
    select: { id: true },
  },
} satisfies Prisma.GymEquipmentItemInclude;

const equipmentListInclude = equipmentLayoutInclude;

const equipmentStatusField: Record<
  EquipmentStatusBucket,
  'quantity_current' | 'quantity_maintenance' | 'quantity_broken' | 'quantity_missing'
> = {
  available: 'quantity_current',
  maintenance: 'quantity_maintenance',
  broken: 'quantity_broken',
  missing: 'quantity_missing',
};

type EquipmentStatusCounts = Record<EquipmentStatusBucket, number>;

function normalizeEquipmentStatusCounts(
  equipment: Pick<
    GymEquipmentItem,
    | 'quantity_total'
    | 'quantity_current'
    | 'quantity_maintenance'
    | 'quantity_broken'
    | 'quantity_missing'
  >,
): EquipmentStatusCounts {
  const isLegacySingleStatus =
    equipment.quantity_maintenance === null &&
    equipment.quantity_broken === null &&
    equipment.quantity_missing === null;

  return {
    available: equipment.quantity_current,
    maintenance: equipment.quantity_maintenance ?? 0,
    broken: equipment.quantity_broken ?? 0,
    missing: isLegacySingleStatus
      ? Math.max(equipment.quantity_total - equipment.quantity_current, 0)
      : (equipment.quantity_missing ?? 0),
  };
}

const equipmentDetailInclude = {
  ...equipmentLayoutInclude,
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

export type EquipmentListRecord = Prisma.GymEquipmentItemGetPayload<{
  include: typeof equipmentListInclude;
}>;

export type ArchivedEquipmentRecord = {
  equipment: EquipmentListRecord;
  quantityBefore: number;
  quantitySetTo: number;
};

@Injectable()
export class EquipmentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listEquipmentItems(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<EquipmentListRecord>> {
    return this.paginate<EquipmentListRecord>(
      this.prisma.gymEquipmentItem,
      {
        where: {
          is_active: true,
        },
        orderBy: equipmentOrderBy,
        include: equipmentListInclude,
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
  ): Promise<EquipmentListRecord> {
    return this.create<EquipmentListRecord>(
      this.prisma.gymEquipmentItem,
      data,
      equipmentListInclude,
    );
  }

  updateEquipmentItem(
    id: string,
    data: Prisma.GymEquipmentItemUpdateInput,
  ): Promise<EquipmentListRecord> {
    return this.updateById<EquipmentListRecord>(
      this.prisma.gymEquipmentItem,
      id,
      data,
      equipmentListInclude,
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
    status: 'maintenance' | 'broken' | 'missing' = 'broken',
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
      const hasStatusColumns =
        equipment.quantity_maintenance !== undefined ||
        equipment.quantity_broken !== undefined ||
        equipment.quantity_missing !== undefined;
      const nextCounts = {
        quantity_maintenance: equipment.quantity_maintenance,
        quantity_broken: equipment.quantity_broken,
        quantity_missing: equipment.quantity_missing,
      };
      const statusField = `quantity_${status}` as keyof typeof nextCounts;
      nextCounts[statusField] = (nextCounts[statusField] ?? 0) + quantityLost;

      const updateResult = await tx.gymEquipmentItem.updateMany({
        where: {
          id: equipmentId,
          quantity_current: quantityBefore,
          ...(hasStatusColumns
            ? {
                quantity_maintenance: equipment.quantity_maintenance,
                quantity_broken: equipment.quantity_broken,
                quantity_missing: equipment.quantity_missing,
              }
            : {}),
        },
        data: {
          quantity_current: quantitySetTo,
          ...(hasStatusColumns ? nextCounts : {}),
        },
      });

      if (updateResult.count !== 1) {
        const latestEquipment = await tx.gymEquipmentItem.findUnique({
          where: { id: equipmentId },
          select: {
            quantity_current: true,
            quantity_maintenance: true,
            quantity_broken: true,
            quantity_missing: true,
          },
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

  transitionEquipmentStatus(
    equipmentId: string,
    sourceStatus: EquipmentStatusBucket,
    destinationStatus: EquipmentStatusBucket,
    quantity: number,
  ): Promise<EquipmentListRecord> {
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

      if (
        sourceStatus === destinationStatus ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Invalid Equipment Status Transition',
            status: 422,
            detail:
              'A status transition must move a positive whole-unit quantity between two different states.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const counts = normalizeEquipmentStatusCounts(equipment);
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

      if (
        Object.values(counts).some((value) => value < 0) ||
        total !== equipment.quantity_total
      ) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Invalid Equipment Status Counts',
            status: 422,
            detail:
              'Available, maintenance, broken, and missing quantities must be non-negative and equal quantity_total.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (counts[sourceStatus] < quantity) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Insufficient Equipment Quantity',
            status: 422,
            detail: `Only ${counts[sourceStatus]} unit(s) are in the ${sourceStatus} state.`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const nextCounts = { ...counts };
      nextCounts[sourceStatus] -= quantity;
      nextCounts[destinationStatus] += quantity;

      const updateResult = await tx.gymEquipmentItem.updateMany({
        where: {
          id: equipmentId,
          quantity_current: equipment.quantity_current,
          quantity_maintenance: equipment.quantity_maintenance,
          quantity_broken: equipment.quantity_broken,
          quantity_missing: equipment.quantity_missing,
        },
        data: {
          [equipmentStatusField.available]: nextCounts.available,
          [equipmentStatusField.maintenance]: nextCounts.maintenance,
          [equipmentStatusField.broken]: nextCounts.broken,
          [equipmentStatusField.missing]: nextCounts.missing,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Equipment Quantity Changed',
          status: 409,
          detail:
            'Equipment quantities changed before the transition could be recorded. Refresh the item and try again.',
        });
      }

      const updatedEquipment = await tx.gymEquipmentItem.findUnique({
        where: { id: equipmentId },
        include: equipmentListInclude,
      });

      if (!updatedEquipment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipmentItem Not Found',
          status: 404,
          detail: `GymEquipmentItem with id "${equipmentId}" does not exist.`,
        });
      }

      return updatedEquipment;
    });
  }

  archiveEquipmentUnits(
    performerId: string,
    equipmentId: string,
    quantityToArchive: number,
    reason: string,
  ): Promise<ArchivedEquipmentRecord> {
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

      if (quantityToArchive > equipment.quantity_current) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Invalid Equipment Archive',
            status: 422,
            detail:
              'quantity_to_archive cannot be greater than the current equipment quantity.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const quantityBefore = equipment.quantity_current;
      const quantitySetTo = quantityBefore - quantityToArchive;
      const quantityTotal = equipment.quantity_total - quantityToArchive;

      const updateResult = await tx.gymEquipmentItem.updateMany({
        where: {
          id: equipmentId,
          quantity_current: quantityBefore,
          quantity_total: equipment.quantity_total,
        },
        data: {
          quantity_current: quantitySetTo,
          quantity_total: quantityTotal,
          is_active: quantityTotal > 0 ? equipment.is_active : false,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Equipment Quantity Changed',
          status: 409,
          detail:
            'Equipment quantity changed before the archive could be recorded. Refresh the item and try again.',
        });
      }

      await tx.equipmentWriteOff.create({
        data: {
          quantity_before: quantityBefore,
          quantity_set_to: quantitySetTo,
          quantity_lost: quantityToArchive,
          reason,
          equipment: { connect: { id: equipmentId } },
          performer: { connect: { id: performerId } },
        },
      });

      const updatedEquipment = await tx.gymEquipmentItem.findUnique({
        where: { id: equipmentId },
        include: equipmentLayoutInclude,
      });

      if (!updatedEquipment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipmentItem Not Found',
          status: 404,
          detail: `GymEquipmentItem with id "${equipmentId}" does not exist.`,
        });
      }

      return {
        equipment: updatedEquipment,
        quantityBefore,
        quantitySetTo,
      };
    });
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

const gymLayoutEquipmentOrderBy: Prisma.GymEquipmentOrderByWithRelationInput[] =
  [{ type: 'asc' }, { name: 'asc' }];

const gymLayoutEquipmentInclude = {
  inventory_item: {
    select: {
      id: true,
      name: true,
      image_url: true,
      quantity_current: true,
      is_active: true,
      _count: {
        select: {
          layout_nodes: {
            where: { is_active: true },
          },
        },
      },
    },
  },
  venue: {
    select: {
      id: true,
      name: true,
      floor_id: true,
      grid_column: true,
      grid_row: true,
      grid_width: true,
      grid_height: true,
      status: true,
      is_active: true,
    },
  },
} satisfies Prisma.GymEquipmentInclude;

export type GymLayoutEquipmentRecord = Prisma.GymEquipmentGetPayload<{
  include: typeof gymLayoutEquipmentInclude;
}>;

export type GymLayoutVenueRecord = NonNullable<
  GymLayoutEquipmentRecord['venue']
>;

export type FacilityFloorPlanMediaRow = {
  created_at: Date;
  floor_id: string;
  grid_height: number;
  grid_width: number;
  image_url: string | null;
  updated_at: Date;
};

@Injectable()
export class GymLayoutRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listActiveEquipment(): Promise<GymLayoutEquipmentRecord[]> {
    return this.findActive<GymLayoutEquipmentRecord>(
      this.prisma.gymEquipment,
      undefined,
      gymLayoutEquipmentOrderBy,
      gymLayoutEquipmentInclude,
    );
  }

  listArchivedEquipment(): Promise<GymLayoutEquipmentRecord[]> {
    return this.findAll<GymLayoutEquipmentRecord>(
      this.prisma.gymEquipment,
      { is_active: false },
      gymLayoutEquipmentInclude,
      gymLayoutEquipmentOrderBy,
    );
  }

  findEquipmentByIdOrThrow(id: string): Promise<GymLayoutEquipmentRecord> {
    return this.findByIdOrThrow<GymLayoutEquipmentRecord>(
      this.prisma.gymEquipment,
      id,
      'GymEquipment',
      gymLayoutEquipmentInclude,
    );
  }

  createEquipment(
    data: Prisma.GymEquipmentCreateInput,
  ): Promise<GymLayoutEquipmentRecord> {
    return this.transaction(async (tx) => {
      const inventoryItemId = this.connectedId(data.inventory_item);
      if (!inventoryItemId) {
        throw new ConflictException({
          type: 'CONTRACT_VIOLATION',
          title: 'Inventory Link Required',
          status: 409,
          detail: 'New layout equipment must be linked to an inventory item.',
        });
      }

      const inventory = await tx.gymEquipmentItem.findUnique({
        where: { id: inventoryItemId },
        select: { is_active: true, quantity_current: true },
      });

      if (!inventory) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipmentItem Not Found',
          status: 404,
          detail: `GymEquipmentItem with id "${inventoryItemId}" does not exist.`,
        });
      }

      if (!inventory.is_active) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Inactive Inventory Item',
          status: 409,
          detail: 'Inactive inventory equipment cannot be placed on a venue layout.',
        });
      }

      const placedCount = await tx.gymEquipment.count({
        where: { inventory_item_id: inventoryItemId, is_active: true },
      });

      if (placedCount >= inventory.quantity_current) {
        throw new ConflictException({
          type: 'PLACEMENT_CAPACITY_EXCEEDED',
          title: 'No Placeable Inventory Remaining',
          status: 409,
          detail: 'The available inventory quantity has already been placed.',
        });
      }

      return tx.gymEquipment.create({
        data,
        include: gymLayoutEquipmentInclude,
      });
    });
  }

  updateEquipment(
    id: string,
    data: Prisma.GymEquipmentUpdateInput,
  ): Promise<GymLayoutEquipmentRecord> {
    return this.transaction(async (tx) => {
      const existing = await tx.gymEquipment.findUnique({
        where: { id },
        select: { inventory_item_id: true, is_active: true },
      });

      if (!existing) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipment Not Found',
          status: 404,
          detail: `GymEquipment with id "${id}" does not exist.`,
        });
      }

      const connectedInventoryItemId = this.connectedId(data.inventory_item);
      const inventoryItemId =
        connectedInventoryItemId ??
        (data.is_active === true ? existing.inventory_item_id : null);

      if (inventoryItemId) {
        const inventory = await tx.gymEquipmentItem.findUnique({
          where: { id: inventoryItemId },
          select: { is_active: true, quantity_current: true },
        });
        const placedCount = await tx.gymEquipment.count({
          where: {
            inventory_item_id: inventoryItemId,
            is_active: true,
            id: { not: id },
          },
        });

        if (!inventory?.is_active || placedCount >= inventory.quantity_current) {
          throw new ConflictException({
            type: 'PLACEMENT_CAPACITY_EXCEEDED',
            title: 'No Placeable Inventory Remaining',
            status: 409,
            detail: 'The available inventory quantity cannot support this placement.',
          });
        }
      }

      return tx.gymEquipment.update({
        where: { id },
        data,
        include: gymLayoutEquipmentInclude,
      });
    });
  }

  softDeleteEquipment(id: string): Promise<GymLayoutEquipmentRecord> {
    return this.updateById<GymLayoutEquipmentRecord>(
      this.prisma.gymEquipment,
      id,
      { is_active: false },
      gymLayoutEquipmentInclude,
    );
  }

  restoreEquipment(id: string): Promise<GymLayoutEquipmentRecord> {
    return this.transaction(async (tx) => {
      const existing = await tx.gymEquipment.findUnique({
        where: { id },
        select: { inventory_item_id: true, is_active: true },
      });

      if (!existing) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'GymEquipment Not Found',
          status: 404,
          detail: `GymEquipment with id "${id}" does not exist.`,
        });
      }

      if (existing.inventory_item_id) {
        const inventory = await tx.gymEquipmentItem.findUnique({
          where: { id: existing.inventory_item_id },
          select: { is_active: true, quantity_current: true },
        });
        const placedCount = await tx.gymEquipment.count({
          where: {
            inventory_item_id: existing.inventory_item_id,
            is_active: true,
            id: { not: id },
          },
        });

        if (!inventory?.is_active || placedCount >= inventory.quantity_current) {
          throw new ConflictException({
            type: 'PLACEMENT_CAPACITY_EXCEEDED',
            title: 'No Placeable Inventory Remaining',
            status: 409,
            detail: 'The available inventory quantity cannot support restoring this placement.',
          });
        }
      }

      return tx.gymEquipment.update({
        where: { id },
        data: { is_active: true },
        include: gymLayoutEquipmentInclude,
      });
    });
  }

  async findActiveVenueByIdOrThrow(id: string): Promise<GymLayoutVenueRecord> {
    const venue = await this.prisma.amenity.findFirst({
      where: { id, is_active: true },
      select: {
        id: true,
        name: true,
        floor_id: true,
        grid_column: true,
        grid_row: true,
        grid_width: true,
        grid_height: true,
        status: true,
        is_active: true,
      },
    });

    if (!venue) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Amenity Not Found',
        status: 404,
        detail: `Amenity with id "${id}" does not exist or is inactive.`,
      });
    }

    return venue;
  }

  private connectedId(relation: unknown): string | null {
    if (!relation || typeof relation !== 'object') return null;
    const connect = (relation as { connect?: { id?: unknown } }).connect;
    return typeof connect?.id === 'string' ? connect.id : null;
  }

  listFloorPlanMedia(): Promise<FacilityFloorPlanMediaRow[]> {
    return this.prisma.$queryRaw<FacilityFloorPlanMediaRow[]>`
      SELECT floor_id, image_url, grid_width, grid_height, created_at, updated_at
      FROM facility_floor_plan_media
      ORDER BY floor_id ASC
    `;
  }

  async upsertFloorPlanMedia(
    floorId: string,
    updates: { gridHeight?: number; gridWidth?: number; imageUrl?: string | null },
  ): Promise<FacilityFloorPlanMediaRow> {
    const rows = await this.prisma.$queryRaw<FacilityFloorPlanMediaRow[]>`
      INSERT INTO facility_floor_plan_media (floor_id, image_url, grid_width, grid_height)
      VALUES (${floorId}, ${updates.imageUrl ?? null}, ${updates.gridWidth ?? 15}, ${updates.gridHeight ?? 10})
      ON CONFLICT (floor_id)
      DO UPDATE SET
        image_url = CASE
          WHEN ${updates.imageUrl !== undefined} THEN ${updates.imageUrl ?? null}
          ELSE facility_floor_plan_media.image_url
        END,
        grid_width = COALESCE(${updates.gridWidth}, facility_floor_plan_media.grid_width),
        grid_height = COALESCE(${updates.gridHeight}, facility_floor_plan_media.grid_height),
        updated_at = CURRENT_TIMESTAMP
      RETURNING floor_id, image_url, grid_width, grid_height, created_at, updated_at
    `;

    return rows[0];
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

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

export type FacilityFloorPlanMediaRow = Prisma.FacilityFloorPlanMediaGetPayload<
  Record<string, never>
>;

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

  listSnapshotRegions() {
    return this.prisma.amenity.findMany({
      where: { is_active: true, is_mapped: true },
      orderBy: [{ floor_id: 'asc' }, { display_order: 'asc' }, { name: 'asc' }],
    });
  }

  listOperatingHours() {
    return this.prisma.gymOperatingHour.findMany({
      where: { is_active: true },
      orderBy: { day_of_week: 'asc' },
      select: {
        day_of_week: true,
        opens_at: true,
        closes_at: true,
        is_closed: true,
        label: true,
      },
    });
  }

  listActiveBookingsForRange(rangeStart: Date, rangeEnd: Date) {
    return this.prisma.amenityBooking.findMany({
      where: {
        status: {
          in: [
            BookingStatus.pending,
            BookingStatus.confirmed,
            BookingStatus.balance_pending,
          ],
        },
        starts_at: { lt: rangeEnd },
        ends_at: { gt: rangeStart },
      },
      select: {
        id: true,
        amenity_id: true,
        starts_at: true,
        ends_at: true,
      },
      orderBy: [{ starts_at: 'asc' }, { id: 'asc' }],
    });
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
          detail:
            'Inactive inventory equipment cannot be placed on a venue layout.',
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

        if (
          !inventory?.is_active ||
          placedCount >= inventory.quantity_current
        ) {
          throw new ConflictException({
            type: 'PLACEMENT_CAPACITY_EXCEEDED',
            title: 'No Placeable Inventory Remaining',
            status: 409,
            detail:
              'The available inventory quantity cannot support this placement.',
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

        if (
          !inventory?.is_active ||
          placedCount >= inventory.quantity_current
        ) {
          throw new ConflictException({
            type: 'PLACEMENT_CAPACITY_EXCEEDED',
            title: 'No Placeable Inventory Remaining',
            status: 409,
            detail:
              'The available inventory quantity cannot support restoring this placement.',
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
    return this.prisma.facilityFloorPlanMedia.findMany({
      orderBy: { floor_id: 'asc' },
    });
  }

  async upsertFloorPlanMedia(
    floorId: string,
    updates: {
      entryCells?: Prisma.InputJsonValue;
      exitCells?: Prisma.InputJsonValue;
      footprintCells?: Prisma.InputJsonValue;
      imageUrl?: string | null;
      pathCells?: Prisma.InputJsonValue;
    },
  ): Promise<FacilityFloorPlanMediaRow> {
    const fullFootprint = Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 14 }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    ).flat();
    return this.prisma.facilityFloorPlanMedia.upsert({
      where: { floor_id: floorId },
      create: {
        floor_id: floorId,
        grid_width: 14,
        grid_height: 10,
        image_url: updates.imageUrl ?? null,
        footprint_cells: updates.footprintCells ?? fullFootprint,
        path_cells: updates.pathCells ?? [],
        entry_cells: updates.entryCells ?? [],
        exit_cells: updates.exitCells ?? [],
      },
      update: {
        grid_width: 14,
        grid_height: 10,
        ...(updates.imageUrl !== undefined
          ? { image_url: updates.imageUrl }
          : {}),
        ...(updates.footprintCells !== undefined
          ? { footprint_cells: updates.footprintCells }
          : {}),
        ...(updates.pathCells !== undefined
          ? { path_cells: updates.pathCells }
          : {}),
        ...(updates.entryCells !== undefined
          ? { entry_cells: updates.entryCells }
          : {}),
        ...(updates.exitCells !== undefined
          ? { exit_cells: updates.exitCells }
          : {}),
      },
    });
  }
}

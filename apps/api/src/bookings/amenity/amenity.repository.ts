import { Injectable } from '@nestjs/common';
import { Amenity, AmenityFeedback, Prisma } from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { isAmenityBookable } from './amenity-reservability';

@Injectable()
export class AmenityRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listActiveAmenities(): Promise<Amenity[]> {
    return this.findActive<Amenity>(this.prisma.amenity, undefined, [
      { type: 'asc' },
      { name: 'asc' },
    ]);
  }

  listReservableOperationalAmenities(): Promise<Amenity[]> {
    return this.prisma.amenity.findMany({
      where: {
        is_active: true,
        is_mapped: true,
        is_reservable: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async listBookableAmenities(): Promise<Amenity[]> {
    const amenities = await this.listActiveAmenities();
    return amenities.filter(isAmenityBookable);
  }

  listArchivedAmenities(): Promise<Amenity[]> {
    return this.findAll<Amenity>(
      this.prisma.amenity,
      { is_active: false },
      undefined,
      [{ type: 'asc' }, { name: 'asc' }],
    );
  }

  findActiveAmenityByIdOrThrow(id: string): Promise<Amenity> {
    return this.findOneOrThrow<Amenity>(
      this.prisma.amenity,
      { id, is_active: true },
      'Amenity',
    );
  }

  findAmenityByIdOrThrow(id: string): Promise<Amenity> {
    return this.findByIdOrThrow<Amenity>(this.prisma.amenity, id, 'Amenity');
  }

  createAmenity(data: Prisma.AmenityCreateInput): Promise<Amenity> {
    return this.create<Amenity>(this.prisma.amenity, data);
  }

  listMappedAmenitiesForFloor(floorId: string, excludingId?: string) {
    return this.prisma.amenity.findMany({
      where: {
        floor_id: floorId,
        is_active: true,
        is_mapped: true,
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
    });
  }

  getFloorMap(floorId: string) {
    return this.prisma.facilityFloorPlanMedia.findUnique({
      where: { floor_id: floorId },
    });
  }

  listEquipmentForVenue(venueId: string) {
    return this.prisma.gymEquipment.findMany({
      where: { venue_id: venueId, is_active: true },
    });
  }

  createAmenityFeedback(
    data: Prisma.AmenityFeedbackCreateInput,
  ): Promise<AmenityFeedback> {
    return this.create<AmenityFeedback>(this.prisma.amenityFeedback, data);
  }

  listAmenityFeedback(limit = 25) {
    return this.prisma.amenityFeedback.findMany({
      take: limit,
      orderBy: [{ created_at: 'desc' }],
      include: {
        amenity: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  }

  listAmenityFeedbackForAmenity(amenityId: string, limit = 10) {
    return this.prisma.amenityFeedback.findMany({
      where: { amenity_id: amenityId },
      take: limit,
      orderBy: [{ created_at: 'desc' }],
      include: {
        amenity: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  }

  async listAmenityFeedbackHistoryForAmenity(
    amenityId: string,
    page: number,
    limit: number,
  ) {
    const where: Prisma.AmenityFeedbackWhereInput = {
      amenity_id: amenityId,
    };
    const include = {
      amenity: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      user: {
        select: {
          id: true,
          role: true,
          profile: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      },
    } as const;
    const [items, total, summary] = await Promise.all([
      this.prisma.amenityFeedback.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include,
      }),
      this.prisma.amenityFeedback.count({ where }),
      this.prisma.amenityFeedback.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    return { items, total, averageRating: summary._avg.rating ?? null };
  }

  updateAmenity(id: string, data: Prisma.AmenityUpdateInput): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, data);
  }

  moveAmenityAndEquipment(
    id: string,
    data: Prisma.AmenityUpdateInput,
    equipmentMoves: Array<{ id: string; gridColumn: number; gridRow: number }>,
  ): Promise<Amenity> {
    const destinationFloorId =
      typeof data.floor_id === 'string'
        ? data.floor_id
        : data.floor_id &&
            typeof data.floor_id === 'object' &&
            'set' in data.floor_id &&
            typeof data.floor_id.set === 'string'
          ? data.floor_id.set
          : null;

    return this.transaction(async (tx) => {
      for (const move of equipmentMoves) {
        await tx.gymEquipment.update({
          where: { id: move.id },
          data: {
            ...(destinationFloorId ? { floor_id: destinationFloorId } : {}),
            grid_column: move.gridColumn,
            grid_row: move.gridRow,
            grid_width: 1,
            grid_height: 1,
            position_x: Number(
              (((move.gridColumn - 0.5) / 14) * 100).toFixed(2),
            ),
            position_y: Number((((move.gridRow - 0.5) / 10) * 100).toFixed(2)),
          },
        });
      }
      return tx.amenity.update({ where: { id }, data });
    });
  }

  softDeleteAmenity(id: string): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, {
      is_active: false,
    });
  }

  restoreAmenity(id: string): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, {
      is_active: true,
    });
  }
}

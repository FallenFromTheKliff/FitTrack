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

  updateAmenity(id: string, data: Prisma.AmenityUpdateInput): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, data);
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

import { Injectable } from '@nestjs/common';
import { Amenity, Prisma } from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';

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

  updateAmenity(id: string, data: Prisma.AmenityUpdateInput): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, data);
  }

  softDeleteAmenity(id: string): Promise<Amenity> {
    return this.updateById<Amenity>(this.prisma.amenity, id, {
      is_active: false,
    });
  }
}

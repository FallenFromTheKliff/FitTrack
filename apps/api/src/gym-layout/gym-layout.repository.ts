import { Injectable } from '@nestjs/common';
import { GymEquipment, Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

const gymLayoutEquipmentOrderBy: Prisma.GymEquipmentOrderByWithRelationInput[] =
  [{ type: 'asc' }, { name: 'asc' }];

export type FacilityFloorPlanMediaRow = {
  created_at: Date;
  floor_id: string;
  image_url: string | null;
  updated_at: Date;
};

@Injectable()
export class GymLayoutRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listActiveEquipment(): Promise<GymEquipment[]> {
    return this.findActive<GymEquipment>(
      this.prisma.gymEquipment,
      undefined,
      gymLayoutEquipmentOrderBy,
    );
  }

  listArchivedEquipment(): Promise<GymEquipment[]> {
    return this.findAll<GymEquipment>(
      this.prisma.gymEquipment,
      { is_active: false },
      undefined,
      gymLayoutEquipmentOrderBy,
    );
  }

  findEquipmentByIdOrThrow(id: string): Promise<GymEquipment> {
    return this.findByIdOrThrow<GymEquipment>(
      this.prisma.gymEquipment,
      id,
      'GymEquipment',
    );
  }

  createEquipment(data: Prisma.GymEquipmentCreateInput): Promise<GymEquipment> {
    return this.create<GymEquipment>(this.prisma.gymEquipment, data);
  }

  updateEquipment(
    id: string,
    data: Prisma.GymEquipmentUpdateInput,
  ): Promise<GymEquipment> {
    return this.updateById<GymEquipment>(this.prisma.gymEquipment, id, data);
  }

  softDeleteEquipment(id: string): Promise<GymEquipment> {
    return this.updateById<GymEquipment>(this.prisma.gymEquipment, id, {
      is_active: false,
    });
  }

  restoreEquipment(id: string): Promise<GymEquipment> {
    return this.updateById<GymEquipment>(this.prisma.gymEquipment, id, {
      is_active: true,
    });
  }

  listFloorPlanMedia(): Promise<FacilityFloorPlanMediaRow[]> {
    return this.prisma.$queryRaw<FacilityFloorPlanMediaRow[]>`
      SELECT floor_id, image_url, created_at, updated_at
      FROM facility_floor_plan_media
      ORDER BY floor_id ASC
    `;
  }

  async upsertFloorPlanMedia(
    floorId: string,
    imageUrl: string | null,
  ): Promise<FacilityFloorPlanMediaRow> {
    const rows = await this.prisma.$queryRaw<FacilityFloorPlanMediaRow[]>`
      INSERT INTO facility_floor_plan_media (floor_id, image_url)
      VALUES (${floorId}, ${imageUrl})
      ON CONFLICT (floor_id)
      DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = CURRENT_TIMESTAMP
      RETURNING floor_id, image_url, created_at, updated_at
    `;

    return rows[0];
  }
}

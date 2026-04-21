import { Injectable } from '@nestjs/common';
import { GymEquipment, Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

const gymLayoutEquipmentOrderBy: Prisma.GymEquipmentOrderByWithRelationInput[] =
  [{ type: 'asc' }, { name: 'asc' }];

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
}

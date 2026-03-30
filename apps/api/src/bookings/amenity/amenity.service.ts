import { Injectable } from '@nestjs/common';
import { Amenity, Prisma } from '@prisma/client';

import { AmenityRepository } from './amenity.repository';
import { CreateAmenityDTO, UpdateAmenityDTO } from './dto/amenity.dto';

const AMENITY_UPDATE_FIELDS = [
  'name',
  'type',
  'description',
  'capacity',
  'hourly_rate',
  'requires_subscription',
  'is_active',
] as const;

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class AmenityService {
  constructor(private readonly repo: AmenityRepository) {}

  listAmenities(): Promise<Amenity[]> {
    return this.repo.listActiveAmenities();
  }

  getAmenityById(id: string): Promise<Amenity> {
    return this.repo.findActiveAmenityByIdOrThrow(id);
  }

  createAmenity(dto: CreateAmenityDTO): Promise<Amenity> {
    return this.repo.createAmenity(this.toCreateInput(dto));
  }

  updateAmenity(id: string, dto: UpdateAmenityDTO): Promise<Amenity> {
    return this.repo.updateAmenity(id, this.toUpdateInput(dto));
  }

  async deleteAmenity(id: string): Promise<void> {
    await this.repo.softDeleteAmenity(id);
  }

  private toCreateInput(dto: CreateAmenityDTO): Prisma.AmenityCreateInput {
    return {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      capacity: dto.capacity ?? 1,
      hourly_rate: dto.hourly_rate ?? 0,
      requires_subscription: dto.requires_subscription ?? false,
    };
  }

  private toUpdateInput(dto: UpdateAmenityDTO): Prisma.AmenityUpdateInput {
    return {
      ...pickDefined(dto, AMENITY_UPDATE_FIELDS),
    };
  }
}

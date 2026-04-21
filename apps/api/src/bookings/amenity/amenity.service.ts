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
  'minimum_hours',
  'icon_key',
  'grid_column',
  'grid_row',
  'grid_width',
  'grid_height',
  'is_reservable',
  'display_order',
  'floor_id',
  'requires_subscription',
  'is_active',
] as const;

type AmenityLayoutDefaults = {
  display_order: number;
  floor_id: string;
  grid_column: number;
  grid_height: number;
  grid_row: number;
  grid_width: number;
  icon_key: string;
  is_reservable: boolean;
  minimum_hours: number;
};

const DEFAULT_AMENITY_LAYOUTS: Record<string, AmenityLayoutDefaults> = {
  basketball: {
    display_order: 3,
    floor_id: 'floor-1',
    grid_column: 9,
    grid_height: 4,
    grid_row: 1,
    grid_width: 6,
    icon_key: 'basketball',
    is_reservable: true,
    minimum_hours: 1,
  },
  boxing: {
    display_order: 1,
    floor_id: 'floor-2',
    grid_column: 3,
    grid_height: 4,
    grid_row: 3,
    grid_width: 5,
    icon_key: 'boxing',
    is_reservable: true,
    minimum_hours: 1,
  },
  'gym-area': {
    display_order: 2,
    floor_id: 'floor-1',
    grid_column: 4,
    grid_height: 4,
    grid_row: 1,
    grid_width: 5,
    icon_key: 'gym-area',
    is_reservable: false,
    minimum_hours: 1,
  },
  reception: {
    display_order: 1,
    floor_id: 'floor-1',
    grid_column: 1,
    grid_height: 2,
    grid_row: 1,
    grid_width: 3,
    icon_key: 'reception',
    is_reservable: false,
    minimum_hours: 1,
  },
  volleyball: {
    display_order: 4,
    floor_id: 'floor-1',
    grid_column: 1,
    grid_height: 5,
    grid_row: 5,
    grid_width: 7,
    icon_key: 'volleyball',
    is_reservable: true,
    minimum_hours: 1,
  },
  yoga: {
    display_order: 1,
    floor_id: 'floor-3',
    grid_column: 4,
    grid_height: 6,
    grid_row: 2,
    grid_width: 8,
    icon_key: 'yoga',
    is_reservable: true,
    minimum_hours: 1,
  },
};

function normalizeAmenityText(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function inferAmenityIconKey(dto: Pick<CreateAmenityDTO, 'icon_key' | 'name' | 'type'>) {
  const iconKey = normalizeAmenityText(dto.icon_key);
  const name = normalizeAmenityText(dto.name);
  const type = normalizeAmenityText(dto.type);
  const combined = [iconKey, name, type].filter(Boolean).join(' ');

  if (combined.includes('basketball')) return 'basketball';
  if (combined.includes('volleyball')) return 'volleyball';
  if (combined.includes('boxing')) return 'boxing';
  if (combined.includes('yoga')) return 'yoga';
  if (combined.includes('reception') || combined.includes('front desk')) {
    return 'reception';
  }
  if (combined.includes('gym')) return 'gym-area';
  return 'gym-area';
}

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
    const iconKey = inferAmenityIconKey(dto);
    const layout = DEFAULT_AMENITY_LAYOUTS[iconKey] ?? DEFAULT_AMENITY_LAYOUTS['gym-area'];

    return {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      capacity: dto.capacity ?? 1,
      hourly_rate: dto.hourly_rate ?? 0,
      minimum_hours: dto.minimum_hours ?? layout.minimum_hours,
      icon_key: dto.icon_key ?? layout.icon_key,
      grid_column: dto.grid_column ?? layout.grid_column,
      grid_row: dto.grid_row ?? layout.grid_row,
      grid_width: dto.grid_width ?? layout.grid_width,
      grid_height: dto.grid_height ?? layout.grid_height,
      is_reservable: dto.is_reservable ?? layout.is_reservable,
      display_order: dto.display_order ?? layout.display_order,
      floor_id: dto.floor_id ?? layout.floor_id,
      requires_subscription: dto.requires_subscription ?? false,
    };
  }

  private toUpdateInput(dto: UpdateAmenityDTO): Prisma.AmenityUpdateInput {
    return {
      ...pickDefined(dto, AMENITY_UPDATE_FIELDS),
    };
  }
}

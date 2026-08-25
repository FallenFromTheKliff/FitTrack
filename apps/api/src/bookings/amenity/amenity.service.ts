import { BadRequestException, Injectable } from '@nestjs/common';
import { Amenity, EquipmentStatus, Prisma } from '@prisma/client';

import { AmenityRepository } from './amenity.repository';
import {
  CreateAmenityDTO,
  CreateAmenityFeedbackDTO,
  UpdateAmenityDTO,
} from './dto/amenity.dto';
import {
  assertNoRegionOverlap,
  assertRectangleInFootprint,
  expandFacilityRectangle,
  facilityCellKey,
  normalizeFacilityCells,
  type FacilityGridRectangle,
} from '../../gym-layout/facility-layout.validation';

const AMENITY_UPDATE_FIELDS = [
  'name',
  'type',
  'description',
  'capacity',
  'hourly_rate',
  'minimum_hours',
  'icon_key',
  'image_url',
  'image_fit',
  'image_focal_x',
  'image_focal_y',
  'image_crop_zoom',
  'grid_column',
  'grid_row',
  'grid_width',
  'grid_height',
  'is_reservable',
  'display_order',
  'floor_id',
  'requires_subscription',
  'status',
  'is_mapped',
  'is_active',
] as const;

function getAmenityFeedbackUserName(
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null,
) {
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Unknown user';
}

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

function inferAmenityIconKey(
  dto: Pick<CreateAmenityDTO, 'icon_key' | 'name' | 'type'>,
) {
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

function assertReservableHourlyRate(
  isReservable: boolean,
  hourlyRate: number | Prisma.Decimal | null | undefined,
) {
  const normalizedRate =
    hourlyRate instanceof Prisma.Decimal
      ? hourlyRate.toNumber()
      : typeof hourlyRate === 'number'
        ? hourlyRate
        : undefined;

  if (!isReservable || (normalizedRate !== undefined && normalizedRate > 0)) {
    return;
  }

  throw new BadRequestException(
    'Reservable venues require an hourly_rate greater than 0',
  );
}

@Injectable()
export class AmenityService {
  constructor(private readonly repo: AmenityRepository) {}

  listAmenities(): Promise<Amenity[]> {
    return this.repo.listBookableAmenities();
  }

  listOperationalAmenities(): Promise<Amenity[]> {
    return this.repo.listActiveAmenities();
  }

  listArchivedAmenities(): Promise<Amenity[]> {
    return this.repo.listArchivedAmenities();
  }

  getAmenityById(id: string): Promise<Amenity> {
    return this.repo.findActiveAmenityByIdOrThrow(id);
  }

  async createAmenity(dto: CreateAmenityDTO): Promise<Amenity> {
    const data = this.toCreateInput(dto);
    await this.validateLayout(null, {
      floorId: String(data.floor_id),
      gridColumn: Number(data.grid_column),
      gridRow: Number(data.grid_row),
      gridWidth: Number(data.grid_width),
      gridHeight: Number(data.grid_height),
      isMapped: true,
    });
    return this.repo.createAmenity(data);
  }

  async updateAmenity(id: string, dto: UpdateAmenityDTO): Promise<Amenity> {
    const existing = await this.repo.findAmenityByIdOrThrow(id);
    const nextReservable = dto.is_reservable ?? existing.is_reservable ?? false;
    const nextHourlyRate = dto.hourly_rate ?? existing.hourly_rate;
    assertReservableHourlyRate(nextReservable, nextHourlyRate);

    const data = this.toUpdateInput(dto);
    const layoutRequested =
      dto.floor_id !== undefined ||
      dto.grid_column !== undefined ||
      dto.grid_row !== undefined ||
      dto.grid_width !== undefined ||
      dto.grid_height !== undefined ||
      dto.is_mapped !== undefined;
    if (!layoutRequested) return this.repo.updateAmenity(id, data);
    const next = {
      floorId: dto.floor_id ?? existing.floor_id,
      gridColumn: dto.grid_column ?? existing.grid_column,
      gridRow: dto.grid_row ?? existing.grid_row,
      gridWidth: dto.grid_width ?? existing.grid_width,
      gridHeight: dto.grid_height ?? existing.grid_height,
      isMapped: dto.is_mapped ?? existing.is_mapped,
    };
    const equipmentMoves = await this.validateLayout(
      id,
      {
        floorId: next.floorId,
        gridColumn: next.gridColumn,
        gridRow: next.gridRow,
        gridWidth: next.gridWidth,
        gridHeight: next.gridHeight,
        isMapped: next.isMapped,
      },
      existing,
    );
    return this.repo.moveAmenityAndEquipment(id, data, equipmentMoves);
  }

  private async validateLayout(
    amenityId: string | null,
    layout: {
      floorId: string | null;
      gridColumn: number | null;
      gridRow: number | null;
      gridWidth: number | null;
      gridHeight: number | null;
      isMapped: boolean;
    },
    existing?: Amenity,
  ) {
    if (!layout.isMapped) return [];
    if (
      layout.floorId == null ||
      layout.gridColumn == null ||
      layout.gridRow == null ||
      layout.gridWidth == null ||
      layout.gridHeight == null
    ) {
      throw new BadRequestException({
        type: 'INVALID_FACILITY_LAYOUT',
        title: 'Mapped Region Geometry Required',
        status: 400,
        detail: 'Mapped regions require a floor and complete grid rectangle.',
      });
    }
    const rectangle: FacilityGridRectangle = {
      gridColumn: layout.gridColumn,
      gridRow: layout.gridRow,
      gridWidth: layout.gridWidth,
      gridHeight: layout.gridHeight,
    };
    const [floorMap, others, equipment] = await Promise.all([
      this.repo.getFloorMap(layout.floorId),
      this.repo.listMappedAmenitiesForFloor(
        layout.floorId,
        amenityId ?? undefined,
      ),
      amenityId
        ? this.repo.listEquipmentForVenue(amenityId)
        : Promise.resolve<
            Awaited<ReturnType<AmenityRepository['listEquipmentForVenue']>>
          >([]),
    ]);
    const footprint = normalizeFacilityCells(floorMap?.footprint_cells);
    assertRectangleInFootprint(rectangle, footprint);
    assertNoRegionOverlap(
      rectangle,
      others.flatMap((region) =>
        region.grid_column == null ||
        region.grid_row == null ||
        region.grid_width == null ||
        region.grid_height == null
          ? []
          : [
              {
                gridColumn: region.grid_column,
                gridRow: region.grid_row,
                gridWidth: region.grid_width,
                gridHeight: region.grid_height,
              },
            ],
      ),
    );
    const occupied = new Set(
      expandFacilityRectangle(rectangle).map(facilityCellKey),
    );
    if (
      normalizeFacilityCells(floorMap?.path_cells).some((cell) =>
        occupied.has(facilityCellKey(cell)),
      )
    ) {
      throw new BadRequestException({
        type: 'INVALID_FACILITY_LAYOUT',
        title: 'Region Crosses Path',
        status: 400,
        detail: 'Mapped regions cannot overlap published path cells.',
      });
    }
    const columnDelta =
      existing?.grid_column == null
        ? 0
        : rectangle.gridColumn - existing.grid_column;
    const rowDelta =
      existing?.grid_row == null ? 0 : rectangle.gridRow - existing.grid_row;
    const footprintKeys = new Set(footprint.map(facilityCellKey));
    const moves = equipment.map((item) => ({
      id: item.id,
      gridColumn: (item.grid_column ?? 1) + columnDelta,
      gridRow: (item.grid_row ?? 1) + rowDelta,
    }));
    const uniqueCells = new Set(
      moves.map((move) => `${move.gridColumn}:${move.gridRow}`),
    );
    if (
      uniqueCells.size !== moves.length ||
      moves.some(
        (move) =>
          !occupied.has(`${move.gridColumn}:${move.gridRow}`) ||
          !footprintKeys.has(`${move.gridColumn}:${move.gridRow}`),
      )
    ) {
      throw new BadRequestException({
        type: 'INVALID_VENUE_CONTAINMENT',
        title: 'Equipment Outside Venue Bounds',
        status: 400,
        detail:
          'The venue change would leave equipment outside its venue or overlap equipment cells.',
      });
    }
    return moves;
  }

  async deleteAmenity(id: string): Promise<void> {
    await this.repo.softDeleteAmenity(id);
  }

  restoreAmenity(id: string): Promise<Amenity> {
    return this.repo.restoreAmenity(id);
  }

  async submitFeedback(
    amenityId: string,
    userId: string,
    dto: CreateAmenityFeedbackDTO,
  ) {
    await this.repo.findActiveAmenityByIdOrThrow(amenityId);

    return this.repo.createAmenityFeedback({
      amenity: { connect: { id: amenityId } },
      user: { connect: { id: userId } },
      comment: dto.comment ?? null,
      rating: dto.rating,
    });
  }

  async listFeedback() {
    const feedback = await this.repo.listAmenityFeedback();

    return feedback.map((entry) => this.toFeedbackResponse(entry));
  }

  async listFeedbackForAmenity(amenityId: string) {
    await this.repo.findActiveAmenityByIdOrThrow(amenityId);
    const feedback = await this.repo.listAmenityFeedbackForAmenity(amenityId);

    return feedback.map((entry) => this.toFeedbackResponse(entry));
  }

  private toFeedbackResponse(
    entry: Awaited<
      ReturnType<AmenityRepository['listAmenityFeedback']>
    >[number],
  ) {
    return {
      amenity: {
        id: entry.amenity.id,
        name: entry.amenity.name,
        type: entry.amenity.type,
      },
      comment: entry.comment,
      created_at: entry.created_at.toISOString(),
      id: entry.id,
      rating: entry.rating,
      submitted_by: {
        id: entry.user.id,
        name: getAmenityFeedbackUserName(entry.user.profile),
        role: entry.user.role,
      },
      updated_at: entry.updated_at.toISOString(),
    };
  }

  private toCreateInput(dto: CreateAmenityDTO): Prisma.AmenityCreateInput {
    const iconKey = inferAmenityIconKey(dto);
    const layout =
      DEFAULT_AMENITY_LAYOUTS[iconKey] ?? DEFAULT_AMENITY_LAYOUTS['gym-area'];
    const isReservable = dto.is_reservable ?? layout.is_reservable;
    const hourlyRate = dto.hourly_rate ?? (isReservable ? undefined : 0);

    assertReservableHourlyRate(isReservable, hourlyRate);
    const persistedHourlyRate = hourlyRate ?? 0;

    return {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      capacity: dto.capacity ?? 1,
      hourly_rate: persistedHourlyRate,
      minimum_hours: dto.minimum_hours ?? layout.minimum_hours,
      icon_key: dto.icon_key ?? layout.icon_key,
      image_url: dto.image_url ?? null,
      image_fit: dto.image_fit ?? 'cover',
      image_focal_x: dto.image_focal_x ?? 0.5,
      image_focal_y: dto.image_focal_y ?? 0.5,
      image_crop_zoom: dto.image_crop_zoom ?? 1,
      grid_column: dto.grid_column ?? layout.grid_column,
      grid_row: dto.grid_row ?? layout.grid_row,
      grid_width: dto.grid_width ?? layout.grid_width,
      grid_height: dto.grid_height ?? layout.grid_height,
      is_reservable: isReservable,
      display_order: dto.display_order ?? layout.display_order,
      floor_id: dto.floor_id ?? layout.floor_id,
      requires_subscription: dto.requires_subscription ?? false,
      status: dto.status ?? EquipmentStatus.available,
    };
  }

  private toUpdateInput(dto: UpdateAmenityDTO): Prisma.AmenityUpdateInput {
    return {
      ...pickDefined(dto, AMENITY_UPDATE_FIELDS),
    };
  }
}

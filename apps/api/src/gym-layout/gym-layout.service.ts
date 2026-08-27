import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { EquipmentStatus, UserStatus, type Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  CreateEquipmentDTO,
  FacilityFloorPlanMediaResponseDTO,
  GymLayoutEquipmentResponseDTO,
  UpdateFacilityFloorPlanMediaDTO,
  UpdateEquipmentDTO,
} from './dto/gym-layout.dto';
import {
  GymLayoutRepository,
  type FacilityFloorPlanMediaRow,
  type GymLayoutEquipmentRecord,
  type GymLayoutVenueRecord,
} from './gym-layout.repository';
import {
  GYM_LAYOUT_STATUS_CHANNEL,
  GYM_LAYOUT_STATUS_HASH_KEY,
  type GymLayoutDeltaOperation,
  type GymLayoutRealtimeDelta,
} from './gym-layout.realtime';
import { getAmenityBookingBlockReason } from '../bookings/amenity/amenity-reservability';
import {
  assertValidFacilityCells,
  assertRectangleInFootprint,
  expandFacilityRectangle,
  facilityCellKey,
  normalizeFacilityCells,
} from './facility-layout.validation';

const GYM_LAYOUT_UPDATE_FIELDS = [
  'name',
  'type',
  'floor_id',
  'status',
  'icon_key',
  'is_active',
  'grid_width',
  'grid_height',
] as const;

const GYM_LAYOUT_GRID_COLUMNS = 14;
const GYM_LAYOUT_GRID_ROWS = 10;
const FACILITY_FLOOR_IDS = ['floor-1', 'floor-2', 'floor-3'] as const;

function pickDefined<T extends object, K extends readonly (keyof T)[]>(
  source: T,
  keys: K,
): Pick<T, K[number]> {
  return keys.reduce(
    (result, key) => {
      const value = source[key];
      if (value !== undefined) {
        result[key] = value;
      }
      return result;
    },
    {} as Pick<T, K[number]>,
  );
}

function gridColumnToPositionX(gridColumn: number) {
  return Number(
    (((gridColumn - 0.5) / GYM_LAYOUT_GRID_COLUMNS) * 100).toFixed(2),
  );
}

function gridRowToPositionY(gridRow: number) {
  return Number((((gridRow - 0.5) / GYM_LAYOUT_GRID_ROWS) * 100).toFixed(2));
}

function legacyPositionXToGridColumn(positionX: number) {
  return Math.max(
    1,
    Math.min(
      GYM_LAYOUT_GRID_COLUMNS,
      Math.round((positionX / 100) * GYM_LAYOUT_GRID_COLUMNS + 0.5),
    ),
  );
}

function legacyPositionYToGridRow(positionY: number) {
  return Math.max(
    1,
    Math.min(
      GYM_LAYOUT_GRID_ROWS,
      Math.round((positionY / 100) * GYM_LAYOUT_GRID_ROWS + 0.5),
    ),
  );
}

type PlacementInput = {
  grid_column?: number | null;
  grid_row?: number | null;
};

function isFacilityFloorId(
  value: string,
): value is (typeof FACILITY_FLOOR_IDS)[number] {
  return FACILITY_FLOOR_IDS.includes(
    value as (typeof FACILITY_FLOOR_IDS)[number],
  );
}

@Injectable()
export class GymLayoutService {
  constructor(
    private readonly repo: GymLayoutRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async listEquipment(): Promise<GymLayoutEquipmentResponseDTO[]> {
    const equipment = await this.repo.listActiveEquipment();
    return equipment.map((item) => this.toEquipmentResponse(item));
  }

  async listArchivedEquipment(): Promise<GymLayoutEquipmentResponseDTO[]> {
    const equipment = await this.repo.listArchivedEquipment();
    return equipment.map((item) => this.toEquipmentResponse(item));
  }

  async listFloorPlanMedia(): Promise<FacilityFloorPlanMediaResponseDTO[]> {
    const media = await this.repo.listFloorPlanMedia();
    return media.map((item) => this.toFloorPlanMediaResponse(item));
  }

  async getSnapshot() {
    const [media, regions, equipment] = await Promise.all([
      this.repo.listFloorPlanMedia(),
      this.repo.listSnapshotRegions(),
      this.repo.listActiveEquipment(),
    ]);
    return {
      generated_at: new Date().toISOString(),
      floors: FACILITY_FLOOR_IDS.map((floorId) => {
        const floorMedia = media.find((item) => item.floor_id === floorId);
        return {
          floor_id: floorId,
          grid_columns: 14 as const,
          grid_rows: 10 as const,
          image_url: floorMedia?.image_url ?? null,
          footprint_cells: normalizeFacilityCells(floorMedia?.footprint_cells),
          path_cells: normalizeFacilityCells(floorMedia?.path_cells),
          entry_cells: normalizeFacilityCells(floorMedia?.entry_cells),
          exit_cells: normalizeFacilityCells(floorMedia?.exit_cells),
          regions: regions.flatMap((region) => {
            if (
              region.floor_id !== floorId ||
              region.grid_column == null ||
              region.grid_row == null ||
              region.grid_width == null ||
              region.grid_height == null
            )
              return [];
            const bookingBlockReason = getAmenityBookingBlockReason(region);
            return [
              {
                id: region.id,
                source_venue_id: region.id,
                floor_id: floorId,
                name: region.name,
                description: region.description,
                icon_key: region.icon_key,
                image_url: region.image_url,
                grid_column: region.grid_column,
                grid_row: region.grid_row,
                grid_width: region.grid_width,
                grid_height: region.grid_height,
                is_reservable: region.is_reservable === true,
                is_bookable: bookingBlockReason === null,
                booking_block_reason: bookingBlockReason,
                status: region.status,
                capacity: region.capacity,
                hourly_rate: Number(region.hourly_rate),
                minimum_hours: region.minimum_hours,
                region_kind:
                  region.is_reservable === true
                    ? ('venue' as const)
                    : ('support' as const),
              },
            ];
          }),
          equipment: equipment
            .filter((item) => item.floor_id === floorId && item.is_active)
            .map((item) => this.toEquipmentResponse(item)),
        };
      }),
    };
  }

  async createEquipment(
    dto: CreateEquipmentDTO,
  ): Promise<GymLayoutEquipmentResponseDTO> {
    this.assertNoLegacyPlacementInput(dto);
    const venue = await this.repo.findActiveVenueByIdOrThrow(dto.venue_id);
    const placement = this.resolvePlacement(dto);
    await this.assertEquipmentCellAvailable(
      dto.floor_id,
      placement.grid_column,
      placement.grid_row,
    );
    this.assertPlacementInsideVenue(dto.floor_id, placement, 1, 1, venue);

    const equipment = await this.repo.createEquipment(
      this.toCreateInput(dto, placement),
    );
    await this.publishRealtimeDelta(equipment, 'upsert');

    return this.toEquipmentResponse(equipment);
  }

  async updateEquipment(
    id: string,
    dto: UpdateEquipmentDTO,
  ): Promise<GymLayoutEquipmentResponseDTO> {
    this.assertNoLegacyPlacementInput(dto);
    const updateData = await this.toResolvedUpdateInput(id, dto);
    const equipment = await this.repo.updateEquipment(id, updateData);
    await this.publishRealtimeDelta(
      equipment,
      equipment.is_active ? 'upsert' : 'remove',
    );

    return this.toEquipmentResponse(equipment);
  }

  async deleteEquipment(id: string): Promise<void> {
    const equipment = await this.repo.softDeleteEquipment(id);
    await this.publishRealtimeDelta(equipment, 'remove');
  }

  async restoreEquipment(id: string): Promise<GymLayoutEquipmentResponseDTO> {
    const equipment = await this.repo.restoreEquipment(id);
    await this.publishRealtimeDelta(equipment, 'upsert');

    return this.toEquipmentResponse(equipment);
  }

  async updateFloorPlanMedia(
    floorId: string,
    dto: UpdateFacilityFloorPlanMediaDTO,
  ): Promise<FacilityFloorPlanMediaResponseDTO> {
    if (!isFacilityFloorId(floorId)) {
      throw new BadRequestException({
        type: 'BAD_REQUEST',
        title: 'Invalid Floor Plan',
        status: 400,
        detail: `floor_id must be one of: ${FACILITY_FLOOR_IDS.join(', ')}.`,
      });
    }

    for (const [label, cells] of [
      ['Footprint cells', dto.footprint_cells],
      ['Path cells', dto.path_cells],
      ['Entry cells', dto.entry_cells],
      ['Exit cells', dto.exit_cells],
    ] as const) {
      if (cells !== undefined) assertValidFacilityCells(cells, label);
    }

    const current = (await this.repo.listFloorPlanMedia()).find(
      (item) => item.floor_id === floorId,
    );
    const fullFootprint = Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 14 }, (_, column) => ({
        column: column + 1,
        row: row + 1,
      })),
    ).flat();
    const footprint = normalizeFacilityCells(
      dto.footprint_cells ?? current?.footprint_cells ?? fullFootprint,
    );
    const paths = normalizeFacilityCells(dto.path_cells ?? current?.path_cells);
    const entries = normalizeFacilityCells(
      dto.entry_cells ?? current?.entry_cells,
    );
    const exits = normalizeFacilityCells(dto.exit_cells ?? current?.exit_cells);
    if (footprint.length === 0)
      throw new BadRequestException({
        type: 'INVALID_FACILITY_LAYOUT',
        title: 'Building Footprint Required',
        status: 400,
        detail: 'A floor must retain at least one building footprint cell.',
      });
    const footprintKeys = new Set(footprint.map(facilityCellKey));
    for (const [label, cells] of [
      ['Path', paths],
      ['Entry', entries],
      ['Exit', exits],
    ] as const) {
      if (cells.some((cell) => !footprintKeys.has(facilityCellKey(cell))))
        throw new BadRequestException({
          type: 'INVALID_FACILITY_LAYOUT',
          title: `${label} Outside Building`,
          status: 400,
          detail: `${label} cells must remain inside the building footprint.`,
        });
    }
    const regions = await this.repo.listSnapshotRegions();
    const floorRegions = regions.flatMap((region) => {
      if (
        region.floor_id !== floorId ||
        region.grid_column == null ||
        region.grid_row == null ||
        region.grid_width == null ||
        region.grid_height == null
      )
        return [];
      return [
        {
          gridColumn: region.grid_column,
          gridRow: region.grid_row,
          gridWidth: region.grid_width,
          gridHeight: region.grid_height,
        },
      ];
    });
    for (const region of floorRegions)
      assertRectangleInFootprint(
        region,
        fullFootprint,
        'Mapped regions must remain inside the fixed 14 x 10 grid.',
      );
    const regionKeys = new Set(
      floorRegions.flatMap((region) =>
        expandFacilityRectangle(region).map(facilityCellKey),
      ),
    );
    if (paths.some((cell) => regionKeys.has(facilityCellKey(cell))))
      throw new BadRequestException({
        type: 'INVALID_FACILITY_LAYOUT',
        title: 'Path Crosses Region',
        status: 400,
        detail:
          'Path cells cannot pass through mapped venue or support regions.',
      });
    const media = await this.repo.upsertFloorPlanMedia(floorId, {
      ...(dto.image_url !== undefined ? { imageUrl: dto.image_url } : {}),
      footprintCells: footprint,
      pathCells: paths,
      entryCells: entries,
      exitCells: exits,
    });
    return this.toFloorPlanMediaResponse(media);
  }

  async authenticateSocket(client: Socket): Promise<JwtPayload> {
    const token = this.extractToken(client);
    const secret = this.config.get<string>('jwt.secret', '');

    if (!token || !secret) {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException({
        type: 'UNAUTHORIZED',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or missing authentication token.',
      });
    }

    const blacklisted = await this.redis.get(`token_blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException({
        type: 'TOKEN_REVOKED',
        title: 'Token Revoked',
        status: 401,
        detail: 'This token has been revoked. Please log in again.',
      });
    }

    if (payload.status !== UserStatus.active) {
      throw new ForbiddenException({
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        status: 403,
        detail: `Your account is ${payload.status}. Contact support.`,
      });
    }

    return payload;
  }

  async getRealtimeSnapshot(): Promise<GymLayoutEquipmentResponseDTO[]> {
    const equipment = await this.repo.listActiveEquipment();
    let cachedStatuses = await this.redis.hgetall(GYM_LAYOUT_STATUS_HASH_KEY);

    if (Object.keys(cachedStatuses).length === 0) {
      await this.cacheStatuses(equipment);
      cachedStatuses = await this.redis.hgetall(GYM_LAYOUT_STATUS_HASH_KEY);
    }

    return equipment.map((item) =>
      this.toEquipmentResponse(item, cachedStatuses[item.id]),
    );
  }

  private toCreateInput(
    dto: CreateEquipmentDTO,
    placement: ReturnType<GymLayoutService['resolvePlacement']>,
  ): Prisma.GymEquipmentCreateInput {
    return {
      name: dto.name,
      type: dto.type,
      floor_id: dto.floor_id,
      inventory_item: { connect: { id: dto.inventory_item_id } },
      venue: { connect: { id: dto.venue_id } },
      grid_width: 1,
      grid_height: 1,
      grid_column: placement.grid_column,
      grid_row: placement.grid_row,
      position_x: placement.position_x,
      position_y: placement.position_y,
      status: EquipmentStatus.available,
      icon_key: dto.icon_key ?? null,
    };
  }

  private toUpdateInput(
    dto: UpdateEquipmentDTO,
  ): Prisma.GymEquipmentUpdateInput {
    const { inventory_item_id, venue_id } = dto;

    return {
      ...pickDefined(dto, GYM_LAYOUT_UPDATE_FIELDS),
      ...(inventory_item_id
        ? { inventory_item: { connect: { id: inventory_item_id } } }
        : {}),
      ...(venue_id ? { venue: { connect: { id: venue_id } } } : {}),
    };
  }

  private async toResolvedUpdateInput(
    id: string,
    dto: UpdateEquipmentDTO,
  ): Promise<Prisma.GymEquipmentUpdateInput> {
    const basePatch = this.toUpdateInput(dto);
    const placementRequested =
      dto.grid_column !== undefined || dto.grid_row !== undefined;
    const contractRequested =
      placementRequested ||
      dto.venue_id !== undefined ||
      dto.inventory_item_id !== undefined ||
      dto.grid_width !== undefined ||
      dto.grid_height !== undefined ||
      dto.floor_id !== undefined;

    if (!contractRequested) {
      return basePatch;
    }

    const current = await this.repo.findEquipmentByIdOrThrow(id);
    const placement = this.resolvePlacement({
      grid_column: dto.grid_column ?? current.grid_column,
      grid_row: dto.grid_row ?? current.grid_row,
    });

    const venueId = dto.venue_id ?? current.venue_id;
    const gridWidth = 1;
    const gridHeight = 1;
    const floorId = dto.floor_id ?? current.floor_id;

    if (venueId) {
      const venue = await this.repo.findActiveVenueByIdOrThrow(venueId);
      this.assertPlacementInsideVenue(
        floorId,
        placement,
        gridWidth,
        gridHeight,
        venue,
      );
    }

    await this.assertEquipmentCellAvailable(
      floorId,
      placement.grid_column,
      placement.grid_row,
      id,
    );

    return {
      ...basePatch,
      ...placement,
      grid_width: 1,
      grid_height: 1,
    };
  }

  private async assertEquipmentCellAvailable(
    floorId: string,
    gridColumn: number,
    gridRow: number,
    excludingId?: string,
  ) {
    const equipment = await this.repo.listActiveEquipment();
    if (
      equipment.some(
        (item) =>
          item.id !== excludingId &&
          item.floor_id === floorId &&
          item.grid_column === gridColumn &&
          item.grid_row === gridRow,
      )
    ) {
      throw new BadRequestException({
        type: 'FACILITY_EQUIPMENT_OVERLAP',
        title: 'Equipment Cell Occupied',
        status: 400,
        detail: 'Only one equipment node can occupy a map cell.',
      });
    }
  }

  private assertPlacementInsideVenue(
    floorId: string,
    placement: Pick<Prisma.GymEquipmentCreateInput, 'grid_column' | 'grid_row'>,
    gridWidth: number,
    gridHeight: number,
    venue: GymLayoutVenueRecord,
  ): void {
    if (
      venue.floor_id !== floorId ||
      venue.grid_column === null ||
      venue.grid_row === null ||
      venue.grid_width === null ||
      venue.grid_height === null
    ) {
      throw new BadRequestException({
        type: 'INVALID_VENUE_CONTAINMENT',
        title: 'Venue Layout Dimensions Required',
        status: 400,
        detail:
          'The equipment floor and dimensions must be contained by an active venue with persisted layout dimensions.',
      });
    }

    const nodeRight = Number(placement.grid_column) + gridWidth - 1;
    const nodeBottom = Number(placement.grid_row) + gridHeight - 1;
    const venueRight = venue.grid_column + venue.grid_width - 1;
    const venueBottom = venue.grid_row + venue.grid_height - 1;

    if (
      Number(placement.grid_column) < venue.grid_column ||
      Number(placement.grid_row) < venue.grid_row ||
      nodeRight > venueRight ||
      nodeBottom > venueBottom
    ) {
      throw new BadRequestException({
        type: 'INVALID_VENUE_CONTAINMENT',
        title: 'Equipment Outside Venue Bounds',
        status: 400,
        detail:
          'Equipment placement and dimensions must remain inside the selected venue.',
      });
    }
  }

  private resolvePlacement(input: PlacementInput) {
    const gridColumn = input.grid_column;
    const gridRow = input.grid_row;

    if (
      !Number.isInteger(gridColumn) ||
      !Number.isInteger(gridRow) ||
      Number(gridColumn) < 1 ||
      Number(gridColumn) > GYM_LAYOUT_GRID_COLUMNS ||
      Number(gridRow) < 1 ||
      Number(gridRow) > GYM_LAYOUT_GRID_ROWS
    ) {
      throw new BadRequestException({
        type: 'BAD_REQUEST',
        title: 'Invalid Gym Layout Placement',
        status: 400,
        detail:
          'Provide grid_column and grid_row inside the fixed 14 x 10 map.',
      });
    }

    const normalizedGridColumn = Number(gridColumn);
    const normalizedGridRow = Number(gridRow);

    return {
      grid_column: normalizedGridColumn,
      grid_row: normalizedGridRow,
      position_x: gridColumnToPositionX(normalizedGridColumn),
      position_y: gridRowToPositionY(normalizedGridRow),
    } satisfies Pick<
      Prisma.GymEquipmentUpdateInput,
      'grid_column' | 'grid_row' | 'position_x' | 'position_y'
    >;
  }

  private assertNoLegacyPlacementInput(input: object) {
    if ('position_x' in input || 'position_y' in input) {
      throw new BadRequestException({
        type: 'INVALID_FACILITY_LAYOUT',
        title: 'Grid Cell Placement Required',
        status: 400,
        detail:
          'position_x and position_y are derived compatibility fields; provide grid_column and grid_row.',
      });
    }
  }

  private toEquipmentResponse(
    item: GymLayoutEquipmentRecord,
    cachedStatus?: string,
  ): GymLayoutEquipmentResponseDTO {
    const positionX = Number(item.position_x);
    const positionY = Number(item.position_y);
    const gridColumn =
      item.grid_column ?? legacyPositionXToGridColumn(positionX);
    const gridRow = item.grid_row ?? legacyPositionYToGridRow(positionY);

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      floor_id: item.floor_id as 'floor-1' | 'floor-2' | 'floor-3',
      grid_column: gridColumn,
      grid_row: gridRow,
      position_x: positionX,
      position_y: positionY,
      grid_width: item.grid_width ?? null,
      grid_height: item.grid_height ?? null,
      inventory_item_id: item.inventory_item_id ?? null,
      venue_id: item.venue_id ?? null,
      image_url: item.inventory_item?.image_url ?? null,
      placed_quantity: item.inventory_item?._count.layout_nodes ?? 0,
      remaining_placeable_quantity: item.inventory_item
        ? Math.max(
            item.inventory_item.quantity_current -
              item.inventory_item._count.layout_nodes,
            0,
          )
        : null,
      status: this.toCachedStatus(cachedStatus) ?? item.status,
      icon_key: item.icon_key ?? null,
      is_active: item.is_active,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    };
  }

  private toFloorPlanMediaResponse(
    item: FacilityFloorPlanMediaRow,
  ): FacilityFloorPlanMediaResponseDTO {
    return {
      floor_id: item.floor_id as (typeof FACILITY_FLOOR_IDS)[number],
      image_url: item.image_url,
      grid_width: item.grid_width,
      grid_height: item.grid_height,
      footprint_cells: normalizeFacilityCells(item.footprint_cells),
      path_cells: normalizeFacilityCells(item.path_cells),
      entry_cells: normalizeFacilityCells(item.entry_cells),
      exit_cells: normalizeFacilityCells(item.exit_cells),
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    };
  }

  private async publishRealtimeDelta(
    equipment: GymLayoutEquipmentRecord,
    operation: GymLayoutDeltaOperation,
  ): Promise<void> {
    if (operation === 'remove' || !equipment.is_active) {
      await this.redis.hdel(GYM_LAYOUT_STATUS_HASH_KEY, equipment.id);
    } else {
      await this.redis.hset(
        GYM_LAYOUT_STATUS_HASH_KEY,
        equipment.id,
        equipment.status,
      );
    }

    const payload: GymLayoutRealtimeDelta = {
      equipment: this.toEquipmentResponse(equipment),
      operation,
    };

    await this.redis.publish(
      GYM_LAYOUT_STATUS_CHANNEL,
      JSON.stringify(payload),
    );
  }

  private async cacheStatuses(
    equipment: GymLayoutEquipmentRecord[],
  ): Promise<void> {
    await this.redis.del(GYM_LAYOUT_STATUS_HASH_KEY);

    if (equipment.length === 0) {
      return;
    }

    const entries = equipment.flatMap((item) => [item.id, item.status]);
    await this.redis.hset(GYM_LAYOUT_STATUS_HASH_KEY, ...entries);
  }

  private toCachedStatus(value: string | undefined): EquipmentStatus | null {
    if (
      value === EquipmentStatus.available ||
      value === EquipmentStatus.occupied ||
      value === EquipmentStatus.maintenance ||
      value === EquipmentStatus.broken ||
      value === EquipmentStatus.missing
    ) {
      return value;
    }

    return null;
  }

  private extractToken(client: Socket): string | null {
    const authToken = this.normalizeTokenValue(
      (client.handshake.auth as { token?: unknown } | undefined)?.token,
    );
    if (authToken) {
      return authToken;
    }

    const headerToken = this.normalizeTokenValue(
      client.handshake.headers.authorization,
    );
    if (headerToken) {
      return headerToken;
    }

    return this.normalizeTokenValue(client.handshake.query.token);
  }

  private normalizeTokenValue(value: unknown): string | null {
    const rawValue: unknown = Array.isArray(value)
      ? (value as unknown[])[0]
      : value;

    if (typeof rawValue !== 'string') {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.replace(/^Bearer\s+/i, '');
  }
}

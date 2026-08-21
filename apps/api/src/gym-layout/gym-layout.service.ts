import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  EquipmentStatus,
  UserStatus,
  type Prisma,
} from '@prisma/client';
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

function clampGridColumn(value: number) {
  return Math.max(1, Math.min(GYM_LAYOUT_GRID_COLUMNS, Math.round(value)));
}

function clampGridRow(value: number) {
  return Math.max(1, Math.min(GYM_LAYOUT_GRID_ROWS, Math.round(value)));
}

function gridColumnToPositionX(gridColumn: number) {
  return Number(
    (
      ((clampGridColumn(gridColumn) - 0.5) / GYM_LAYOUT_GRID_COLUMNS) *
      100
    ).toFixed(2),
  );
}

function gridRowToPositionY(gridRow: number) {
  return Number(
    (((clampGridRow(gridRow) - 0.5) / GYM_LAYOUT_GRID_ROWS) * 100).toFixed(2),
  );
}

function positionXToGridColumn(positionX: number) {
  return clampGridColumn((positionX / 100) * GYM_LAYOUT_GRID_COLUMNS + 0.5);
}

function positionYToGridRow(positionY: number) {
  return clampGridRow((positionY / 100) * GYM_LAYOUT_GRID_ROWS + 0.5);
}

type PlacementInput = {
  grid_column?: number | null;
  grid_row?: number | null;
  position_x?: number;
  position_y?: number;
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

  async createEquipment(
    dto: CreateEquipmentDTO,
  ): Promise<GymLayoutEquipmentResponseDTO> {
    const venue = await this.repo.findActiveVenueByIdOrThrow(dto.venue_id);
    const placement = this.resolvePlacement(dto);
    this.assertPlacementInsideVenue(
      dto.floor_id,
      placement,
      dto.grid_width ?? 1,
      dto.grid_height ?? 1,
      venue,
    );

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

    const media = await this.repo.upsertFloorPlanMedia(
      floorId,
      {
        ...(dto.image_url !== undefined ? { imageUrl: dto.image_url } : {}),
        ...(dto.grid_width !== undefined ? { gridWidth: dto.grid_width } : {}),
        ...(dto.grid_height !== undefined ? { gridHeight: dto.grid_height } : {}),
      },
    );
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
      grid_width: dto.grid_width ?? 1,
      grid_height: dto.grid_height ?? 1,
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
      dto.grid_column !== undefined ||
      dto.grid_row !== undefined ||
      dto.position_x !== undefined ||
      dto.position_y !== undefined;
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
      position_x: dto.position_x ?? Number(current.position_x),
      position_y: dto.position_y ?? Number(current.position_y),
    });

    const venueId = dto.venue_id ?? current.venue_id;
    const gridWidth = dto.grid_width ?? current.grid_width ?? 1;
    const gridHeight = dto.grid_height ?? current.grid_height ?? 1;
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

    return {
      ...basePatch,
      ...placement,
    };
  }

  private assertPlacementInsideVenue(
    floorId: string,
    placement: Pick<
      Prisma.GymEquipmentCreateInput,
      'grid_column' | 'grid_row'
    >,
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
        detail: 'Equipment placement and dimensions must remain inside the selected venue.',
      });
    }
  }

  private resolvePlacement(input: PlacementInput) {
    const gridColumn =
      input.grid_column ??
      (input.position_x !== undefined
        ? positionXToGridColumn(input.position_x)
        : undefined);
    const gridRow =
      input.grid_row ??
      (input.position_y !== undefined
        ? positionYToGridRow(input.position_y)
        : undefined);

    if (gridColumn === undefined || gridRow === undefined) {
      throw new BadRequestException({
        type: 'BAD_REQUEST',
        title: 'Invalid Gym Layout Placement',
        status: 400,
        detail:
          'Provide both placement axes through grid_column/grid_row or position_x/position_y.',
      });
    }

    const normalizedGridColumn = clampGridColumn(gridColumn);
    const normalizedGridRow = clampGridRow(gridRow);

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

  private toEquipmentResponse(
    item: GymLayoutEquipmentRecord,
    cachedStatus?: string,
  ): GymLayoutEquipmentResponseDTO {
    const positionX = Number(item.position_x);
    const positionY = Number(item.position_y);
    const gridColumn = item.grid_column ?? positionXToGridColumn(positionX);
    const gridRow = item.grid_row ?? positionYToGridRow(positionY);

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

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  EquipmentStatus,
  type GymEquipment,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  CreateEquipmentDTO,
  GymLayoutEquipmentResponseDTO,
  UpdateEquipmentDTO,
} from './dto/gym-layout.dto';
import { GymLayoutRepository } from './gym-layout.repository';
import {
  GYM_LAYOUT_STATUS_CHANNEL,
  GYM_LAYOUT_STATUS_HASH_KEY,
  type GymLayoutDeltaOperation,
  type GymLayoutRealtimeDelta,
} from './gym-layout.realtime';

const GYM_LAYOUT_UPDATE_FIELDS = [
  'name',
  'type',
  'position_x',
  'position_y',
  'status',
  'icon_key',
  'is_active',
] as const;

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

  async createEquipment(
    dto: CreateEquipmentDTO,
  ): Promise<GymLayoutEquipmentResponseDTO> {
    const equipment = await this.repo.createEquipment(this.toCreateInput(dto));
    await this.publishRealtimeDelta(equipment, 'upsert');

    return this.toEquipmentResponse(equipment);
  }

  async updateEquipment(
    id: string,
    dto: UpdateEquipmentDTO,
  ): Promise<GymLayoutEquipmentResponseDTO> {
    const equipment = await this.repo.updateEquipment(
      id,
      this.toUpdateInput(dto),
    );
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
  ): Prisma.GymEquipmentCreateInput {
    return {
      name: dto.name,
      type: dto.type,
      position_x: dto.position_x,
      position_y: dto.position_y,
      status: EquipmentStatus.available,
      icon_key: dto.icon_key ?? null,
    };
  }

  private toUpdateInput(
    dto: UpdateEquipmentDTO,
  ): Prisma.GymEquipmentUpdateInput {
    return {
      ...pickDefined(dto, GYM_LAYOUT_UPDATE_FIELDS),
    };
  }

  private toEquipmentResponse(
    item: GymEquipment,
    cachedStatus?: string,
  ): GymLayoutEquipmentResponseDTO {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      position_x: Number(item.position_x),
      position_y: Number(item.position_y),
      status: this.toCachedStatus(cachedStatus) ?? item.status,
      icon_key: item.icon_key ?? null,
      is_active: item.is_active,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    };
  }

  private async publishRealtimeDelta(
    equipment: GymEquipment,
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

  private async cacheStatuses(equipment: GymEquipment[]): Promise<void> {
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
      value === EquipmentStatus.maintenance
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

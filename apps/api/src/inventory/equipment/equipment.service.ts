import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GymEquipmentItem, Prisma } from '@prisma/client';

import { AuditAction, type AuditEvent } from '../../audit/audit.service';
import type { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  EQUIPMENT_WRITEOFF_EVENT,
  type EquipmentWriteOffEvent,
} from '../events/equipment-write-off.event';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  CreateEquipmentItemDTO,
  EquipmentItemDetailResponseDTO,
  EquipmentItemResponseDTO,
  EquipmentWriteOffDTO,
  EquipmentWriteOffResponseDTO,
  UpdateEquipmentItemDTO,
} from './dto/equipment.dto';
import {
  EquipmentDetailRecord,
  EquipmentRepository,
  EquipmentWriteOffRecord,
} from './equipment.repository';

const EQUIPMENT_UPDATE_FIELDS = [
  'name',
  'description',
  'unit',
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
export class EquipmentService {
  constructor(
    private readonly repo: EquipmentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listEquipmentItems(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<EquipmentItemResponseDTO>> {
    const result = await this.repo.listEquipmentItems(dto);

    return {
      data: result.data.map((item) => this.toEquipmentResponse(item)),
      meta: result.meta,
    };
  }

  async getEquipmentItemById(
    id: string,
  ): Promise<EquipmentItemDetailResponseDTO> {
    return this.toEquipmentDetailResponse(
      await this.repo.findEquipmentItemByIdOrThrow(id),
    );
  }

  async createEquipmentItem(
    dto: CreateEquipmentItemDTO,
  ): Promise<EquipmentItemResponseDTO> {
    this.assertInitialCurrentWithinTotal(dto);

    return this.toEquipmentResponse(
      await this.repo.createEquipmentItem(this.toCreateInput(dto)),
    );
  }

  async updateEquipmentItem(
    id: string,
    dto: UpdateEquipmentItemDTO,
  ): Promise<EquipmentItemResponseDTO> {
    return this.toEquipmentResponse(
      await this.repo.updateEquipmentItem(id, this.toUpdateInput(dto)),
    );
  }

  async writeOffEquipment(
    performerId: string,
    equipmentId: string,
    dto: EquipmentWriteOffDTO,
  ): Promise<EquipmentWriteOffResponseDTO> {
    const writeOff = await this.repo.writeOffEquipment(
      performerId,
      equipmentId,
      dto.quantity_set_to,
      dto.reason,
    );

    this.emitAudit({
      userId: performerId,
      action: AuditAction.EQUIPMENT_WRITEOFF,
      entity: 'GymEquipmentItem',
      entityId: writeOff.equipment_id,
      before: {
        quantity_current: writeOff.quantity_before,
      },
      after: {
        quantity_current: writeOff.quantity_set_to,
        quantity_lost: writeOff.quantity_lost,
        reason: writeOff.reason,
        write_off_id: writeOff.id,
      },
    });
    this.emitEquipmentWriteOff({
      equipmentId: writeOff.equipment_id,
      equipmentName: writeOff.equipment.name,
      quantityBefore: writeOff.quantity_before,
      quantitySetTo: writeOff.quantity_set_to,
      quantityLost: writeOff.quantity_lost,
      reason: writeOff.reason,
      performedBy: performerId,
    });

    return this.toWriteOffResponse(writeOff);
  }

  async getWriteOffHistory(
    equipmentId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<EquipmentWriteOffResponseDTO>> {
    await this.repo.findEquipmentItemRecordByIdOrThrow(equipmentId);

    const result = await this.repo.listWriteOffHistory(equipmentId, dto);

    return {
      data: result.data.map((writeOff) => this.toWriteOffResponse(writeOff)),
      meta: result.meta,
    };
  }

  private assertInitialCurrentWithinTotal(dto: CreateEquipmentItemDTO): void {
    if (dto.quantity_current > dto.quantity_total) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Equipment Quantity',
          status: 422,
          detail:
            'quantity_current cannot be greater than quantity_total when creating equipment.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private toCreateInput(
    dto: CreateEquipmentItemDTO,
  ): Prisma.GymEquipmentItemCreateInput {
    return {
      name: dto.name,
      description: dto.description ?? null,
      quantity_total: dto.quantity_total,
      quantity_current: dto.quantity_current,
      unit: dto.unit ?? 'units',
    };
  }

  private toUpdateInput(
    dto: UpdateEquipmentItemDTO,
  ): Prisma.GymEquipmentItemUpdateInput {
    return {
      ...pickDefined(dto, EQUIPMENT_UPDATE_FIELDS),
    };
  }

  private toEquipmentResponse(
    item: GymEquipmentItem,
  ): EquipmentItemResponseDTO {
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      quantity_total: item.quantity_total,
      quantity_current: item.quantity_current,
      unit: item.unit,
      is_active: item.is_active,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    };
  }

  private toEquipmentDetailResponse(
    item: EquipmentDetailRecord,
  ): EquipmentItemDetailResponseDTO {
    return {
      ...this.toEquipmentResponse(item),
      write_offs: item.write_offs.map((writeOff) =>
        this.toWriteOffResponse(writeOff),
      ),
    };
  }

  private toWriteOffResponse(
    writeOff: EquipmentWriteOffRecord,
  ): EquipmentWriteOffResponseDTO {
    return {
      id: writeOff.id,
      equipment_id: writeOff.equipment_id,
      quantity_before: writeOff.quantity_before,
      quantity_set_to: writeOff.quantity_set_to,
      quantity_lost: writeOff.quantity_lost,
      reason: writeOff.reason,
      performed_by: writeOff.performed_by,
      performer: writeOff.performer
        ? {
            id: writeOff.performer.id,
            first_name: writeOff.performer.profile?.first_name ?? null,
            last_name: writeOff.performer.profile?.last_name ?? null,
          }
        : null,
      created_at: writeOff.created_at.toISOString(),
      updated_at: writeOff.updated_at.toISOString(),
    };
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitEquipmentWriteOff(event: EquipmentWriteOffEvent): void {
    this.eventEmitter.emit(EQUIPMENT_WRITEOFF_EVENT, event);
  }
}

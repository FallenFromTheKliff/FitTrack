import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PaginatedResult } from '../common/base-repository/base-repository';
import { PaginationDTO } from '../user/dto/user-dto';
import {
  CreateGymFaqEntryDTO,
  CreateGymPromotionDTO,
  CreateGymSpecialScheduleDTO,
  GymFaqEntryResponseDTO,
  GymOperatingHourResponseDTO,
  GymPromotionResponseDTO,
  GymSpecialScheduleResponseDTO,
  UpsertGymOperatingHoursDTO,
} from './dto/gym-knowledge.dto';
import {
  GymFaqEntryRecord,
  GymKnowledgeRepository,
  GymOperatingHourRecord,
  GymPromotionRecord,
  GymSpecialScheduleRecord,
} from './gym-knowledge.repository';

@Injectable()
export class GymKnowledgeService {
  constructor(
    private readonly gymKnowledgeRepository: GymKnowledgeRepository,
  ) {}

  async getOperatingHours(): Promise<GymOperatingHourResponseDTO[]> {
    const records = await this.gymKnowledgeRepository.listOperatingHours();
    return records.map((record) => this.toOperatingHourResponse(record));
  }

  async replaceOperatingHours(
    hours: UpsertGymOperatingHoursDTO[],
  ): Promise<GymOperatingHourResponseDTO[]> {
    this.assertUniqueOperatingDays(hours);
    const records =
      await this.gymKnowledgeRepository.replaceOperatingHours(hours);

    return records.map((record) => this.toOperatingHourResponse(record));
  }

  async getSpecialSchedules(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymSpecialScheduleResponseDTO>> {
    const result = await this.gymKnowledgeRepository.listSpecialSchedules(dto);
    return {
      data: result.data.map((record) => this.toSpecialScheduleResponse(record)),
      meta: result.meta,
    };
  }

  async createSpecialSchedule(
    dto: CreateGymSpecialScheduleDTO,
  ): Promise<GymSpecialScheduleResponseDTO> {
    const record = await this.gymKnowledgeRepository.createSpecialSchedule(dto);
    return this.toSpecialScheduleResponse(record);
  }

  async getPromotions(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymPromotionResponseDTO>> {
    const result = await this.gymKnowledgeRepository.listPromotions(dto);
    return {
      data: result.data.map((record) => this.toPromotionResponse(record)),
      meta: result.meta,
    };
  }

  async createPromotion(
    dto: CreateGymPromotionDTO,
  ): Promise<GymPromotionResponseDTO> {
    const record = await this.gymKnowledgeRepository.createPromotion(dto);
    return this.toPromotionResponse(record);
  }

  async getFaqEntries(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymFaqEntryResponseDTO>> {
    const result = await this.gymKnowledgeRepository.listFaqEntries(dto);
    return {
      data: result.data.map((record) => this.toFaqEntryResponse(record)),
      meta: result.meta,
    };
  }

  async createFaqEntry(
    dto: CreateGymFaqEntryDTO,
  ): Promise<GymFaqEntryResponseDTO> {
    const record = await this.gymKnowledgeRepository.createFaqEntry(dto);
    return this.toFaqEntryResponse(record);
  }

  private toOperatingHourResponse(
    record: GymOperatingHourRecord,
  ): GymOperatingHourResponseDTO {
    return {
      id: record.id,
      day_of_week: record.day_of_week,
      opens_at: this.formatTime(record.opens_at),
      closes_at: this.formatTime(record.closes_at),
      is_closed: record.is_closed,
      label: record.label,
      is_active: record.is_active,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toSpecialScheduleResponse(
    record: GymSpecialScheduleRecord,
  ): GymSpecialScheduleResponseDTO {
    return {
      id: record.id,
      starts_on: this.formatDateOnly(record.starts_on),
      ends_on: this.formatDateOnly(record.ends_on),
      opens_at: this.formatNullableTime(record.opens_at),
      closes_at: this.formatNullableTime(record.closes_at),
      is_closed: record.is_closed,
      reason: record.reason,
      pricing_note: record.pricing_note,
      is_active: record.is_active,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toPromotionResponse(
    record: GymPromotionRecord,
  ): GymPromotionResponseDTO {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      promo_code: record.promo_code,
      starts_at: record.starts_at.toISOString(),
      ends_at: record.ends_at.toISOString(),
      pricing_note: record.pricing_note,
      is_active: record.is_active,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toFaqEntryResponse(
    record: GymFaqEntryRecord,
  ): GymFaqEntryResponseDTO {
    return {
      id: record.id,
      category: record.category,
      question: record.question,
      answer: record.answer,
      keywords: this.normalizeKeywords(record.keywords),
      sort_order: record.sort_order,
      is_active: record.is_active,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private assertUniqueOperatingDays(hours: UpsertGymOperatingHoursDTO[]): void {
    const seen = new Set<number>();
    const duplicates = new Set<number>();

    for (const hour of hours) {
      if (seen.has(hour.day_of_week)) {
        duplicates.add(hour.day_of_week);
      }

      seen.add(hour.day_of_week);
    }

    if (duplicates.size > 0) {
      throw new BadRequestException(
        `day_of_week entries must be unique. Duplicate values: ${Array.from(
          duplicates,
        )
          .sort((left, right) => left - right)
          .join(', ')}`,
      );
    }
  }

  private normalizeKeywords(value: Prisma.JsonValue | null): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private formatTime(value: Date): string {
    return value.toISOString().slice(11, 16);
  }

  private formatNullableTime(value: Date | null): string | null {
    return value ? this.formatTime(value) : null;
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}

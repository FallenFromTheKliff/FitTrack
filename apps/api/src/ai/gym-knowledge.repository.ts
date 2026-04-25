import { Injectable } from '@nestjs/common';
import {
  GymFaqEntry,
  GymFaqCategory,
  GymOperatingHour,
  GymPromotion,
  GymSpecialSchedule,
  Prisma,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDTO } from '../user/dto/user-dto';
import {
  CreateGymFaqEntryDTO,
  CreateGymPromotionDTO,
  CreateGymSpecialScheduleDTO,
  UpsertGymOperatingHoursDTO,
} from './dto/gym-knowledge.dto';

export type GymOperatingHourRecord = GymOperatingHour;
export type GymSpecialScheduleRecord = GymSpecialSchedule;
export type GymPromotionRecord = GymPromotion;
export type GymFaqEntryRecord = GymFaqEntry;

@Injectable()
export class GymKnowledgeRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listOperatingHours(): Promise<GymOperatingHourRecord[]> {
    return this.findAll<GymOperatingHourRecord>(
      this.prisma.gymOperatingHour,
      { is_active: true },
      undefined,
      { day_of_week: 'asc' },
    );
  }

  listFaqEntriesByQuestions(
    category: GymFaqCategory,
    questions: string[],
  ): Promise<GymFaqEntryRecord[]> {
    return this.prisma.gymFaqEntry.findMany({
      where: {
        category,
        is_active: true,
        question: {
          in: questions,
        },
      },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });
  }

  replaceOperatingHours(
    hours: UpsertGymOperatingHoursDTO[],
  ): Promise<GymOperatingHourRecord[]> {
    const activeDays = hours.map((entry) => entry.day_of_week);

    return this.transaction(async (tx) => {
      await tx.gymOperatingHour.updateMany({
        where:
          activeDays.length > 0
            ? { day_of_week: { notIn: activeDays } }
            : undefined,
        data: { is_active: false },
      });

      for (const hour of hours) {
        const payload = this.toOperatingHourWrite(hour);
        await tx.gymOperatingHour.upsert({
          where: { day_of_week: hour.day_of_week },
          create: payload,
          update: {
            opens_at: payload.opens_at,
            closes_at: payload.closes_at,
            is_closed: payload.is_closed,
            label: payload.label,
            is_active: true,
          },
        });
      }

      return tx.gymOperatingHour.findMany({
        where: { is_active: true },
        orderBy: { day_of_week: 'asc' },
      });
    });
  }

  listSpecialSchedules(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymSpecialScheduleRecord>> {
    return this.paginate<GymSpecialScheduleRecord>(
      this.prisma.gymSpecialSchedule,
      {
        where: { is_active: true },
        orderBy: [
          { starts_on: 'asc' },
          { ends_on: 'asc' },
          { created_at: 'desc' },
        ],
      },
      dto,
    );
  }

  createSpecialSchedule(
    dto: CreateGymSpecialScheduleDTO,
  ): Promise<GymSpecialScheduleRecord> {
    return this.create<GymSpecialScheduleRecord>(
      this.prisma.gymSpecialSchedule,
      {
        starts_on: this.toDateOnly(dto.starts_on),
        ends_on: this.toDateOnly(dto.ends_on),
        opens_at: dto.opens_at ? this.toTimeDate(dto.opens_at) : null,
        closes_at: dto.closes_at ? this.toTimeDate(dto.closes_at) : null,
        is_closed: dto.is_closed ?? false,
        reason: dto.reason,
        pricing_note: dto.pricing_note ?? null,
      },
    );
  }

  listPromotions(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymPromotionRecord>> {
    return this.paginate<GymPromotionRecord>(
      this.prisma.gymPromotion,
      {
        where: { is_active: true },
        orderBy: [
          { starts_at: 'asc' },
          { ends_at: 'asc' },
          { created_at: 'desc' },
        ],
      },
      dto,
    );
  }

  createPromotion(dto: CreateGymPromotionDTO): Promise<GymPromotionRecord> {
    return this.create<GymPromotionRecord>(this.prisma.gymPromotion, {
      title: dto.title,
      description: dto.description,
      promo_code: dto.promo_code ?? null,
      starts_at: new Date(dto.starts_at),
      ends_at: new Date(dto.ends_at),
      pricing_note: dto.pricing_note ?? null,
    });
  }

  listFaqEntries(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymFaqEntryRecord>> {
    return this.paginate<GymFaqEntryRecord>(
      this.prisma.gymFaqEntry,
      {
        where: { is_active: true },
        orderBy: [
          { category: 'asc' },
          { sort_order: 'asc' },
          { created_at: 'desc' },
        ],
      },
      dto,
    );
  }

  createFaqEntry(dto: CreateGymFaqEntryDTO): Promise<GymFaqEntryRecord> {
    return this.create<GymFaqEntryRecord>(this.prisma.gymFaqEntry, {
      category: dto.category,
      question: dto.question,
      answer: dto.answer,
      keywords: dto.keywords ?? Prisma.JsonNull,
      sort_order: dto.sort_order ?? 0,
    });
  }

  upsertFaqEntries(
    category: GymFaqCategory,
    entries: Array<{
      answer: string;
      question: string;
      sort_order: number;
    }>,
  ): Promise<GymFaqEntryRecord[]> {
    return this.transaction(async (tx) => {
      for (const entry of entries) {
        const existing = await tx.gymFaqEntry.findFirst({
          where: {
            category,
            question: entry.question,
          },
          orderBy: [{ is_active: 'desc' }, { created_at: 'asc' }],
        });

        if (existing) {
          await tx.gymFaqEntry.update({
            where: { id: existing.id },
            data: {
              answer: entry.answer,
              is_active: true,
              sort_order: entry.sort_order,
            },
          });
          continue;
        }

        await tx.gymFaqEntry.create({
          data: {
            answer: entry.answer,
            category,
            question: entry.question,
            sort_order: entry.sort_order,
          },
        });
      }

      return tx.gymFaqEntry.findMany({
        where: {
          category,
          is_active: true,
          question: {
            in: entries.map((entry) => entry.question),
          },
        },
        orderBy: [
          { sort_order: 'asc' },
          { created_at: 'asc' },
        ],
      });
    });
  }

  private toOperatingHourWrite(
    dto: UpsertGymOperatingHoursDTO,
  ): Prisma.GymOperatingHourUncheckedCreateInput {
    return {
      day_of_week: dto.day_of_week,
      opens_at: this.toTimeDate(dto.opens_at),
      closes_at: this.toTimeDate(dto.closes_at),
      is_closed: dto.is_closed ?? false,
      label: dto.label ?? null,
      is_active: true,
    };
  }

  private toTimeDate(value: string): Date {
    const normalized = value.length === 5 ? `${value}:00` : value;
    return new Date(`1970-01-01T${normalized}.000Z`);
  }

  private toDateOnly(value: string): Date {
    const normalized = value.slice(0, 10);
    return new Date(`${normalized}T00:00:00.000Z`);
  }
}

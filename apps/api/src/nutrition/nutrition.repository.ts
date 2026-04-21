import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  Prisma,
  type MacroTarget,
  type NutritionLog,
  type TdeeProfile,
} from '@prisma/client';

import {
  BaseRepository,
  type PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeDTO, type PaginationDTO } from '../user/dto/user-dto';

export type ActiveTdeeAggregateRecord = TdeeProfile & {
  macro_targets: MacroTarget[];
};

export type RotateActiveTdeeSnapshotInput = {
  userId: string;
  calculatedAt: Date;
  snapshot: {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: Gender;
    activityLevel: ActivityLevel;
    fitnessGoal: FitnessGoal;
  };
  aiResult: {
    bmr: number;
    tdee: number;
    targetCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
};

export type DailyNutritionSummaryAggregate = {
  date: string;
  totals: {
    calories: Prisma.Decimal | null;
    protein_g: Prisma.Decimal | null;
    carbs_g: Prisma.Decimal | null;
    fat_g: Prisma.Decimal | null;
  };
  macroTarget: MacroTarget | null;
};

@Injectable()
export class NutritionRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findActiveTdeeAggregate(
    userId: string,
  ): Promise<ActiveTdeeAggregateRecord | null> {
    const tdee = await this.findOne<ActiveTdeeAggregateRecord>(
      this.prisma.tdeeProfile,
      {
        user_id: userId,
        is_active: true,
      },
      {
        macro_targets: {
          where: {
            user_id: userId,
            is_active: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
    );

    if (!tdee || tdee.macro_targets.length === 0) {
      return null;
    }

    return tdee;
  }

  async findActiveTdeeAggregateOrThrow(
    userId: string,
  ): Promise<ActiveTdeeAggregateRecord> {
    const tdee = await this.findOneOrThrow<ActiveTdeeAggregateRecord>(
      this.prisma.tdeeProfile,
      {
        user_id: userId,
        is_active: true,
      },
      'TdeeProfile',
      {
        macro_targets: {
          where: {
            user_id: userId,
            is_active: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
    );

    if (tdee.macro_targets.length === 0) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'MacroTarget Not Found',
        status: 404,
        detail: 'MacroTarget not found.',
      });
    }

    return tdee;
  }

  findActiveMacroTarget(userId: string): Promise<MacroTarget | null> {
    return this.findOne<MacroTarget>(
      this.prisma.macroTarget,
      {
        user_id: userId,
        is_active: true,
      },
      undefined,
      {
        created_at: 'desc',
      },
    );
  }

  listTdeeHistory(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<TdeeProfile>> {
    return this.paginateByUserId<TdeeProfile>(
      this.prisma.tdeeProfile,
      userId,
      {
        orderBy: [{ calculated_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  createNutritionLog(
    data: Prisma.NutritionLogCreateInput,
  ): Promise<NutritionLog> {
    return this.create<NutritionLog>(this.prisma.nutritionLog, data);
  }

  listNutritionLogs(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<NutritionLog>> {
    return this.paginateByUserIdWithDateRange<NutritionLog>(
      this.prisma.nutritionLog,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'log_date',
      },
      {
        orderBy: [{ log_date: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  async updateNutritionLog(
    userId: string,
    logId: string,
    data: Prisma.NutritionLogUpdateInput,
  ): Promise<NutritionLog> {
    await this.findByIdAndAssertOwnership<NutritionLog>(
      this.prisma.nutritionLog,
      logId,
      userId,
      'NutritionLog',
    );

    return this.updateById<NutritionLog>(this.prisma.nutritionLog, logId, data);
  }

  async deleteNutritionLog(userId: string, logId: string): Promise<void> {
    await this.findByIdAndAssertOwnership<NutritionLog>(
      this.prisma.nutritionLog,
      logId,
      userId,
      'NutritionLog',
    );

    await this.deleteById(this.prisma.nutritionLog, logId);
  }

  async getDailyNutritionSummary(
    userId: string,
    date: string,
  ): Promise<DailyNutritionSummaryAggregate> {
    const { start, end } = this.toDateOnlyBounds(date);

    const [aggregate, macroTarget] = await Promise.all([
      this.prisma.nutritionLog.aggregate({
        where: {
          user_id: userId,
          log_date: {
            gte: start,
            lt: end,
          },
        },
        _sum: {
          calories: true,
          protein_g: true,
          carbs_g: true,
          fat_g: true,
        },
      }),
      this.findActiveMacroTarget(userId),
    ]);

    return {
      date,
      totals: {
        calories: aggregate._sum.calories,
        protein_g: aggregate._sum.protein_g,
        carbs_g: aggregate._sum.carbs_g,
        fat_g: aggregate._sum.fat_g,
      },
      macroTarget,
    };
  }

  async rotateActiveTdeeSnapshot(
    input: RotateActiveTdeeSnapshotInput,
  ): Promise<ActiveTdeeAggregateRecord> {
    return this.transaction(async (tx) => {
      await tx.tdeeProfile.updateMany({
        where: {
          user_id: input.userId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });

      const tdee = await tx.tdeeProfile.create({
        data: {
          user_id: input.userId,
          weight_kg: new Prisma.Decimal(input.snapshot.weightKg),
          height_cm: new Prisma.Decimal(input.snapshot.heightCm),
          age: input.snapshot.age,
          gender: input.snapshot.gender,
          activity_level: input.snapshot.activityLevel,
          fitness_goal: input.snapshot.fitnessGoal,
          bmr_calories: new Prisma.Decimal(input.aiResult.bmr),
          tdee_calories: new Prisma.Decimal(input.aiResult.tdee),
          is_active: true,
          calculated_at: input.calculatedAt,
        },
      });

      await tx.macroTarget.updateMany({
        where: {
          user_id: input.userId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });

      const macro = await tx.macroTarget.create({
        data: {
          user_id: input.userId,
          tdee_profile_id: tdee.id,
          target_calories: new Prisma.Decimal(input.aiResult.targetCalories),
          protein_g: new Prisma.Decimal(input.aiResult.proteinG),
          carbs_g: new Prisma.Decimal(input.aiResult.carbsG),
          fat_g: new Prisma.Decimal(input.aiResult.fatG),
          is_active: true,
        },
      });

      return {
        ...tdee,
        macro_targets: [macro],
      };
    });
  }

  private toDateOnlyBounds(date: string): { start: Date; end: Date } {
    const start = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return { start, end };
  }
}

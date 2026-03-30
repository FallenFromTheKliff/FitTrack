import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  Prisma,
  type MacroTarget,
  type NutritionLog,
  type TdeeProfile,
} from '@prisma/client';

import { AiPythonClientService } from '../ai/ai-python-client.service';
import { type PaginatedResult } from '../common/base-repository/base-repository';
import { UserService } from '../user/user.service';
import { DateRangeDTO, type PaginationDTO } from '../user/dto/user-dto';
import {
  ActiveTdeeResponseDTO,
  DailyMacroTotalsResponseDTO,
  DailyNutritionSummaryResponseDTO,
  DailySummaryDateQueryDTO,
  LogNutritionDTO,
  MacroTargetResponseDTO,
  NutritionLogResponseDTO,
  RecalculateTdeeDTO,
  TdeeProfileResponseDTO,
  UpdateNutritionLogDTO,
} from './dto/nutrition.dto';
import {
  TDEE_RECALCULATED_EVENT,
  type TdeeRecalculatedEvent,
} from './events/tdee-recalculated.event';
import { NutritionRepository } from './nutrition.repository';

const NUTRITION_LOG_UPDATE_FIELDS = [
  'meal_name',
  'food_item',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'quantity',
  'unit',
] as const;

type UserNutritionProfileAggregate = {
  profile: {
    date_of_birth: Date | null;
    gender: Gender | null;
    weight_kg: Prisma.Decimal | null;
    height_cm: Prisma.Decimal | null;
    activity_level: ActivityLevel | null;
    fitness_goal: FitnessGoal | null;
  };
};

type FinalTdeeSnapshot = {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
};

type DailyTotalsSource = {
  calories: Prisma.Decimal | number | null;
  protein_g: Prisma.Decimal | number | null;
  carbs_g: Prisma.Decimal | number | null;
  fat_g: Prisma.Decimal | number | null;
};

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
export class NutritionService {
  constructor(
    private readonly repo: NutritionRepository,
    private readonly userService: UserService,
    private readonly aiClient: AiPythonClientService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getActiveTdee(userId: string): Promise<ActiveTdeeResponseDTO> {
    const record = await this.repo.findActiveTdeeAggregateOrThrow(userId);

    return {
      tdee: this.toTdeeProfileResponse(record),
      macros: this.toMacroTargetResponse(record.macro_targets[0]),
    };
  }

  async getTdeeHistory(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<TdeeProfileResponseDTO>> {
    const result = await this.repo.listTdeeHistory(userId, dto);

    return {
      data: result.data.map((record) => this.toTdeeProfileResponse(record)),
      meta: result.meta,
    };
  }

  async recalculateTdee(
    userId: string,
    dto: RecalculateTdeeDTO,
  ): Promise<ActiveTdeeResponseDTO> {
    const aggregate = (await this.userService.getMyProfile(
      userId,
    )) as UserNutritionProfileAggregate;
    const snapshot = this.buildFinalTdeeSnapshot(aggregate, dto);
    const calculatedAt = new Date();
    const aiResult = await this.aiClient.calculateTdee({
      age: snapshot.age,
      gender: snapshot.gender,
      weight_kg: snapshot.weightKg,
      height_cm: snapshot.heightCm,
      activity_level: snapshot.activityLevel,
      fitness_goal: snapshot.fitnessGoal,
    });

    const record = await this.repo.rotateActiveTdeeSnapshot({
      userId,
      calculatedAt,
      snapshot,
      aiResult: {
        bmr: aiResult.bmr,
        tdee: aiResult.tdee,
        targetCalories: aiResult.target_calories,
        proteinG: aiResult.protein_g,
        carbsG: aiResult.carbs_g,
        fatG: aiResult.fat_g,
      },
    });

    this.emitTdeeRecalculated({
      userId,
      tdeeProfileId: record.id,
      macroTargetId: record.macro_targets[0].id,
      recalculatedAt: calculatedAt.toISOString(),
    });

    return {
      tdee: this.toTdeeProfileResponse(record),
      macros: this.toMacroTargetResponse(record.macro_targets[0]),
    };
  }

  async logNutrition(
    userId: string,
    dto: LogNutritionDTO,
  ): Promise<NutritionLogResponseDTO> {
    const activeMacroTarget = await this.repo.findActiveMacroTarget(userId);
    const record = await this.repo.createNutritionLog({
      user: {
        connect: { id: userId },
      },
      ...(activeMacroTarget
        ? {
            macro_target: {
              connect: { id: activeMacroTarget.id },
            },
          }
        : {}),
      log_date: this.parseDateOnly(dto.log_date),
      meal_name: dto.meal_name,
      food_item: dto.food_item,
      calories: dto.calories,
      protein_g: dto.protein_g,
      carbs_g: dto.carbs_g,
      fat_g: dto.fat_g,
      quantity: dto.quantity,
      unit: dto.unit,
    });

    return this.toNutritionLogResponse(record);
  }

  async getNutritionLogs(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<NutritionLogResponseDTO>> {
    const result = await this.repo.listNutritionLogs(userId, dto);

    return {
      data: result.data.map((record) => this.toNutritionLogResponse(record)),
      meta: result.meta,
    };
  }

  async updateNutritionLog(
    userId: string,
    logId: string,
    dto: UpdateNutritionLogDTO,
  ): Promise<NutritionLogResponseDTO> {
    const record = await this.repo.updateNutritionLog(
      userId,
      logId,
      this.toNutritionLogUpdateInput(dto),
    );

    return this.toNutritionLogResponse(record);
  }

  async deleteNutritionLog(userId: string, logId: string): Promise<void> {
    await this.repo.deleteNutritionLog(userId, logId);
  }

  async getDailySummary(
    userId: string,
    dto: DailySummaryDateQueryDTO,
  ): Promise<DailyNutritionSummaryResponseDTO> {
    const summary = await this.repo.getDailyNutritionSummary(userId, dto.date);
    const logged = this.toDailyTotals(summary.totals);
    const target = summary.macroTarget
      ? this.toDailyTotals({
          calories: summary.macroTarget.target_calories,
          protein_g: summary.macroTarget.protein_g,
          carbs_g: summary.macroTarget.carbs_g,
          fat_g: summary.macroTarget.fat_g,
        })
      : null;

    return {
      date: summary.date,
      macro_target_id: summary.macroTarget?.id ?? null,
      logged,
      target,
      remaining: target ? this.subtractDailyTotals(target, logged) : null,
    };
  }

  private toTdeeProfileResponse(record: TdeeProfile): TdeeProfileResponseDTO {
    return {
      id: record.id,
      user_id: record.user_id,
      weight_kg: record.weight_kg.toFixed(2),
      height_cm: record.height_cm.toFixed(2),
      age: record.age,
      gender: record.gender,
      activity_level: record.activity_level,
      fitness_goal: record.fitness_goal,
      bmr_calories: record.bmr_calories.toFixed(2),
      tdee_calories: record.tdee_calories.toFixed(2),
      is_active: record.is_active,
      calculated_at: record.calculated_at.toISOString(),
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toMacroTargetResponse(record: MacroTarget): MacroTargetResponseDTO {
    return {
      id: record.id,
      user_id: record.user_id,
      tdee_profile_id: record.tdee_profile_id,
      target_calories: record.target_calories.toFixed(2),
      protein_g: record.protein_g.toFixed(2),
      carbs_g: record.carbs_g.toFixed(2),
      fat_g: record.fat_g.toFixed(2),
      is_active: record.is_active,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private toNutritionLogResponse(
    record: NutritionLog,
  ): NutritionLogResponseDTO {
    return {
      id: record.id,
      user_id: record.user_id,
      macro_target_id: record.macro_target_id ?? null,
      log_date: record.log_date.toISOString(),
      meal_name: record.meal_name,
      food_item: record.food_item,
      calories: record.calories.toFixed(2),
      protein_g: record.protein_g.toFixed(2),
      carbs_g: record.carbs_g.toFixed(2),
      fat_g: record.fat_g.toFixed(2),
      quantity: record.quantity.toFixed(2),
      unit: record.unit,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  private buildFinalTdeeSnapshot(
    aggregate: UserNutritionProfileAggregate,
    dto: RecalculateTdeeDTO,
  ): FinalTdeeSnapshot {
    const profile = aggregate.profile;
    const dateOfBirth = profile.date_of_birth;
    const gender = dto.gender ?? profile.gender;
    const weightKg = dto.weight_kg ?? profile.weight_kg?.toNumber();
    const heightCm = dto.height_cm ?? profile.height_cm?.toNumber();
    const activityLevel = dto.activity_level ?? profile.activity_level;
    const fitnessGoal = dto.fitness_goal ?? profile.fitness_goal;

    const missingFields = [
      dateOfBirth ? null : 'date_of_birth',
      gender ? null : 'gender',
      weightKg !== undefined ? null : 'weight_kg',
      heightCm !== undefined ? null : 'height_cm',
      activityLevel ? null : 'activity_level',
      fitnessGoal ? null : 'fitness_goal',
    ].filter((field): field is string => field !== null);

    if (missingFields.length > 0) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Incomplete Profile For TDEE Recalculation',
          status: 422,
          detail: `Complete these profile fields before recalculating TDEE: ${missingFields.join(', ')}.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      age: this.calculateAge(dateOfBirth as Date),
      gender: gender as Gender,
      weightKg: weightKg as number,
      heightCm: heightCm as number,
      activityLevel: activityLevel as ActivityLevel,
      fitnessGoal: fitnessGoal as FitnessGoal,
    };
  }

  private toNutritionLogUpdateInput(
    dto: UpdateNutritionLogDTO,
  ): Prisma.NutritionLogUpdateInput {
    return {
      ...pickDefined(dto, NUTRITION_LOG_UPDATE_FIELDS),
    };
  }

  private toDailyTotals(
    source: DailyTotalsSource,
  ): DailyMacroTotalsResponseDTO {
    return {
      calories: this.toDecimalString(source.calories),
      protein_g: this.toDecimalString(source.protein_g),
      carbs_g: this.toDecimalString(source.carbs_g),
      fat_g: this.toDecimalString(source.fat_g),
    };
  }

  private subtractDailyTotals(
    target: DailyMacroTotalsResponseDTO,
    logged: DailyMacroTotalsResponseDTO,
  ): DailyMacroTotalsResponseDTO {
    return {
      calories: this.subtractDecimalStrings(target.calories, logged.calories),
      protein_g: this.subtractDecimalStrings(
        target.protein_g,
        logged.protein_g,
      ),
      carbs_g: this.subtractDecimalStrings(target.carbs_g, logged.carbs_g),
      fat_g: this.subtractDecimalStrings(target.fat_g, logged.fat_g),
    };
  }

  private subtractDecimalStrings(target: string, logged: string): string {
    return (Number(target) - Number(logged)).toFixed(2);
  }

  private toDecimalString(value: Prisma.Decimal | number | null): string {
    if (value === null) {
      return '0.00';
    }

    return typeof value === 'number' ? value.toFixed(2) : value.toFixed(2);
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();

    if (
      monthDelta < 0 ||
      (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  private emitTdeeRecalculated(event: TdeeRecalculatedEvent): void {
    this.eventEmitter.emit(TDEE_RECALCULATED_EVENT, event);
  }
}

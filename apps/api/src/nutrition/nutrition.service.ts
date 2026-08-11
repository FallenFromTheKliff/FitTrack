import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  NutritionIconKind,
  Prisma,
  type MacroTarget,
  type NutritionLog,
  type TdeeProfile,
} from '@prisma/client';

import { AiPythonClientService } from '../ai/ai-python-client.service';
import { type PaginatedResult } from '../common/base-repository/base-repository';
import { assertValidMemberDateOfBirth } from '../common/validators';
import { FilesService } from '../files/files.service';
import { UserService } from '../user/user.service';
import { type PaginationDTO } from '../user/dto/user-dto';
import {
  ActiveTdeeResponseDTO,
  DailyMacroTotalsResponseDTO,
  DailyNutritionSummaryResponseDTO,
  DailySummaryDateQueryDTO,
  LogNutritionDTO,
  MacroTargetResponseDTO,
  NUTRITION_MEAL_ICON_FALLBACKS,
  NUTRITION_MEAL_ICON_LIBRARY_KEYS,
  NutritionCoachingInsightResponseDTO,
  NutritionLogIconResponseDTO,
  type NutritionLogIconInputDTO,
  type NutritionLogFilterDTO,
  NutritionLogResponseDTO,
  RecalculateTdeeDTO,
  TdeeProfileResponseDTO,
  UpdateNutritionLogDTO,
} from './dto/nutrition.dto';
import {
  TDEE_RECALCULATED_EVENT,
  type TdeeRecalculatedEvent,
} from './events/tdee-recalculated.event';
import {
  NutritionRepository,
  type NutritionProgressionSnapshot,
} from './nutrition.repository';

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

type NutritionLogIconWriteData = {
  icon_kind?: NutritionIconKind | null;
  icon_key?: string | null;
  icon_asset_key?: string | null;
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
    private readonly filesService: FilesService,
  ) {}

  async getActiveTdee(userId: string): Promise<ActiveTdeeResponseDTO | null> {
    const record = await this.repo.findActiveTdeeAggregate(userId);

    if (!record) {
      return null;
    }

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
    const iconData = await this.toNutritionLogIconData(userId, dto.icon);
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
      ...iconData,
    });

    return this.toNutritionLogResponse(record);
  }

  async getNutritionLogs(
    userId: string,
    dto: NutritionLogFilterDTO,
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
    const iconData = await this.toNutritionLogIconData(userId, dto.icon);
    const record = await this.repo.updateNutritionLog(
      userId,
      logId,
      {
        ...this.toNutritionLogUpdateInput(dto),
        ...iconData,
      },
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
    const remaining = target ? this.subtractDailyTotals(target, logged) : null;

    return {
      date: summary.date,
      macro_target_id: summary.macroTarget?.id ?? null,
      logged,
      target,
      remaining,
      coaching: this.buildCoachingInsights({
        logged,
        progressionSnapshot: summary.progressionSnapshot ?? null,
        remaining,
        target,
      }),
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
      icon: this.toNutritionLogIconResponse(record),
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

    const validatedDateOfBirth = assertValidMemberDateOfBirth(
      dateOfBirth as Date,
    );

    return {
      age: this.calculateAge(validatedDateOfBirth),
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
      ...(dto.log_date !== undefined
        ? { log_date: this.parseDateOnly(dto.log_date) }
        : {}),
    };
  }

  private async toNutritionLogIconData(
    userId: string,
    icon: NutritionLogIconInputDTO | null | undefined,
  ): Promise<NutritionLogIconWriteData> {
    if (icon === undefined) {
      return {};
    }

    if (icon === null) {
      return {
        icon_kind: null,
        icon_key: null,
        icon_asset_key: null,
      };
    }

    if (icon.kind === 'library') {
      if (
        !icon.key ||
        !NUTRITION_MEAL_ICON_LIBRARY_KEYS.includes(icon.key) ||
        icon.asset_key
      ) {
        throw this.invalidNutritionIcon(
          'Library meal icons require one allowlisted key and no custom asset.',
        );
      }

      return {
        icon_kind: 'library',
        icon_key: icon.key,
        icon_asset_key: null,
      };
    }

    if (icon.kind === 'custom') {
      if (icon.key || !icon.asset_key) {
        throw this.invalidNutritionIcon(
          'Custom meal icons require one managed asset and no library key.',
        );
      }

      await this.filesService.assertUserOwnedRasterImage(
        icon.asset_key,
        userId,
      );

      return {
        icon_kind: 'custom',
        icon_key: null,
        icon_asset_key: icon.asset_key,
      };
    }

    throw this.invalidNutritionIcon('The meal icon kind is invalid.');
  }

  private toNutritionLogIconResponse(
    record: NutritionLog,
  ): NutritionLogIconResponseDTO {
    if (
      record.icon_kind === 'custom' &&
      record.icon_asset_key &&
      this.filesService.isUserOwnedUploadKey(
        record.icon_asset_key,
        record.user_id,
      )
    ) {
      return {
        kind: 'custom',
        key: null,
        asset_key: record.icon_asset_key,
      };
    }

    if (
      record.icon_kind === 'library' &&
      record.icon_key &&
      NUTRITION_MEAL_ICON_LIBRARY_KEYS.includes(
        record.icon_key as (typeof NUTRITION_MEAL_ICON_LIBRARY_KEYS)[number],
      )
    ) {
      return {
        kind: 'library',
        key: record.icon_key as (typeof NUTRITION_MEAL_ICON_LIBRARY_KEYS)[number],
        asset_key: null,
      };
    }

    const fallback =
      NUTRITION_MEAL_ICON_FALLBACKS[record.meal_name.trim().toLowerCase()] ??
      'utensils';

    return {
      kind: 'library',
      key: fallback,
      asset_key: null,
    };
  }

  private invalidNutritionIcon(detail: string): BadRequestException {
    return new BadRequestException({
      type: 'BUSINESS_RULE_VIOLATION',
      title: 'Invalid Meal Icon',
      status: 400,
      detail,
    });
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

  private buildCoachingInsights(input: {
    logged: DailyMacroTotalsResponseDTO;
    progressionSnapshot: NutritionProgressionSnapshot | null;
    remaining: DailyMacroTotalsResponseDTO | null;
    target: DailyMacroTotalsResponseDTO | null;
  }): NutritionCoachingInsightResponseDTO[] {
    const insights: NutritionCoachingInsightResponseDTO[] = [];

    if (!input.target || !input.remaining) {
      return [
        {
          id: 'nutrition-target-missing',
          priority: 'info',
          title: 'Set a macro target before coaching gets specific',
          message:
            'Daily totals are live, but coaching cards stay general until an active TDEE and macro target exists.',
          reason_codes: ['missing_macro_target'],
          source: 'nutrition_summary',
        },
      ];
    }

    const caloriesRemaining = Number(input.remaining.calories);
    const proteinRemaining = Number(input.remaining.protein_g);
    const carbsRemaining = Number(input.remaining.carbs_g);
    const caloriesLogged = Number(input.logged.calories);
    const targetCalories = Number(input.target.calories);
    const streak = input.progressionSnapshot?.current_streak ?? 0;

    if (streak >= 3 && proteinRemaining > 25) {
      insights.push({
        id: 'protein-streak-support',
        priority: 'recovery',
        title: 'Fuel the streak with protein first',
        message:
          'Your progression streak is active and protein is still behind target. Prioritize a protein-forward meal before chasing extra calories.',
        reason_codes: ['active_progression_streak', 'protein_remaining'],
        source: 'progression_summary',
      });
    }

    if (caloriesRemaining < -150) {
      insights.push({
        id: 'calorie-overage-caution',
        priority: 'warning',
        title: `${Math.abs(caloriesRemaining).toFixed(0)} kcal over target`,
        message:
          'Keep the rest of today lighter and protein-focused. This card never changes targets automatically; it only explains the current summary.',
        reason_codes: ['calories_over_target'],
        source: 'nutrition_summary',
      });
    } else if (caloriesRemaining > 250 && proteinRemaining > 20) {
      insights.push({
        id: 'protein-energy-gap',
        priority: 'opportunity',
        title: 'Protein plus energy are both open',
        message:
          'A balanced protein-and-carb meal is the cleanest next move because both calories and protein still have meaningful room.',
        reason_codes: ['calories_remaining', 'protein_remaining'],
        source: 'nutrition_summary',
      });
    } else if (proteinRemaining > 25) {
      insights.push({
        id: 'protein-gap',
        priority: 'opportunity',
        title: `${proteinRemaining.toFixed(0)}g protein still open`,
        message:
          'Bias the next meal toward lean protein. Calories are secondary here; the macro gap is the stronger signal.',
        reason_codes: ['protein_remaining'],
        source: 'nutrition_summary',
      });
    }

    if (carbsRemaining > 45 && caloriesLogged < targetCalories) {
      insights.push({
        id: 'carb-training-support',
        priority: 'opportunity',
        title: 'Carbs can support the next session',
        message:
          'Carbs are still meaningfully under target, so a rice, oats, fruit, or bread-based add-on can support training without touching exercise logic.',
        reason_codes: ['carbs_remaining', 'under_calorie_target'],
        source: 'nutrition_summary',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'nutrition-steady',
        priority: 'info',
        title: 'Nutrition is sitting in a steady range',
        message:
          'Calories and macros are close enough to target that the next meal can be normal instead of corrective.',
        reason_codes: ['summary_in_range'],
        source: 'nutrition_summary',
      });
    }

    return insights.slice(0, 3);
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

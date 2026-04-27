import type {
  ActiveNutritionProfileRecord,
  DailyNutritionSummaryRecord,
  NutritionCoachingInsightPriority,
  NutritionCoachingInsightSource,
  NutritionActivityLevel,
  NutritionFitnessGoal,
  NutritionGender,
  NutritionLogRecord,
  NutritionMacroTargetRecord,
  NutritionMacroTotalsRecord,
  NutritionTdeeRecord,
  NutritionUnit,
  PaginatedResult
} from "@fittrack/types";
import { toApiClientError } from "../errors/api-client-error";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { unwrapPaginatedResponse, unwrapResponse, unwrapVoidResponse } from "../request";

export type NutritionHistoryParams = {
  limit?: number;
  page?: number;
};

export type NutritionLogListParams = NutritionHistoryParams & {
  endDate?: string;
  startDate?: string;
};

export type RecalculateNutritionPayload = {
  activityLevel?: NutritionActivityLevel;
  fitnessGoal?: NutritionFitnessGoal;
  gender?: NutritionGender;
  heightCm?: number;
  weightKg?: number;
};

export type CreateNutritionLogPayload = {
  calories: number;
  carbsG: number;
  fatG: number;
  foodItem: string;
  logDate: string;
  mealName: string;
  proteinG: number;
  quantity: number;
  unit: NutritionUnit;
};

export type UpdateNutritionLogPayload = Partial<CreateNutritionLogPayload>;

type ActiveTdeeApiRecord = {
  macros: MacroTargetApiRecord;
  tdee: TdeeApiRecord;
};

type TdeeApiRecord = {
  activity_level: NutritionActivityLevel;
  age: number;
  bmr_calories: string | number;
  calculated_at: string;
  created_at: string;
  fitness_goal: NutritionFitnessGoal;
  gender: NutritionGender;
  height_cm: string | number;
  id: string;
  is_active: boolean;
  tdee_calories: string | number;
  updated_at: string;
  user_id: string;
  weight_kg: string | number;
};

type MacroTargetApiRecord = {
  carbs_g: string | number;
  created_at: string;
  fat_g: string | number;
  id: string;
  is_active: boolean;
  protein_g: string | number;
  target_calories: string | number;
  tdee_profile_id: string;
  updated_at: string;
  user_id: string;
};

type NutritionLogApiRecord = {
  calories: string | number;
  carbs_g: string | number;
  created_at: string;
  fat_g: string | number;
  food_item: string;
  id: string;
  log_date: string;
  macro_target_id: string | null;
  meal_name: string;
  protein_g: string | number;
  quantity: string | number;
  unit: NutritionUnit;
  updated_at: string;
  user_id: string;
};

type DailyMacroTotalsApiRecord = {
  calories: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  protein_g: string | number;
};

type DailyNutritionSummaryApiRecord = {
  coaching?: NutritionCoachingInsightApiRecord[];
  date: string;
  logged: DailyMacroTotalsApiRecord;
  macro_target_id: string | null;
  remaining: DailyMacroTotalsApiRecord | null;
  target: DailyMacroTotalsApiRecord | null;
};

type NutritionCoachingInsightApiRecord = {
  id: string;
  message: string;
  priority: NutritionCoachingInsightPriority;
  reason_codes?: string[];
  source: NutritionCoachingInsightSource;
  title: string;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapMacroTotals(record: DailyMacroTotalsApiRecord): NutritionMacroTotalsRecord {
  return {
    calories: toNumber(record.calories),
    carbsG: toNumber(record.carbs_g),
    fatG: toNumber(record.fat_g),
    proteinG: toNumber(record.protein_g)
  };
}

function mapTdeeRecord(record: TdeeApiRecord): NutritionTdeeRecord {
  return {
    activityLevel: record.activity_level,
    age: record.age,
    bmrCalories: toNumber(record.bmr_calories),
    calculatedAt: record.calculated_at,
    createdAt: record.created_at,
    fitnessGoal: record.fitness_goal,
    gender: record.gender,
    heightCm: toNumber(record.height_cm),
    id: record.id,
    isActive: record.is_active,
    tdeeCalories: toNumber(record.tdee_calories),
    updatedAt: record.updated_at,
    userId: record.user_id,
    weightKg: toNumber(record.weight_kg)
  };
}

function mapMacroTargetRecord(record: MacroTargetApiRecord): NutritionMacroTargetRecord {
  return {
    carbsG: toNumber(record.carbs_g),
    createdAt: record.created_at,
    fatG: toNumber(record.fat_g),
    id: record.id,
    isActive: record.is_active,
    proteinG: toNumber(record.protein_g),
    targetCalories: toNumber(record.target_calories),
    tdeeProfileId: record.tdee_profile_id,
    updatedAt: record.updated_at,
    userId: record.user_id
  };
}

function mapNutritionLog(record: NutritionLogApiRecord): NutritionLogRecord {
  return {
    calories: toNumber(record.calories),
    carbsG: toNumber(record.carbs_g),
    createdAt: record.created_at,
    fatG: toNumber(record.fat_g),
    foodItem: record.food_item,
    id: record.id,
    logDate: record.log_date,
    macroTargetId: record.macro_target_id,
    mealName: record.meal_name,
    proteinG: toNumber(record.protein_g),
    quantity: toNumber(record.quantity),
    unit: record.unit,
    updatedAt: record.updated_at,
    userId: record.user_id
  };
}

function toLogRequest(payload: CreateNutritionLogPayload | UpdateNutritionLogPayload) {
  return {
    ...(payload.logDate !== undefined ? { log_date: payload.logDate } : {}),
    ...(payload.mealName !== undefined ? { meal_name: payload.mealName } : {}),
    ...(payload.foodItem !== undefined ? { food_item: payload.foodItem } : {}),
    ...(payload.calories !== undefined ? { calories: payload.calories } : {}),
    ...(payload.proteinG !== undefined ? { protein_g: payload.proteinG } : {}),
    ...(payload.carbsG !== undefined ? { carbs_g: payload.carbsG } : {}),
    ...(payload.fatG !== undefined ? { fat_g: payload.fatG } : {}),
    ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
    ...(payload.unit !== undefined ? { unit: payload.unit } : {})
  };
}

function toRecalculateRequest(payload: RecalculateNutritionPayload) {
  return {
    ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
    ...(payload.activityLevel !== undefined ? { activity_level: payload.activityLevel } : {}),
    ...(payload.fitnessGoal !== undefined ? { fitness_goal: payload.fitnessGoal } : {}),
    ...(payload.weightKg !== undefined ? { weight_kg: payload.weightKg } : {}),
    ...(payload.heightCm !== undefined ? { height_cm: payload.heightCm } : {})
  };
}

function mapDailySummary(record: DailyNutritionSummaryApiRecord): DailyNutritionSummaryRecord {
  return {
    coaching: (record.coaching ?? []).map((insight) => ({
      id: insight.id,
      message: insight.message,
      priority: insight.priority,
      reasonCodes: insight.reason_codes ?? [],
      source: insight.source,
      title: insight.title
    })),
    date: record.date,
    logged: mapMacroTotals(record.logged),
    macroTargetId: record.macro_target_id,
    remaining: record.remaining ? mapMacroTotals(record.remaining) : null,
    target: record.target ? mapMacroTotals(record.target) : null
  };
}

export function createNutritionApi(transport: ApiTransport) {
  return {
    async getActiveProfile<T>() {
      try {
        const data = await unwrapResponse<ActiveTdeeApiRecord>(
          transport.get("/nutrition/tdee"),
          "Unable to load nutrition target."
        );
        return {
          tdee: mapTdeeRecord(data.tdee),
          macros: mapMacroTargetRecord(data.macros)
        } as T;
      } catch (error) {
        const apiError = toApiClientError(error, "Unable to load nutrition target.");
        if (apiError.status === 404) {
          return null as T;
        }
        throw apiError;
      }
    },
    async listTdeeHistory<T>(params?: NutritionHistoryParams) {
      const result = await unwrapPaginatedResponse<TdeeApiRecord>(
        transport.get("/nutrition/tdee/history", {
          params: {
            ...(params?.page !== undefined ? { page: params.page } : {}),
            ...(params?.limit !== undefined ? { limit: params.limit } : {})
          }
        }),
        "Unable to load nutrition history."
      );
      return {
        ...result,
        data: result.data.map((record) => mapTdeeRecord(record))
      } as PaginatedResult<T>;
    },
    async recalculate<T>(payload: RecalculateNutritionPayload) {
      const data = await unwrapResponse<ActiveTdeeApiRecord>(
        transport.post("/nutrition/tdee/recalculate", toRecalculateRequest(payload)),
        "Unable to recalculate nutrition target."
      );
      return {
        tdee: mapTdeeRecord(data.tdee),
        macros: mapMacroTargetRecord(data.macros)
      } as T;
    },
    async listLogs<T>(params?: NutritionLogListParams) {
      const result = await unwrapPaginatedResponse<NutritionLogApiRecord>(
        transport.get("/nutrition/logs", {
          params: {
            ...(params?.page !== undefined ? { page: params.page } : {}),
            ...(params?.limit !== undefined ? { limit: params.limit } : {}),
            ...(params?.startDate ? { start_date: params.startDate } : {}),
            ...(params?.endDate ? { end_date: params.endDate } : {})
          }
        }),
        "Unable to load nutrition logs."
      );
      return {
        ...result,
        data: result.data.map((record) => mapNutritionLog(record))
      } as PaginatedResult<T>;
    },
    async createLog<T>(payload: CreateNutritionLogPayload) {
      const record = await unwrapResponse<NutritionLogApiRecord>(
        transport.post("/nutrition/logs", toLogRequest(payload)),
        "Unable to create nutrition log."
      );
      return mapNutritionLog(record) as T;
    },
    async updateLog<T>(id: string, payload: UpdateNutritionLogPayload) {
      const record = await unwrapResponse<NutritionLogApiRecord>(
        transport.patch(`/nutrition/logs/${id}`, toLogRequest(payload)),
        "Unable to update nutrition log."
      );
      return mapNutritionLog(record) as T;
    },
    deleteLog(id: string) {
      return unwrapVoidResponse(
        transport.delete(`/nutrition/logs/${id}`),
        "Unable to delete nutrition log."
      );
    },
    async getDailySummary<T>(date: string) {
      const record = await unwrapResponse<DailyNutritionSummaryApiRecord>(
        transport.get("/nutrition/daily-summary", { params: { date } }),
        "Unable to load daily nutrition summary."
      );
      return mapDailySummary(record) as T;
    }
  };
}

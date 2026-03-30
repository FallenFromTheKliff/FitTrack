import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExerciseCategory } from '@prisma/client';

import type { BusinessAnalyticsGroundingPayload } from '../analytics/analytics.types';

export type GeneratePlanUserContext = {
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  activity_level: string;
  fitness_goal: string;
};

export type GeneratePlanInput = {
  userContext: GeneratePlanUserContext;
  planInput: {
    duration_weeks: number;
    days_per_week: number;
    preferences?: string | null;
  };
  allowedExercises: Array<{
    name: string;
    muscle_group: string;
    category: ExerciseCategory;
  }>;
};

export type CalculateTdeeInput = {
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  activity_level: string;
  fitness_goal: string;
};

export type ChatMessageInput = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatSessionContextInput = {
  session_id: string;
  context_type: string;
};

export type ChatUserContextInput = {
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  fitness_goal: string | null;
};

export type AIChatInput = {
  messages: ChatMessageInput[];
  userContext: ChatUserContextInput;
  sessionContext: ChatSessionContextInput;
};

export type GymChatOperatingHoursInput = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  label?: string | null;
};

export type GymChatSpecialScheduleInput = {
  starts_on: string;
  ends_on: string;
  opens_at?: string | null;
  closes_at?: string | null;
  is_closed: boolean;
  reason: string;
  pricing_note?: string | null;
};

export type GymChatPromotionInput = {
  title: string;
  description: string;
  promo_code?: string | null;
  starts_at: string;
  ends_at: string;
  pricing_note?: string | null;
};

export type GymChatFaqInput = {
  category: string;
  question: string;
  answer: string;
  keywords?: string[] | null;
};

export type GymChatMembershipPlanInput = {
  name: string;
  price: string;
  duration_days: number;
  description?: string | null;
};

export type GymChatSessionHistoryInput = {
  role: 'user' | 'assistant';
  content: string;
};

export type GymChatUserContextInput = {
  first_name?: string | null;
  role: string;
  active_membership?: boolean | null;
};

export type GymChatGroundingInput = {
  operating_hours: GymChatOperatingHoursInput[];
  special_schedules: GymChatSpecialScheduleInput[];
  promotions: GymChatPromotionInput[];
  faqs: GymChatFaqInput[];
  membership_plans: GymChatMembershipPlanInput[];
  session_history: GymChatSessionHistoryInput[];
  user_context?: GymChatUserContextInput | null;
};

export type GymChatPolicyInput = {
  gymOnly: true;
  refuseOutOfScope: true;
};

export type GymChatInput = {
  sessionId: string;
  message: string;
  grounding: GymChatGroundingInput;
  policy: GymChatPolicyInput;
};

export type GymChatResponse = {
  reply: string;
  out_of_scope: boolean;
  sources: string[];
  follow_up_suggestions: string[];
  model_used?: string | null;
  token_count?: number | null;
};

export type BusinessAnalyticsInsightRequest = {
  grounding: BusinessAnalyticsGroundingPayload;
};

export type BusinessAnalyticsInsightResponse = {
  summary: string;
  highlights: string[];
  risks: string[];
  opportunities: string[];
  anomaly_flags: string[];
  recommended_actions: string[];
  model_used?: string | null;
  token_count?: number | null;
};

type AiHealthResponse = {
  status?: string;
};

export type AiGeneratedExercise = {
  name: string;
  sets: number;
  reps?: number | null;
  duration_seconds?: number | null;
  rest_seconds?: number | null;
  weight_kg_target?: number | null;
  order_index?: number | null;
  notes?: string | null;
};

export type AiGeneratedDay = {
  day_of_week: number;
  focus_label?: string | null;
  notes?: string | null;
  exercises: AiGeneratedExercise[];
};

export type AiGeneratedWeek = {
  week_number: number;
  days: AiGeneratedDay[];
};

export type AiGeneratePlanResponse = {
  weeks: AiGeneratedWeek[];
  model_used?: string | null;
  token_count?: number | null;
};

export type PoseAnalyzeResponse = {
  rep_event: boolean;
  confidence: number;
  exercise_class: string;
  rep_count_delta?: number;
  matched_profile_id?: string | null;
  subject_locked?: boolean;
  subject_lock_confidence?: number;
  phase?: string;
  form_feedback?: string[];
};

export type PoseBootstrapInput = {
  poseSessionId: string;
  exerciseHint: string | null;
  starterCatalog: string[];
  candidateProfiles: Array<{
    id: string;
    canonical_name: string;
    profile_kind: 'seed' | 'learned';
    landmark_signature: Record<string, unknown>;
    angle_signature: Record<string, unknown>;
    rep_rules?: Record<string, unknown> | null;
  }>;
};

export type PoseBootstrapResponse = {
  status: 'ready';
  accepted_fps: number;
  subject_lock_mode: 'single_subject';
};

export type PoseFinalizeInput = {
  poseSessionId: string;
};

export type PoseFinalizeResponse = {
  detected_exercise_name: string | null;
  matched_profile_id: string | null;
  classification_confidence: number | null;
  subject_lock_confidence: number | null;
  analysis_summary: {
    reps_detected: number;
    form_feedback: string[];
    average_confidence: number | null;
    dominant_joint_angles: Record<string, number>;
  };
  learned_profile?: {
    canonical_name: string;
    landmark_signature: Record<string, unknown>;
    angle_signature: Record<string, unknown>;
    rep_rules?: Record<string, unknown> | null;
  };
};

export type AiCalculateTdeeResponse = {
  bmr: number;
  tdee: number;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type AIChatAction =
  | 'ADJUST_TDEE'
  | 'GENERATE_PLAN'
  | 'LOG_NUTRITION'
  | 'NONE';

export type AIChatResponse = {
  content: string;
  action: string;
  params?: Record<string, unknown> | null;
  model_used?: string | null;
  token_count?: number | null;
};

@Injectable()
export class AiPythonClientService {
  constructor(private readonly config: ConfigService) {}

  async assertHealthy(): Promise<void> {
    const response = await this.performRequest('/health', { method: 'GET' });

    if (!response.ok) {
      throw this.buildUnavailableException(
        'AI health checks are currently failing.',
      );
    }

    const payload = (await response.json()) as AiHealthResponse;

    if (payload.status !== 'ok') {
      throw this.buildUnavailableException(
        'AI health checks are currently failing.',
      );
    }
  }

  async generatePlan(
    input: GeneratePlanInput,
  ): Promise<AiGeneratePlanResponse> {
    const response = await this.performRequest('/generate-plan', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        user_context: input.userContext,
        plan_input: input.planInput,
        allowed_exercises: input.allowedExercises,
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'AI Plan Generation Failed',
          status: 502,
          detail: 'The AI plan service rejected the training-plan request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as AiGeneratePlanResponse;

    if (!Array.isArray(payload.weeks)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid AI Plan Response',
          status: 502,
          detail:
            'The AI plan service returned an invalid training-plan payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async calculateTdee(
    input: CalculateTdeeInput,
  ): Promise<AiCalculateTdeeResponse> {
    const response = await this.performRequest('/calculate-tdee', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'TDEE Calculation Failed',
          status: 502,
          detail: 'The AI nutrition service rejected the TDEE request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as AiCalculateTdeeResponse;

    if (!this.isValidTdeePayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid TDEE Calculation Response',
          status: 502,
          detail: 'The AI nutrition service returned an invalid TDEE payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async chat(input: AIChatInput): Promise<AIChatResponse> {
    const response = await this.performRequest('/chat', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: input.messages,
        user_context: input.userContext,
        session_context: input.sessionContext,
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'AI Chat Failed',
          status: 502,
          detail: 'The AI chat service rejected the chat request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as AIChatResponse;

    if (!this.isValidChatPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid AI Chat Response',
          status: 502,
          detail: 'The AI chat service returned an invalid chat payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async chatGym(input: GymChatInput): Promise<GymChatResponse> {
    const response = await this.performRequest('/chat/gym', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        session_id: input.sessionId,
        message: input.message,
        grounding: input.grounding,
        policy: {
          gym_only: input.policy.gymOnly,
          refuse_out_of_scope: input.policy.refuseOutOfScope,
        },
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Gym Chat Failed',
          status: 502,
          detail: 'The AI gym-chat service rejected the grounded chat request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as GymChatResponse;

    if (!this.isValidGymChatPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Gym Chat Response',
          status: 502,
          detail:
            'The AI gym-chat service returned an invalid grounded chat payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async generateBusinessInsight(
    input: BusinessAnalyticsInsightRequest,
  ): Promise<BusinessAnalyticsInsightResponse> {
    const response = await this.performRequest(
      '/analytics/insights',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      },
      {
        unavailableDetail:
          'The AI business-insight service is unavailable right now.',
        missingConfigDetail:
          'AI business insight generation is not configured.',
      },
    );

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Business Insight Generation Failed',
          status: 502,
          detail:
            'The AI business-insight service rejected the business-analytics request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as BusinessAnalyticsInsightResponse;

    if (!this.isValidBusinessInsightPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Business Insight Response',
          status: 502,
          detail:
            'The AI business-insight service returned an invalid insight payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async analyzePoseFrame(input: {
    poseSessionId: string;
    frameBase64: string;
  }): Promise<PoseAnalyzeResponse> {
    const response = await this.performRequest('/pose/analyze', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        pose_session_id: input.poseSessionId,
        frame_b64: input.frameBase64,
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Pose Analysis Failed',
          status: 502,
          detail: 'The AI pose-analysis service rejected the frame request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as PoseAnalyzeResponse;

    if (!this.isValidPoseAnalyzePayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Pose Analysis Response',
          status: 502,
          detail: 'The AI pose-analysis service returned an invalid payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async bootstrapPoseSession(
    input: PoseBootstrapInput,
  ): Promise<PoseBootstrapResponse> {
    const response = await this.performRequest('/pose/session/bootstrap', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        pose_session_id: input.poseSessionId,
        exercise_hint: input.exerciseHint,
        starter_catalog: input.starterCatalog,
        candidate_profiles: input.candidateProfiles,
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Pose Session Bootstrap Failed',
          status: 502,
          detail:
            'The AI pose-analysis service rejected the session bootstrap request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as PoseBootstrapResponse;

    if (!this.isValidPoseBootstrapPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Pose Session Bootstrap Response',
          status: 502,
          detail:
            'The AI pose-analysis service returned an invalid bootstrap payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async finalizePoseSession(
    input: PoseFinalizeInput,
  ): Promise<PoseFinalizeResponse> {
    const response = await this.performRequest('/pose/session/finalize', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        pose_session_id: input.poseSessionId,
      }),
    });

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Pose Session Finalize Failed',
          status: 502,
          detail:
            'The AI pose-analysis service rejected the session finalize request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as PoseFinalizeResponse;

    if (!this.isValidPoseFinalizePayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Pose Session Finalize Response',
          status: 502,
          detail:
            'The AI pose-analysis service returned an invalid finalize payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  private async performRequest(
    path: string,
    init: RequestInit,
    options?: {
      unavailableDetail?: string;
      missingConfigDetail?: string;
    },
  ): Promise<Response> {
    const settings = this.getRequiredSettings(options?.missingConfigDetail);
    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}${path}`;

    try {
      return await fetch(endpoint, {
        ...init,
        signal: AbortSignal.timeout(settings.requestTimeoutMs),
      });
    } catch {
      throw this.buildUnavailableException(
        options?.unavailableDetail ??
          'The AI plan service is unavailable right now.',
      );
    }
  }

  private getRequiredSettings(missingConfigDetail?: string): {
    apiBaseUrl: string;
    requestTimeoutMs: number;
  } {
    const apiBaseUrl = this.config.get<string>('ai.apiBaseUrl', '');
    const requestTimeoutMs = this.config.get<number>(
      'ai.requestTimeoutMs',
      10000,
    );

    if (!apiBaseUrl) {
      throw this.buildUnavailableException(
        missingConfigDetail ?? 'AI plan generation is not configured.',
      );
    }

    return {
      apiBaseUrl,
      requestTimeoutMs,
    };
  }

  private buildUnavailableException(
    detail: string,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException({
      type: 'SERVICE_UNAVAILABLE',
      title: 'AI Service Unavailable',
      status: 503,
      detail,
    });
  }

  private isValidTdeePayload(
    payload: AiCalculateTdeeResponse,
  ): payload is AiCalculateTdeeResponse {
    return [
      payload.bmr,
      payload.tdee,
      payload.target_calories,
      payload.protein_g,
      payload.carbs_g,
      payload.fat_g,
    ].every(
      (value) =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0,
    );
  }

  private isValidChatPayload(
    payload: AIChatResponse,
  ): payload is AIChatResponse {
    return (
      typeof payload.content === 'string' &&
      payload.content.trim().length > 0 &&
      typeof payload.action === 'string' &&
      payload.action.trim().length > 0 &&
      (payload.params === undefined ||
        payload.params === null ||
        typeof payload.params === 'object')
    );
  }

  private isValidGymChatPayload(
    payload: GymChatResponse,
  ): payload is GymChatResponse {
    return (
      typeof payload.reply === 'string' &&
      payload.reply.trim().length > 0 &&
      typeof payload.out_of_scope === 'boolean' &&
      this.isStringArray(payload.sources) &&
      this.isStringArray(payload.follow_up_suggestions) &&
      (payload.model_used === undefined ||
        payload.model_used === null ||
        typeof payload.model_used === 'string') &&
      (payload.token_count === undefined ||
        payload.token_count === null ||
        (Number.isInteger(payload.token_count) && payload.token_count >= 0))
    );
  }

  private isValidBusinessInsightPayload(
    payload: BusinessAnalyticsInsightResponse,
  ): payload is BusinessAnalyticsInsightResponse {
    return (
      typeof payload.summary === 'string' &&
      payload.summary.trim().length > 0 &&
      this.isStringArray(payload.highlights) &&
      this.isStringArray(payload.risks) &&
      this.isStringArray(payload.opportunities) &&
      this.isStringArray(payload.anomaly_flags) &&
      this.isStringArray(payload.recommended_actions) &&
      (payload.model_used === undefined ||
        payload.model_used === null ||
        typeof payload.model_used === 'string') &&
      (payload.token_count === undefined ||
        payload.token_count === null ||
        (Number.isInteger(payload.token_count) && payload.token_count >= 0))
    );
  }

  private isValidPoseAnalyzePayload(
    payload: PoseAnalyzeResponse,
  ): payload is PoseAnalyzeResponse {
    return (
      typeof payload.rep_event === 'boolean' &&
      typeof payload.confidence === 'number' &&
      Number.isFinite(payload.confidence) &&
      typeof payload.exercise_class === 'string' &&
      payload.exercise_class.trim().length > 0 &&
      (payload.rep_count_delta === undefined ||
        (Number.isInteger(payload.rep_count_delta) &&
          payload.rep_count_delta >= 0)) &&
      (payload.matched_profile_id === undefined ||
        payload.matched_profile_id === null ||
        typeof payload.matched_profile_id === 'string') &&
      (payload.subject_locked === undefined ||
        typeof payload.subject_locked === 'boolean') &&
      (payload.subject_lock_confidence === undefined ||
        (typeof payload.subject_lock_confidence === 'number' &&
          Number.isFinite(payload.subject_lock_confidence))) &&
      (payload.phase === undefined || typeof payload.phase === 'string') &&
      (payload.form_feedback === undefined ||
        this.isStringArray(payload.form_feedback))
    );
  }

  private isValidPoseBootstrapPayload(
    payload: PoseBootstrapResponse,
  ): payload is PoseBootstrapResponse {
    return (
      payload.status === 'ready' &&
      Number.isInteger(payload.accepted_fps) &&
      payload.accepted_fps > 0 &&
      payload.subject_lock_mode === 'single_subject'
    );
  }

  private isValidPoseFinalizePayload(
    payload: PoseFinalizeResponse,
  ): payload is PoseFinalizeResponse {
    if (
      (payload.detected_exercise_name !== null &&
        typeof payload.detected_exercise_name !== 'string') ||
      (payload.matched_profile_id !== null &&
        typeof payload.matched_profile_id !== 'string') ||
      !this.isNullableFiniteNumber(payload.classification_confidence) ||
      !this.isNullableFiniteNumber(payload.subject_lock_confidence) ||
      !this.isValidPoseAnalysisSummary(payload.analysis_summary)
    ) {
      return false;
    }

    return (
      payload.learned_profile === undefined ||
      payload.learned_profile === null ||
      this.isValidLearnedProfile(payload.learned_profile)
    );
  }

  private isValidPoseAnalysisSummary(
    value: PoseFinalizeResponse['analysis_summary'],
  ): boolean {
    return (
      this.isObject(value) &&
      Number.isInteger(value.reps_detected) &&
      value.reps_detected >= 0 &&
      this.isStringArray(value.form_feedback) &&
      this.isNullableFiniteNumber(value.average_confidence) &&
      this.isNumericRecord(value.dominant_joint_angles)
    );
  }

  private isValidLearnedProfile(
    value: NonNullable<PoseFinalizeResponse['learned_profile']>,
  ): boolean {
    return (
      this.isObject(value) &&
      typeof value.canonical_name === 'string' &&
      value.canonical_name.trim().length > 0 &&
      this.isObject(value.landmark_signature) &&
      this.isObject(value.angle_signature) &&
      (value.rep_rules === undefined ||
        value.rep_rules === null ||
        this.isObject(value.rep_rules))
    );
  }

  private isNullableFiniteNumber(value: unknown): value is number | null {
    return (
      value === null || (typeof value === 'number' && Number.isFinite(value))
    );
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
  }

  private isNumericRecord(value: unknown): value is Record<string, number> {
    return (
      this.isObject(value) &&
      Object.values(value).every(
        (item) => typeof item === 'number' && Number.isFinite(item),
      )
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

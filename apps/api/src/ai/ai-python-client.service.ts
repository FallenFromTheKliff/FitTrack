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

export type AssistantScope = 'admin_business' | 'member_fitness';

export type ChatSessionContextInput = {
  session_id: string;
  context_type: string;
  assistant_scope: AssistantScope;
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
  confidence: number;
  exercise_class: string | null;
  matched_profile_id?: string | null;
  movement_contract?: {
    exercise: string;
    dominant_joint: 'elbow' | 'shoulder' | 'hip' | 'knee';
    rep_thresholds: {
      down: { angle: number; tolerance: number };
      up: { angle: number; tolerance: number };
    };
    secondary_check: string;
    oscillating_joints: string[];
    rep_model?:
      | 'bilateral'
      | 'unilateral_left'
      | 'unilateral_right'
      | 'alternating'
      | 'static_hold'
      | 'unknown';
    required_sides?: 'both' | 'left' | 'right' | 'either' | 'alternating';
    primary_joints?: string[];
    secondary_joints?: string[];
    phase_order?: string[];
    spatial_requirements?: {
      body_y_travel_min?: number | null;
      hip_y_travel_min?: number | null;
      shoulder_y_travel_min?: number | null;
      shoulder_hip_travel_min?: number | null;
      body_x_drift_max?: number | null;
      wrist_anchor_drift_max?: number | null;
      torso_slope_min_deg?: number | null;
      torso_slope_max_deg?: number | null;
      body_line_tolerance?: number | null;
      left_right_symmetry_tolerance?: number | null;
      phase_sync_tolerance_ms?: number | null;
    } | null;
    no_count_conditions?: string[];
    degraded_conditions?: string[];
  } | null;
  subject_locked?: boolean;
  subject_lock_confidence?: number;
  classification_source?: 'preset' | 'classifier' | 'user_confirmed';
  needs_confirmation?: boolean;
  processing_mode?: 'legacy_frame' | 'sequence';
  rep_event?: boolean;
  rep_count_delta?: number;
  rep_count_total?: number;
  phase?: string | null;
  keypoints?: Array<{
    visibility: number;
    x: number;
    y: number;
    z: number;
  }> | null;
  candidate_exercises?: string[];
  form_feedback?: string[];
  learned_profile?: {
    canonical_name: string;
    landmark_signature: Record<string, unknown>;
    angle_signature: Record<string, unknown>;
    orientation_signature: Record<string, unknown>;
    movement_pattern: Record<string, unknown>;
    visibility_pattern: Record<string, unknown>;
    dominant_joint?: 'elbow' | 'shoulder' | 'hip' | 'knee' | null;
    tolerance?: number | null;
    rep_thresholds?: Record<string, unknown> | null;
    rep_rules?: Record<string, unknown> | null;
  } | null;
};

export type PoseAnalyzeSequenceInput = {
  poseSessionId: string;
  landmarkSchema: 'mediapipe_pose_v1';
  exerciseHint?: string | null;
  cameraFacingMode?: 'user' | 'environment';
  frames: Array<{
    captured_at_ms: number;
    keypoints: Array<{
      x: number;
      y: number;
      z: number;
      visibility: number;
    }>;
  }>;
  signals: {
    angles: Array<{
      captured_at_ms: number;
      elbow?: number | null;
      shoulder?: number | null;
      hip?: number | null;
      knee?: number | null;
      left_elbow?: number | null;
      right_elbow?: number | null;
      left_shoulder?: number | null;
      right_shoulder?: number | null;
      left_hip?: number | null;
      right_hip?: number | null;
      left_knee?: number | null;
      right_knee?: number | null;
    }>;
    orientation: {
      body_orientation: string;
      torso_slope_deg: number;
      vector: { x: number; y: number };
    };
    visibility: {
      average_visibility: number;
      feet_visibility: number;
      low_confidence_landmarks: string[];
      reliable_frame_count: number;
      wrist_visibility: number;
      left_arm_visibility?: number | null;
      right_arm_visibility?: number | null;
    };
    hip: {
      average_y: number;
      range_y: number;
      range_x?: number | null;
      stable: boolean;
    };
    temporal: {
      amplitudes: Record<string, number>;
      oscillating_joints: string[];
      phase_sync_ms?: number | null;
    };
  };
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
    orientation_signature: Record<string, unknown>;
    movement_pattern: Record<string, unknown>;
    visibility_pattern: Record<string, unknown>;
    dominant_joint?: 'elbow' | 'shoulder' | 'hip' | 'knee' | null;
    tolerance?: number | null;
    rep_thresholds?: Record<string, unknown> | null;
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
    orientation_signature: Record<string, unknown>;
    movement_pattern: Record<string, unknown>;
    visibility_pattern: Record<string, unknown>;
    dominant_joint?: 'elbow' | 'shoulder' | 'hip' | 'knee' | null;
    tolerance?: number | null;
    rep_thresholds?: Record<string, unknown> | null;
    rep_rules?: Record<string, unknown> | null;
  };
};

export type AiEquipmentDetectionBox = {
  confidence: number | null;
  height: number | null;
  label: string | null;
  width: number | null;
  x: number | null;
  y: number | null;
};

export type AiEquipmentDetectInput = {
  cameraFacingMode?: 'user' | 'environment' | null;
  exerciseHint?: string | null;
  frameBase64: string;
};

export type AiEquipmentDetectResponse = {
  equipment_confidence: number | null;
  equipment_conflicts: string[];
  equipment_context: string | null;
  equipment_detections: AiEquipmentDetectionBox[];
  equipment_family?: string | null;
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

export type ExerciseDraftProposalInput = {
  category?: ExerciseCategory;
  description?: string | null;
  evidence?: Record<string, unknown> | null;
  hand_shape_profile?: Record<string, unknown> | null;
  instructions?: string | null;
  movement_profile?: Record<string, unknown> | null;
  muscle_group?: string | null;
  muscle_targets?: unknown[] | null;
  pose_session_id?: string | null;
  proposed_name?: string | null;
  summary?: string | null;
};

export type ExerciseDraftProposalAIResponse = {
  category: ExerciseCategory;
  confidence: number;
  description: string;
  evidence: Record<string, unknown>;
  hand_shape_profile: Record<string, unknown>;
  instructions: string;
  movement_profile: Record<string, unknown>;
  muscle_group: string;
  muscle_targets: unknown[];
  model_used?: string | null;
  proposal_source: 'ai';
  proposed_name: string;
  review_warnings: string[];
  summary: string;
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
    const response = await this.performRequest(
      '/generate-plan',
      {
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
      },
      {
        unavailableDetail:
          'BrodigyAI plan generation is unavailable right now.',
        missingConfigDetail: 'AI plan generation is not configured.',
        timeoutDetail:
          'BrodigyAI timed out while generating a training plan. Please try again.',
      },
    );

    if (!response.ok) {
      await this.throwHttpExceptionFromResponse(response, {
        title: 'AI Plan Generation Failed',
        detail: 'The AI plan service rejected the generation request.',
      });
    }

    const payload = (await response.json()) as AiGeneratePlanResponse;

    if (!Array.isArray(payload.weeks)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid AI Plan Response',
          status: 502,
          detail: 'The AI plan service returned an invalid payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async calculateTdee(
    input: CalculateTdeeInput,
  ): Promise<AiCalculateTdeeResponse> {
    let response: Response;

    try {
      response = await this.performRequest('/calculate-tdee', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.calculateTdeeLocally(input);
      }

      throw error;
    }

    if (!response.ok) {
      return this.calculateTdeeLocally(input);
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

  private calculateTdeeLocally(
    input: CalculateTdeeInput,
  ): AiCalculateTdeeResponse {
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    };
    const goalCalorieAdjustments: Record<string, number> = {
      bulking: 300,
      cutting: -500,
      maintenance: 0,
      sport_specific: 150,
    };
    const proteinPerKg: Record<string, number> = {
      bulking: 2.0,
      cutting: 2.2,
      maintenance: 1.8,
      sport_specific: 2.0,
    };
    const fatRatio: Record<string, number> = {
      bulking: 0.25,
      cutting: 0.25,
      maintenance: 0.25,
      sport_specific: 0.27,
    };

    const bmrBase =
      10 * input.weight_kg + 6.25 * input.height_cm - 5 * input.age;
    const bmr =
      input.gender === 'male'
        ? bmrBase + 5
        : input.gender === 'female'
          ? bmrBase - 161
          : bmrBase - 78;
    const tdee = bmr * (activityMultipliers[input.activity_level] ?? 1.2);
    const targetCalories = Math.max(
      1200,
      Math.round(tdee + (goalCalorieAdjustments[input.fitness_goal] ?? 0)),
    );
    const proteinG = Math.max(
      0,
      Math.round(input.weight_kg * (proteinPerKg[input.fitness_goal] ?? 1.8)),
    );
    const fatG = Math.max(
      0,
      Math.round((targetCalories * (fatRatio[input.fitness_goal] ?? 0.25)) / 9),
    );
    const carbsG = Math.max(
      0,
      Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4),
    );

    return {
      bmr: Number(bmr.toFixed(2)),
      tdee: Number(tdee.toFixed(2)),
      target_calories: targetCalories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
    };
  }

  async chat(input: AIChatInput): Promise<AIChatResponse> {
    const response = await this.performRequest(
      '/chat',
      {
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
      },
      {
        unavailableDetail:
          'BrodigyAI is unavailable right now. Please try again shortly.',
        missingConfigDetail: 'BrodigyAI chat is not configured.',
        timeoutDetail:
          'BrodigyAI timed out while waiting for the AI service. Please try again.',
      },
    );

    if (!response.ok) {
      await this.throwHttpExceptionFromResponse(response, {
        title: 'AI Chat Failed',
        detail: 'The AI chat service rejected the chat request.',
      });
    }

    const payload = (await response.json()) as AIChatResponse;

    if (!this.isValidChatPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid AI Chat Response',
          status: 502,
          detail: 'The AI chat service returned an invalid payload.',
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
        timeoutDetail:
          'The AI business-insight service took too long to respond.',
        timeoutMs: 12000,
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

  async generateExerciseDraftProposal(
    input: ExerciseDraftProposalInput,
  ): Promise<ExerciseDraftProposalAIResponse> {
    const response = await this.performRequest(
      '/exercise-drafts/propose',
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
          'The AI exercise-draft service is unavailable right now.',
        missingConfigDetail: 'AI exercise-draft generation is not configured.',
      },
    );

    if (!response.ok) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Exercise Draft Generation Failed',
          status: 502,
          detail:
            'The AI exercise-draft service rejected the draft request.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const payload = (await response.json()) as ExerciseDraftProposalAIResponse;

    if (!this.isValidExerciseDraftProposalPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Exercise Draft Response',
          status: 502,
          detail:
            'The AI exercise-draft service returned an invalid proposal payload.',
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

  async detectEquipment(
    input: AiEquipmentDetectInput,
  ): Promise<AiEquipmentDetectResponse> {
    const response = await this.performRequest(
      '/equipment/detect',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...(input.cameraFacingMode
            ? { camera_facing_mode: input.cameraFacingMode }
            : {}),
          ...(input.exerciseHint !== undefined
            ? { exercise_hint: input.exerciseHint }
            : {}),
          frame_b64: input.frameBase64,
        }),
      },
      {
        unavailableDetail:
          'Local equipment detection is unavailable right now.',
        missingConfigDetail: 'Local equipment detection is not configured.',
        timeoutDetail:
          'Local equipment detection timed out while analyzing the frame.',
      },
    );

    if (!response.ok) {
      await this.throwHttpExceptionFromResponse(response, {
        title: 'Equipment Detection Failed',
        detail: 'The AI equipment service rejected the frame request.',
      });
    }

    const payload = (await response.json()) as AiEquipmentDetectResponse;

    if (!this.isValidEquipmentDetectPayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Equipment Detection Response',
          status: 502,
          detail:
            'The AI equipment service returned an invalid detection payload.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return payload;
  }

  async analyzePoseSequence(
    input: PoseAnalyzeSequenceInput,
  ): Promise<PoseAnalyzeResponse> {
    const fullSequenceBody = {
      pose_session_id: input.poseSessionId,
      landmark_schema: input.landmarkSchema,
      exercise_hint: input.exerciseHint ?? null,
      camera_facing_mode: input.cameraFacingMode ?? null,
      frames: input.frames,
      signals: input.signals,
    };
    const legacySequenceBody = {
      pose_session_id: input.poseSessionId,
      landmark_schema: input.landmarkSchema,
      exercise_hint: input.exerciseHint ?? null,
      camera_facing_mode: input.cameraFacingMode ?? null,
      frames: input.frames,
    };

    let response = await this.performRequest('/pose/analyze', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(fullSequenceBody),
    });

    if (!response.ok) {
      const errorPayload = await this.readErrorPayload(response);
      const supportsLegacyFramesOnly =
        response.status === 422 &&
        errorPayload?.detail?.includes('body.signals') &&
        errorPayload.detail.includes('Extra inputs are not permitted');

      if (supportsLegacyFramesOnly) {
        response = await this.performRequest('/pose/analyze', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify(legacySequenceBody),
        });
      }

      if (!response.ok) {
        throw new HttpException(
          {
            type: 'BAD_GATEWAY',
            title: 'Pose Sequence Analysis Failed',
            status: 502,
            detail:
              'The AI pose-analysis service rejected the keypoint sequence request.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    const payload = (await response.json()) as PoseAnalyzeResponse;

    if (!this.isValidPoseAnalyzePayload(payload)) {
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Invalid Pose Sequence Analysis Response',
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
      timeoutDetail?: string;
      timeoutMs?: number;
    },
  ): Promise<Response> {
    const settings = this.getRequiredSettings(options?.missingConfigDetail);
    const endpoint = `${settings.apiBaseUrl.replace(/\/+$/, '')}${path}`;
    const requestTimeoutMs = options?.timeoutMs ?? settings.requestTimeoutMs;

    try {
      return await fetch(endpoint, {
        ...init,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      const detail =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
          ? (options?.timeoutDetail ??
            options?.unavailableDetail ??
            'The AI service timed out right now.')
          : (options?.unavailableDetail ??
            'The AI plan service is unavailable right now.');
      throw this.buildUnavailableException(detail);
    }
  }

  private async throwHttpExceptionFromResponse(
    response: Response,
    fallback: {
      detail: string;
      title: string;
    },
  ): Promise<never> {
    const payload = await this.readErrorPayload(response);
    const status = response.status >= 400 ? response.status : 502;

    throw new HttpException(
      {
        type:
          payload?.type ??
          (status >= 500 ? 'SERVICE_UNAVAILABLE' : 'BAD_GATEWAY'),
        title: payload?.title ?? fallback.title,
        status,
        detail: payload?.detail ?? fallback.detail,
      },
      status,
    );
  }

  private async readErrorPayload(response: Response): Promise<{
    detail?: string;
    title?: string;
    type?: string;
  } | null> {
    const raw = (await response.text()).trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as {
        detail?: unknown;
        title?: unknown;
        type?: unknown;
      };

      return {
        detail:
          typeof parsed.detail === 'string' && parsed.detail.trim()
            ? parsed.detail.trim()
            : undefined,
        title:
          typeof parsed.title === 'string' && parsed.title.trim()
            ? parsed.title.trim()
            : undefined,
        type:
          typeof parsed.type === 'string' && parsed.type.trim()
            ? parsed.type.trim()
            : undefined,
      };
    } catch {
      return { detail: raw };
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

  private isValidExerciseDraftProposalPayload(
    payload: ExerciseDraftProposalAIResponse,
  ): payload is ExerciseDraftProposalAIResponse {
    return (
      payload.proposal_source === 'ai' &&
      typeof payload.confidence === 'number' &&
      Number.isFinite(payload.confidence) &&
      payload.confidence >= 0 &&
      payload.confidence <= 1 &&
      typeof payload.proposed_name === 'string' &&
      payload.proposed_name.trim().length > 0 &&
      typeof payload.summary === 'string' &&
      payload.summary.trim().length > 0 &&
      typeof payload.description === 'string' &&
      payload.description.trim().length > 0 &&
      typeof payload.instructions === 'string' &&
      payload.instructions.trim().length > 0 &&
      typeof payload.muscle_group === 'string' &&
      payload.muscle_group.trim().length > 0 &&
      Array.isArray(payload.muscle_targets) &&
      typeof payload.movement_profile === 'object' &&
      payload.movement_profile !== null &&
      !Array.isArray(payload.movement_profile) &&
      typeof payload.hand_shape_profile === 'object' &&
      payload.hand_shape_profile !== null &&
      !Array.isArray(payload.hand_shape_profile) &&
      typeof payload.evidence === 'object' &&
      payload.evidence !== null &&
      !Array.isArray(payload.evidence) &&
      this.isStringArray(payload.review_warnings) &&
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
      typeof payload.confidence === 'number' &&
      Number.isFinite(payload.confidence) &&
      (payload.exercise_class === null ||
        (typeof payload.exercise_class === 'string' &&
          payload.exercise_class.trim().length > 0)) &&
      (payload.matched_profile_id === undefined ||
        payload.matched_profile_id === null ||
        typeof payload.matched_profile_id === 'string') &&
      (payload.movement_contract === undefined ||
        payload.movement_contract === null ||
        this.isValidMovementContract(payload.movement_contract)) &&
      (payload.subject_locked === undefined ||
        typeof payload.subject_locked === 'boolean') &&
      (payload.subject_lock_confidence === undefined ||
        (typeof payload.subject_lock_confidence === 'number' &&
          Number.isFinite(payload.subject_lock_confidence))) &&
      (payload.classification_source === undefined ||
        payload.classification_source === 'preset' ||
        payload.classification_source === 'classifier' ||
        payload.classification_source === 'user_confirmed') &&
      (payload.needs_confirmation === undefined ||
        typeof payload.needs_confirmation === 'boolean') &&
      (payload.processing_mode === undefined ||
        payload.processing_mode === 'legacy_frame' ||
        payload.processing_mode === 'sequence') &&
      (payload.rep_event === undefined ||
        typeof payload.rep_event === 'boolean') &&
      (payload.rep_count_delta === undefined ||
        (typeof payload.rep_count_delta === 'number' &&
          Number.isFinite(payload.rep_count_delta))) &&
      (payload.rep_count_total === undefined ||
        (typeof payload.rep_count_total === 'number' &&
          Number.isFinite(payload.rep_count_total))) &&
      (payload.phase === undefined ||
        payload.phase === null ||
        typeof payload.phase === 'string') &&
      (payload.keypoints === undefined ||
        payload.keypoints === null ||
        this.isValidPoseKeypoints(payload.keypoints)) &&
      (payload.candidate_exercises === undefined ||
        this.isStringArray(payload.candidate_exercises)) &&
      (payload.form_feedback === undefined ||
        this.isStringArray(payload.form_feedback)) &&
      (payload.learned_profile === undefined ||
        payload.learned_profile === null ||
        this.isValidLearnedProfile(payload.learned_profile))
    );
  }

  private isValidEquipmentDetectPayload(
    payload: AiEquipmentDetectResponse,
  ): payload is AiEquipmentDetectResponse {
    return (
      this.isObject(payload) &&
      this.isNullableFiniteNumber(payload.equipment_confidence) &&
      (payload.equipment_context === null ||
        typeof payload.equipment_context === 'string') &&
      this.isStringArray(payload.equipment_conflicts) &&
      Array.isArray(payload.equipment_detections) &&
      payload.equipment_detections.every((detection) =>
        this.isValidEquipmentDetectionBox(detection),
      ) &&
      (payload.equipment_family === undefined ||
        payload.equipment_family === null ||
        typeof payload.equipment_family === 'string')
    );
  }

  private isValidEquipmentDetectionBox(
    value: unknown,
  ): value is AiEquipmentDetectionBox {
    return (
      this.isObject(value) &&
      this.isNullableFiniteNumber(value.confidence) &&
      this.isNullableFiniteNumber(value.height) &&
      this.isNullableFiniteNumber(value.width) &&
      this.isNullableFiniteNumber(value.x) &&
      this.isNullableFiniteNumber(value.y) &&
      (value.label === null || typeof value.label === 'string')
    );
  }

  private isValidMovementContract(
    value: NonNullable<PoseAnalyzeResponse['movement_contract']>,
  ): boolean {
    return (
      this.isObject(value) &&
      typeof value.exercise === 'string' &&
      value.exercise.trim().length > 0 &&
      ['elbow', 'shoulder', 'hip', 'knee'].includes(value.dominant_joint) &&
      this.isObject(value.rep_thresholds) &&
      this.isObject(value.rep_thresholds.down) &&
      this.isObject(value.rep_thresholds.up) &&
      typeof value.secondary_check === 'string' &&
      this.isStringArray(value.oscillating_joints) &&
      (value.rep_model === undefined ||
        value.rep_model === 'bilateral' ||
        value.rep_model === 'unilateral_left' ||
        value.rep_model === 'unilateral_right' ||
        value.rep_model === 'alternating' ||
        value.rep_model === 'static_hold' ||
        value.rep_model === 'unknown') &&
      (value.required_sides === undefined ||
        value.required_sides === 'both' ||
        value.required_sides === 'left' ||
        value.required_sides === 'right' ||
        value.required_sides === 'either' ||
        value.required_sides === 'alternating') &&
      (value.primary_joints === undefined ||
        this.isStringArray(value.primary_joints)) &&
      (value.secondary_joints === undefined ||
        this.isStringArray(value.secondary_joints)) &&
      (value.phase_order === undefined ||
        this.isStringArray(value.phase_order)) &&
      (value.spatial_requirements === undefined ||
        value.spatial_requirements === null ||
        this.isObject(value.spatial_requirements)) &&
      (value.no_count_conditions === undefined ||
        this.isStringArray(value.no_count_conditions)) &&
      (value.degraded_conditions === undefined ||
        this.isStringArray(value.degraded_conditions))
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
      this.isObject(value.orientation_signature) &&
      this.isObject(value.movement_pattern) &&
      this.isObject(value.visibility_pattern) &&
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

  private isValidPoseKeypoints(
    value: unknown,
  ): value is NonNullable<PoseAnalyzeResponse['keypoints']> {
    return (
      Array.isArray(value) &&
      value.length === 33 &&
      value.every(
        (point) =>
          this.isObject(point) &&
          typeof point.visibility === 'number' &&
          Number.isFinite(point.visibility) &&
          typeof point.x === 'number' &&
          Number.isFinite(point.x) &&
          typeof point.y === 'number' &&
          Number.isFinite(point.y) &&
          typeof point.z === 'number' &&
          Number.isFinite(point.z),
      )
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

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ActivityLevel,
  ChatContext,
  ChatRole,
  FitnessGoal,
  Gender,
  Prisma,
  UserRole,
} from '@prisma/client';

import {
  guardAiResponseText,
  isValidAiResponseText,
} from '../../../../packages/utils/ai-response-text';
import { PaginatedResult } from '../common/base-repository/base-repository';
import type { ActiveExerciseGenerationRecord } from '../fitness/exercise/exercise.repository';
import { ExerciseService } from '../fitness/exercise/exercise.service';
import { TrainingPlanDetailResponseDTO } from '../fitness/training-plan/dto/training-plan.dto';
import type { TrainingPlanScheduleDayWriteInput } from '../fitness/training-plan/training-plan.repository';
import { TrainingPlanService } from '../fitness/training-plan/training-plan.service';
import { WorkoutSessionService } from '../fitness/session/session.service';
import {
  ActiveTdeeResponseDTO,
  LogNutritionDTO,
  NutritionLogResponseDTO,
  RecalculateTdeeDTO,
} from '../nutrition/dto/nutrition.dto';
import { NutritionService } from '../nutrition/nutrition.service';
import { PaginationDTO } from '../user/dto/user-dto';
import { UserService } from '../user/user.service';
import {
  AI_SESSION_ARCHIVED_EVENT,
  type AiSessionArchivedEvent,
} from './events/ai-session-archived.event';
import {
  AiChatMessageRecord,
  AiChatMessageRepository,
} from './ai-chat-message.repository';
import {
  AiChatSessionRecord,
  AiChatSessionRepository,
} from './ai-chat-session.repository';
import { AiInteractionLogRepository } from './ai-interaction-log.repository';
import {
  AIChatAction,
  AIChatInput,
  AIChatResponse,
  AssistantScope,
  AiGeneratePlanResponse,
  AiGeneratedDay,
  AiGeneratedExercise,
  AiGeneratedWeek,
  AiPythonClientService,
  GeneratePlanInput,
} from './ai-python-client.service';
import { AIChatDTO, AIChatResponseDTO } from './dto/chat.dto';
import {
  AiChatMessageResponseDTO,
  AiChatSessionResponseDTO,
} from './dto/chat-session.dto';
import { GeneratePlanDTO } from './dto/generate-plan.dto';
import type { GymProfileResponseDTO } from './dto/gym-knowledge.dto';
import { GymKnowledgeService } from './gym-knowledge.service';

type ProfileAggregate = {
  profile: {
    date_of_birth: Date | null;
    gender: Gender | null;
    weight_kg: Prisma.Decimal | null;
    height_cm: Prisma.Decimal | null;
    activity_level: ActivityLevel | null;
    fitness_goal: FitnessGoal | null;
  };
};

type RequiredUserContext = GeneratePlanInput['userContext'] & {
  fitnessGoal: FitnessGoal;
};

type ChatProfileAggregate = {
  profile: {
    date_of_birth: Date | null;
    gender: Gender | null;
    weight_kg: Prisma.Decimal | null;
    height_cm: Prisma.Decimal | null;
    activity_level: ActivityLevel | null;
    fitness_goal: FitnessGoal | null;
  };
};

type ChatSessionResolution = {
  session: AiChatSessionRecord;
  seedTitle: boolean;
};

type ActionExecutionResult = {
  actionTriggered: string | null;
  actionResult:
    | ActiveTdeeResponseDTO
    | NutritionLogResponseDTO
    | TrainingPlanDetailResponseDTO
    | null;
};

type ChatPromptUserContext = AIChatInput['userContext'];

type RequiredPromptUserContext = {
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  activity_level: string;
  fitness_goal: string;
  fitnessGoal: FitnessGoal;
};

type ChatPromptBlueprint = {
  version: 'v1';
  domain: 'chat';
  persona: string;
  objective: string;
  responseStyle: string[];
  guardrails: string[];
  actionPolicy: {
    allowedActions: AIChatAction[];
    triggerNotes: string[];
    safetyNotes: string[];
  };
  context: {
    sessionId: string;
    contextType: ChatContext;
    assistantScope: AssistantScope;
    recentMessageCount: number;
    latestUserMessage: string;
    userContext: ChatPromptUserContext;
    messagePurpose: string;
  };
};

type PlanPromptBlueprint = {
  version: 'v1';
  domain: 'generate-plan';
  persona: string;
  objective: string;
  responseStyle: string[];
  guardrails: string[];
  planConstraints: {
    durationWeeks: number;
    daysPerWeek: number;
    exerciseCatalogSize: number;
    allowedExerciseCatalog: Array<{
      name: string;
      muscleGroup: string;
      category: ActiveExerciseGenerationRecord['category'];
    }>;
    selectionNotes: string[];
    userContext: RequiredPromptUserContext;
    preferences: string | null;
  };
};

const SESSION_INACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CHAT_HISTORY_MESSAGES = 4;
const MAX_SESSION_TITLE_LENGTH = 80;

@Injectable()
export class AiService {
  constructor(
    private readonly userService: UserService,
    private readonly exerciseService: ExerciseService,
    private readonly trainingPlanService: TrainingPlanService,
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly nutritionService: NutritionService,
    private readonly aiClient: AiPythonClientService,
    private readonly gymKnowledgeService: GymKnowledgeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly aiChatSessionRepository: AiChatSessionRepository,
    private readonly aiChatMessageRepository: AiChatMessageRepository,
    private readonly aiInteractionLogRepository: AiInteractionLogRepository,
  ) {}

  async getMyChatSessions(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<AiChatSessionResponseDTO>> {
    const result = await this.aiChatSessionRepository.listOwnedSessions(
      userId,
      dto,
    );

    return {
      data: result.data.map((session) => this.toChatSessionResponse(session)),
      meta: result.meta,
    };
  }

  async getChatSessionById(
    userId: string,
    sessionId: string,
  ): Promise<AiChatSessionResponseDTO> {
    return this.toChatSessionResponse(
      await this.aiChatSessionRepository.findOwnedSessionByIdOrThrow(
        userId,
        sessionId,
      ),
    );
  }

  async getChatMessages(
    userId: string,
    sessionId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<AiChatMessageResponseDTO>> {
    const result = await this.aiChatMessageRepository.listOwnedSessionMessages(
      userId,
      sessionId,
      dto,
    );

    return {
      data: result.data.map((message) => this.toChatMessageResponse(message)),
      meta: result.meta,
    };
  }

  async archiveSession(userId: string, sessionId: string): Promise<void> {
    await this.aiChatSessionRepository.archiveOwnedSessionByIdOrThrow(
      userId,
      sessionId,
    );
  }

  async restoreSession(userId: string, sessionId: string): Promise<void> {
    await this.aiChatSessionRepository.restoreOwnedSessionByIdOrThrow(
      userId,
      sessionId,
    );
  }

  async chat(
    userId: string,
    actorRoleOrDto: UserRole | AIChatDTO,
    maybeDto?: AIChatDTO,
  ): Promise<AIChatResponseDTO> {
    const actorRole =
      typeof actorRoleOrDto === 'string' ? actorRoleOrDto : UserRole.member;
    const dto = typeof actorRoleOrDto === 'string' ? maybeDto : actorRoleOrDto;

    if (!dto) {
      throw this.buildValidationException(
        'Missing AI Chat Request',
        'A chat message is required.',
      );
    }

    const assistantScope = this.resolveAssistantScope(actorRole);
    const resolved = await this.resolveChatSession(userId, dto);
    const history = (
      await this.aiChatMessageRepository.listRecentMessagesBySessionId(
        resolved.session.id,
        MAX_CHAT_HISTORY_MESSAGES,
      )
    ).filter(
      (entry) =>
        entry.role !== ChatRole.assistant ||
        isValidAiResponseText(entry.content),
    );
    const [userContext, gymProfile] = await Promise.all([
      this.buildChatUserContext(userId),
      this.gymKnowledgeService.getGymProfile(),
    ]);
    const requestPayload = this.buildChatRequestPayload(
      resolved.session,
      history,
      userContext,
      gymProfile,
      dto.message,
      assistantScope,
      actorRole,
    );
    const promptBlueprint = this.buildChatPromptBlueprint(
      resolved.session,
      history,
      userContext,
      dto.message,
      assistantScope,
      actorRole,
    );
    const persistedRequestPayload = this.enrichRequestPayloadWithBlueprint(
      requestPayload,
      promptBlueprint,
    );
    const startedAt = Date.now();

    try {
      const response: AIChatResponse = await this.aiClient.chat(requestPayload);
      this.assertValidChatResponse(response);
      const latencyMs = Date.now() - startedAt;
      const { actionTriggered, actionResult } =
        await this.validateAndExecuteAction(
          userId,
          actorRole,
          response.action,
          response.params,
        );

      await this.aiChatMessageRepository.createMessagePair({
        sessionId: resolved.session.id,
        userContent: dto.message,
        assistantContent: response.content,
        actionTriggered,
      });

      await this.aiChatSessionRepository.updateSessionById(
        resolved.session.id,
        {
          lastActivityAt: new Date(),
          ...(resolved.seedTitle
            ? { title: this.seedSessionTitle(dto.message) }
            : {}),
        },
      );

      await this.recordChatInteraction({
        userId,
        sessionId: resolved.session.id,
        interactionType: 'chat',
        requestPayload: persistedRequestPayload as Prisma.InputJsonValue,
        responsePayload: response as Prisma.InputJsonValue,
        actionTriggered,
        actionResult: actionResult as unknown as Prisma.InputJsonValue,
        latencyMs,
        modelUsed: response.model_used ?? null,
        tokenCount: response.token_count ?? null,
      });

      return {
        session_id: resolved.session.id,
        reply: response.content,
        action_triggered: actionTriggered,
        action_result: actionResult,
      };
    } catch (error) {
      if (this.isInvalidChatResponseError(error)) {
        throw error;
      }
      await this.recordChatInteraction({
        userId,
        sessionId: resolved.session.id,
        interactionType: 'chat',
        requestPayload: requestPayload as Prisma.InputJsonValue,
        latencyMs: Date.now() - startedAt,
        error: this.extractErrorDetail(error),
      });

      throw error;
    }
  }

  private async recordChatInteraction(
    input: Parameters<AiInteractionLogRepository['createInteractionLog']>[0],
  ): Promise<void> {
    try {
      await this.aiInteractionLogRepository.createInteractionLog(input);
    } catch {
      // Logging must never turn a completed chat exchange into a failed request.
    }
  }

  async generatePlan(
    userId: string,
    dto: GeneratePlanDTO,
  ): Promise<TrainingPlanDetailResponseDTO> {
    const userAggregate = (await this.userService.getMyProfile(
      userId,
    )) as ProfileAggregate;
    const userContext = this.buildRequiredUserContext(userAggregate);
    const allowedExercises =
      await this.exerciseService.listActiveExercisesForGeneration();
    const recentExerciseHistory =
      await this.workoutSessionService.getRecentExerciseHistorySummary(userId);

    await this.aiClient.assertHealthy();

    const requestPayload = this.buildRequestPayload(
      userContext,
      dto,
      allowedExercises,
      recentExerciseHistory,
    );
    const promptBlueprint = this.buildPlanPromptBlueprint(
      userContext,
      dto,
      allowedExercises,
    );
    const persistedRequestPayload = this.enrichRequestPayloadWithBlueprint(
      requestPayload,
      promptBlueprint,
    );
    const startedAt = Date.now();
    const response = await this.aiClient.generatePlan(requestPayload);
    const latencyMs = Date.now() - startedAt;

    await this.aiInteractionLogRepository.createPlanGenerationLog({
      userId,
      requestPayload: persistedRequestPayload as Prisma.InputJsonValue,
      responsePayload: response as Prisma.InputJsonValue,
      latencyMs,
      modelUsed: response.model_used ?? null,
      tokenCount: response.token_count ?? null,
    });

    const schedule = this.resolveSchedule(
      response,
      allowedExercises,
      dto.duration_weeks,
      dto.days_per_week,
    );

    return this.trainingPlanService.createAiGeneratedPlan(userId, {
      goal: userContext.fitnessGoal,
      title: `AI ${this.formatGoalForTitle(userContext.fitnessGoal)} Plan`,
      durationWeeks: dto.duration_weeks,
      daysPerWeek: dto.days_per_week,
      aiGenerationPrompt: persistedRequestPayload as Prisma.InputJsonValue,
      schedule,
    });
  }

  private resolveAssistantScope(actorRole: UserRole): AssistantScope {
    if (
      actorRole === UserRole.admin ||
      actorRole === UserRole.coach ||
      actorRole === UserRole.staff
    ) {
      return 'all';
    }

    if (actorRole === UserRole.member) {
      return 'all';
    }

    throw new HttpException(
      {
        type: 'FORBIDDEN',
        title: 'BrodigyAI Access Denied',
        status: HttpStatus.FORBIDDEN,
        detail:
          'BrodigyAI is available to admins, coaches, staff, and members only.',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  private buildRequestPayload(
    userContext: RequiredUserContext,
    dto: GeneratePlanDTO,
    allowedExercises: ActiveExerciseGenerationRecord[],
    recentExerciseHistory: string | null,
  ): GeneratePlanInput {
    return {
      userContext: {
        age: userContext.age,
        gender: userContext.gender,
        weight_kg: userContext.weight_kg,
        height_cm: userContext.height_cm,
        activity_level: userContext.activity_level,
        fitness_goal: userContext.fitness_goal,
      },
      planInput: {
        duration_weeks: dto.duration_weeks,
        days_per_week: dto.days_per_week,
        preferences:
          [
            dto.preferences?.trim(),
            recentExerciseHistory
              ? `Use this recent workout history to calibrate exercise selection and volume: ${recentExerciseHistory}`
              : null,
          ]
            .filter(Boolean)
            .join('\n') || null,
      },
      allowedExercises: allowedExercises.map((exercise) => ({
        name: exercise.name,
        muscle_group: exercise.muscle_group,
        category: exercise.category,
      })),
    };
  }

  private buildRequiredUserContext(
    aggregate: ProfileAggregate,
  ): RequiredUserContext {
    const profile = aggregate.profile;
    const missingFields = [
      profile.date_of_birth ? null : 'date_of_birth',
      profile.gender ? null : 'gender',
      profile.weight_kg ? null : 'weight_kg',
      profile.height_cm ? null : 'height_cm',
      profile.activity_level ? null : 'activity_level',
      profile.fitness_goal ? null : 'fitness_goal',
    ].filter((field): field is string => field !== null);

    if (missingFields.length > 0) {
      throw this.buildValidationException(
        'Incomplete Profile For AI Plan Generation',
        `Complete these profile fields before generating a plan: ${missingFields.join(', ')}.`,
      );
    }

    const dateOfBirth = profile.date_of_birth as Date;
    const gender = profile.gender as Gender;
    const weightKg = profile.weight_kg as Prisma.Decimal;
    const heightCm = profile.height_cm as Prisma.Decimal;
    const activityLevel = profile.activity_level as ActivityLevel;
    const fitnessGoal = profile.fitness_goal as FitnessGoal;

    return {
      age: this.calculateAge(dateOfBirth),
      gender,
      weight_kg: weightKg.toNumber(),
      height_cm: heightCm.toNumber(),
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
      fitnessGoal,
    };
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

  private resolveSchedule(
    response: AiGeneratePlanResponse,
    allowedExercises: ActiveExerciseGenerationRecord[],
    durationWeeks: number,
    daysPerWeek: number,
  ): TrainingPlanScheduleDayWriteInput[] {
    const exerciseLookup = new Map<string, ActiveExerciseGenerationRecord>(
      allowedExercises.map((exercise) => [exercise.name, exercise]),
    );
    const unresolvedNames = new Set<string>();
    const schedule: TrainingPlanScheduleDayWriteInput[] = [];

    for (const week of response.weeks) {
      this.assertValidWeek(week, durationWeeks);

      for (const day of this.normalizeWeekDays(week.days, daysPerWeek)) {
        schedule.push({
          weekNumber: week.week_number,
          dayOfWeek: day.day_of_week,
          focusLabel: this.readOptionalString(day.focus_label),
          notes: this.readOptionalString(day.notes),
          exercises: day.exercises.map((exercise, index) =>
            this.toScheduleExercise(
              exercise,
              index,
              exerciseLookup,
              unresolvedNames,
            ),
          ),
        });
      }
    }

    if (schedule.length === 0) {
      throw this.buildBadGatewayException(
        'The AI plan service returned an empty training plan.',
      );
    }

    if (unresolvedNames.size > 0) {
      throw this.buildValidationException(
        'Invalid AI-Generated Exercises',
        `The AI plan referenced exercises that are not in the active catalog: ${[
          ...unresolvedNames,
        ].join(', ')}.`,
      );
    }

    return schedule;
  }

  private normalizeWeekDays(
    days: AiGeneratedDay[],
    daysPerWeek: number,
  ): AiGeneratedDay[] {
    days.forEach((day) => this.assertValidDay(day));

    const selectedDays: AiGeneratedDay[] = [];
    const seenDays = new Set<number>();

    for (const day of days) {
      if (seenDays.has(day.day_of_week)) {
        continue;
      }

      seenDays.add(day.day_of_week);
      selectedDays.push(day);

      if (selectedDays.length === daysPerWeek) {
        break;
      }
    }

    return selectedDays.sort(
      (left, right) => left.day_of_week - right.day_of_week,
    );
  }

  private assertValidWeek(week: AiGeneratedWeek, durationWeeks: number): void {
    if (!Number.isInteger(week.week_number) || week.week_number < 1) {
      throw this.buildBadGatewayException(
        'The AI plan service returned an invalid week_number.',
      );
    }

    if (week.week_number > durationWeeks) {
      throw this.buildBadGatewayException(
        'The AI plan service returned a week_number outside the requested range.',
      );
    }

    if (!Array.isArray(week.days) || week.days.length === 0) {
      throw this.buildBadGatewayException(
        'The AI plan service returned a week without any schedule days.',
      );
    }
  }

  private assertValidDay(day: AiGeneratedDay): void {
    if (
      !Number.isInteger(day.day_of_week) ||
      day.day_of_week < 0 ||
      day.day_of_week > 6
    ) {
      throw this.buildBadGatewayException(
        'The AI plan service returned an invalid day_of_week.',
      );
    }

    if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
      throw this.buildBadGatewayException(
        'The AI plan service returned a schedule day without exercises.',
      );
    }
  }

  private toScheduleExercise(
    exercise: AiGeneratedExercise,
    index: number,
    exerciseLookup: Map<string, ActiveExerciseGenerationRecord>,
    unresolvedNames: Set<string>,
  ): TrainingPlanScheduleDayWriteInput['exercises'][number] {
    const exerciseName = this.readRequiredString(
      exercise.name,
      'exercise name',
    );
    const resolvedExercise = exerciseLookup.get(exerciseName);

    if (!resolvedExercise) {
      unresolvedNames.add(exerciseName);
    }

    return {
      exerciseId: resolvedExercise?.id ?? '',
      sets: this.readPositiveInteger(exercise.sets, 'sets'),
      reps: this.readOptionalPositiveInteger(exercise.reps, 'reps'),
      durationSeconds: this.readOptionalPositiveInteger(
        exercise.duration_seconds,
        'duration_seconds',
      ),
      restSeconds:
        this.readOptionalNonNegativeInteger(
          exercise.rest_seconds,
          'rest_seconds',
        ) ?? 60,
      weightKgTarget: this.readOptionalNonNegativeNumber(
        exercise.weight_kg_target,
        'weight_kg_target',
      ),
      orderIndex:
        this.readOptionalNonNegativeInteger(
          exercise.order_index,
          'order_index',
        ) ?? index,
      notes: this.readOptionalString(exercise.notes),
    };
  }

  private readRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.buildBadGatewayException(
        `The AI plan service returned an invalid ${fieldName}.`,
      );
    }

    return value.trim();
  }

  private readOptionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw this.buildBadGatewayException(
        'The AI plan service returned an invalid optional text field.',
      );
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readPositiveInteger(value: unknown, fieldName: string): number {
    if (!Number.isInteger(value) || Number(value) < 1) {
      throw this.buildBadGatewayException(
        `The AI plan service returned an invalid ${fieldName}.`,
      );
    }

    return Number(value);
  }

  private readOptionalPositiveInteger(
    value: unknown,
    fieldName: string,
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    return this.readPositiveInteger(value, fieldName);
  }

  private readOptionalNonNegativeInteger(
    value: unknown,
    fieldName: string,
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value) || Number(value) < 0) {
      throw this.buildBadGatewayException(
        `The AI plan service returned an invalid ${fieldName}.`,
      );
    }

    return Number(value);
  }

  private readOptionalNonNegativeNumber(
    value: unknown,
    fieldName: string,
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      throw this.buildBadGatewayException(
        `The AI plan service returned an invalid ${fieldName}.`,
      );
    }

    return value;
  }

  private formatGoalForTitle(goal: FitnessGoal): string {
    return goal.charAt(0).toUpperCase() + goal.slice(1);
  }

  private async validateAndExecuteAction(
    userId: string,
    actorRole: UserRole,
    action: string,
    params: unknown,
  ): Promise<ActionExecutionResult> {
    if (actorRole !== UserRole.member) {
      return {
        actionTriggered: null,
        actionResult: null,
      };
    }

    const validatedAction = this.validateAction(action);

    if (!validatedAction || validatedAction === 'NONE') {
      return {
        actionTriggered: null,
        actionResult: null,
      };
    }

    try {
      switch (validatedAction) {
        case 'ADJUST_TDEE': {
          const dto = this.buildRecalculateTdeeActionDto(params);

          if (!dto) {
            throw this.buildInvalidChatResponseException();
          }

          return {
            actionTriggered: validatedAction,
            actionResult: await this.nutritionService.recalculateTdee(
              userId,
              dto,
            ),
          };
        }
        case 'GENERATE_PLAN': {
          const dto = this.buildGeneratePlanActionDto(params);

          if (!dto) {
            throw this.buildInvalidChatResponseException();
          }

          return {
            actionTriggered: validatedAction,
            actionResult: await this.generatePlan(userId, dto),
          };
        }
        case 'LOG_NUTRITION': {
          const dto = this.buildLogNutritionActionDto(params);

          if (!dto) {
            throw this.buildInvalidChatResponseException();
          }

          return {
            actionTriggered: validatedAction,
            actionResult: await this.nutritionService.logNutrition(userId, dto),
          };
        }
        default:
          return {
            actionTriggered: null,
            actionResult: null,
          };
      }
    } catch (error) {
      if (this.isInvalidChatResponseError(error)) {
        throw error;
      }

      if (error instanceof HttpException) {
        return {
          actionTriggered: null,
          actionResult: null,
        };
      }

      throw error;
    }
  }

  private assertValidChatResponse(response: AIChatResponse): void {
    const candidate = this.asRecord(response);
    const allowedKeys = new Set([
      'content',
      'action',
      'params',
      'model_used',
      'token_count',
    ]);
    if (
      !candidate ||
      Object.keys(candidate).some((key) => !allowedKeys.has(key)) ||
      !Object.prototype.hasOwnProperty.call(candidate, 'params') ||
      !isValidAiResponseText(candidate.content)
    ) {
      throw this.buildInvalidChatResponseException();
    }

    const allowedActions: AIChatAction[] = [
      'ADJUST_TDEE',
      'GENERATE_PLAN',
      'LOG_NUTRITION',
      'NONE',
    ];
    if (
      typeof candidate.action !== 'string' ||
      !allowedActions.includes(candidate.action as AIChatAction)
    ) {
      throw this.buildInvalidChatResponseException();
    }

    if (
      (candidate.action === 'NONE' && candidate.params !== null) ||
      (candidate.action !== 'NONE' && !this.asRecord(candidate.params)) ||
      (candidate.action !== 'NONE' && candidate.params === null)
    ) {
      throw this.buildInvalidChatResponseException();
    }

    if (
      candidate.model_used !== undefined &&
      candidate.model_used !== null &&
      (typeof candidate.model_used !== 'string' ||
        !candidate.model_used.trim())
    ) {
      throw this.buildInvalidChatResponseException();
    }
    if (
      candidate.token_count !== undefined &&
      candidate.token_count !== null &&
      (typeof candidate.token_count !== 'number' ||
        !Number.isInteger(candidate.token_count) ||
        candidate.token_count < 0)
    ) {
      throw this.buildInvalidChatResponseException();
    }
  }

  private validateAction(action: string): AIChatAction | null {
    switch (action) {
      case 'ADJUST_TDEE':
      case 'GENERATE_PLAN':
      case 'LOG_NUTRITION':
      case 'NONE':
        return action;
      default:
        return null;
    }
  }

  private buildRecalculateTdeeActionDto(
    params: unknown,
  ): RecalculateTdeeDTO | null {
    const source = this.asRecord(params);

    if (
      !source ||
      !this.hasOnlyKeys(source, [
        'activity_level',
        'fitness_goal',
        'weight_kg',
        'height_cm',
        'gender',
      ])
    ) {
      return null;
    }

    const candidate = {
      activity_level: source.activity_level,
      fitness_goal: source.fitness_goal,
      weight_kg: source.weight_kg,
      gender: source.gender,
    };

    if (Object.values(candidate).every((value) => value === undefined)) {
      return null;
    }

    return this.validateDto(RecalculateTdeeDTO, candidate);
  }

  private buildGeneratePlanActionDto(params: unknown): GeneratePlanDTO | null {
    const source = this.asRecord(params);

    if (
      !source ||
      !this.hasOnlyKeys(source, [
        'duration_weeks',
        'days_per_week',
        'preferences',
      ])
    ) {
      return null;
    }

    return this.validateDto(GeneratePlanDTO, {
      duration_weeks: source.duration_weeks,
      days_per_week: source.days_per_week,
      preferences: source.preferences,
    });
  }

  private buildLogNutritionActionDto(params: unknown): LogNutritionDTO | null {
    const source = this.asRecord(params);

    if (
      !source ||
      !this.hasOnlyKeys(source, [
        'log_date',
        'meal_name',
        'food_item',
        'calories',
        'protein_g',
        'carbs_g',
        'fat_g',
        'quantity',
        'unit',
        'icon',
      ])
    ) {
      return null;
    }

    return this.validateDto(LogNutritionDTO, {
      log_date: source.log_date,
      meal_name: source.meal_name,
      food_item: source.food_item,
      calories: source.calories,
      protein_g: source.protein_g,
      carbs_g: source.carbs_g,
      fat_g: source.fat_g,
      quantity: source.quantity,
      unit: source.unit,
      icon: source.icon,
    });
  }

  private validateDto<T extends object>(
    dtoClass: ClassConstructor<T>,
    payload: Record<string, unknown>,
  ): T | null {
    const dto = plainToInstance(dtoClass, payload);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    return errors.length === 0 ? dto : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null) {
      const constructor = Object.prototype.hasOwnProperty.call(
        prototype,
        'constructor',
      )
        ? prototype.constructor
        : undefined;
      if (typeof constructor !== 'function' || constructor.name !== 'Object') {
        return null;
      }
    }

    return value as Record<string, unknown>;
  }

  private hasOnlyKeys(
    value: Record<string, unknown>,
    allowedKeys: string[],
  ): boolean {
    const allowed = new Set(allowedKeys);
    return Object.keys(value).every((key) => allowed.has(key));
  }

  private async resolveChatSession(
    userId: string,
    dto: AIChatDTO,
  ): Promise<ChatSessionResolution> {
    if (dto.session_id) {
      const session =
        await this.aiChatSessionRepository.findOwnedSessionByIdOrThrow(
          userId,
          dto.session_id,
        );

      if (!session.is_active) {
        throw this.buildSessionArchivedException();
      }

      if (this.isSessionInactive(session.last_activity_at)) {
        await this.archiveInactiveSession(session);
        throw this.buildSessionArchivedException();
      }

      return {
        session,
        seedTitle: session.title === null,
      };
    }

    const contextType = dto.context_type ?? ChatContext.general;
    const activeSession =
      await this.aiChatSessionRepository.findOwnedActiveSessionByContext(
        userId,
        contextType,
      );

    if (dto.start_new_session) {
      return {
        session: await this.aiChatSessionRepository.createSession({
          userId,
          contextType,
        }),
        seedTitle: true,
      };
    }

    if (!activeSession) {
      return {
        session: await this.aiChatSessionRepository.createSession({
          userId,
          contextType,
        }),
        seedTitle: true,
      };
    }

    if (this.isSessionInactive(activeSession.last_activity_at)) {
      return {
        session: await this.aiChatSessionRepository.createSession({
          userId,
          contextType,
        }),
        seedTitle: true,
      };
    }

    return {
      session: activeSession,
      seedTitle: activeSession.title === null,
    };
  }

  private async buildChatUserContext(
    userId: string,
  ): Promise<AIChatInput['userContext']> {
    const aggregate = (await this.userService.getMyProfile(
      userId,
    )) as ChatProfileAggregate;
    const profile = aggregate.profile;

    return {
      age: profile.date_of_birth
        ? this.calculateAge(profile.date_of_birth)
        : null,
      gender: profile.gender ?? null,
      weight_kg: profile.weight_kg?.toNumber() ?? null,
      height_cm: profile.height_cm?.toNumber() ?? null,
      activity_level: profile.activity_level ?? null,
      fitness_goal: profile.fitness_goal ?? null,
    };
  }

  private buildChatRequestPayload(
    session: AiChatSessionRecord,
    history: AiChatMessageRecord[],
    userContext: AIChatInput['userContext'],
    gymProfile: GymProfileResponseDTO,
    message: string,
    assistantScope: AssistantScope,
    actorRole: UserRole,
  ): AIChatInput {
    return {
      messages: [
        {
          role: 'assistant',
          content: this.buildGymGroundingMessage(gymProfile),
        },
        ...history.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ],
      userContext,
      sessionContext: {
        session_id: session.id,
        context_type: session.context_type,
        assistant_scope: assistantScope,
        allowed_actions:
          actorRole === UserRole.member
            ? ['ADJUST_TDEE', 'GENERATE_PLAN', 'LOG_NUTRITION', 'NONE']
            : ['NONE'],
      },
    };
  }

  private buildGymGroundingMessage(profile: GymProfileResponseDTO): string {
    return [
      '[Current gym grounding. Use this only when relevant to the user intent; do not invent or override it.]',
      `Gym name: ${profile.name}`,
      `Address: ${profile.location}`,
      `Opening time: ${profile.opening_time}`,
      `Closing time: ${profile.closing_time}`,
    ].join('\n');
  }

  private buildChatPromptBlueprint(
    session: AiChatSessionRecord,
    history: AiChatMessageRecord[],
    userContext: AIChatInput['userContext'],
    message: string,
    assistantScope: AssistantScope,
    actorRole: UserRole,
  ): ChatPromptBlueprint {
    const messagePurpose = this.inferChatMessagePurpose(session.context_type);
    const canExecuteMemberActions = actorRole === UserRole.member;

    return {
      version: 'v1',
      domain: 'chat',
      persona:
        'BrodigyAI: concise, warm, practical, and grounded in the current FitTrack workflow.',
      objective:
        'Help eligible users with the useful in-scope part of their request across fitness, nutrition, recovery, public gym information, app help, and authorized gym operations without inventing private facts or live records.',
      responseStyle: [
        'Keep replies brief and practical.',
        'Use an AI assistant tone that is natural and specific, not canned.',
        'Ask at most one concise clarifying question when an in-scope request is ambiguous.',
        'Prefer a useful next step over generic motivation.',
      ],
      guardrails: [
        'Use the current message, no more than four recent turns, and public gym identity or hours only when relevant.',
        'Allowed topics include greetings, fitness, workouts, macros and nutrition education, cutting or bulking, TDEE, recovery, SERTFIT public information, app help, and authorized gym operations.',
        'Role and access guards control private data and action execution; do not infer or reveal the user role, name, membership, plans, secrets, credentials, or private records.',
        'Do not invent live KPI values, schedules, membership details, or other business facts that are not supplied.',
        'Do not claim an action was completed. The backend validates any action metadata before execution.',
        'Refuse or redirect unrelated requests, including photosynthesis or Python array-sorting questions, without answering the unrelated topic.',
        'For urgent medical situations, keep the response safety-first and direct the user to qualified local help.',
      ],
      actionPolicy: {
        allowedActions: canExecuteMemberActions
          ? ['ADJUST_TDEE', 'GENERATE_PLAN', 'LOG_NUTRITION', 'NONE']
          : ['NONE'],
        triggerNotes: [
          'Return GENERATE_PLAN only when the user clearly asks for a workout or training plan.',
          'Return ADJUST_TDEE only when the user clearly asks to recalculate calories or macros.',
          'Return LOG_NUTRITION only when the user clearly asks to log a meal or nutrition entry.',
          'Return NONE for general coaching, clarification, unrelated requests, or actions the backend will not authorize for this role.',
        ],
        safetyNotes: [
          'Ask one concise clarification when an in-scope request is ambiguous rather than guessing.',
          'Refuse unrelated requests briefly and redirect to the supported BrodigyAI capabilities.',
        ],
      },
      context: {
        sessionId: session.id,
        contextType: session.context_type,
        assistantScope,
        recentMessageCount: history.length,
        latestUserMessage: message,
        userContext,
        messagePurpose,
      },
    };
  }

  private buildPlanPromptBlueprint(
    userContext: RequiredUserContext,
    dto: GeneratePlanDTO,
    allowedExercises: ActiveExerciseGenerationRecord[],
  ): PlanPromptBlueprint {
    return {
      version: 'v1',
      domain: 'generate-plan',
      persona:
        'FitTrack training planner: structured, progressive, and practical with a coach-like tone.',
      objective:
        'Generate a plan that matches the user goal, uses only the provided exercise catalog, and fits the requested schedule exactly.',
      responseStyle: [
        'Keep the plan clear and directly usable.',
        'Prefer sensible progression and balance over novelty.',
        'Be specific with exercise selection, sets, reps, and rest.',
      ],
      guardrails: [
        'Only use exercises from the provided catalog and never invent new movements.',
        'Honor the requested duration and days per week exactly.',
        'Prefer strength work first when the catalog supports it, then fill remaining slots with cardio, flexibility, or balance work.',
        'Do not exceed the provided exercise catalog capacity when distributing exercises across days.',
      ],
      planConstraints: {
        durationWeeks: dto.duration_weeks,
        daysPerWeek: dto.days_per_week,
        exerciseCatalogSize: allowedExercises.length,
        allowedExerciseCatalog: allowedExercises.map((exercise) => ({
          name: exercise.name,
          muscleGroup: exercise.muscle_group,
          category: exercise.category,
        })),
        selectionNotes: [
          'Keep the weekly structure aligned to the user goal and fitness context.',
          'Use the allowed exercise catalog as the only source of movements.',
          'Prefer readable, sustainable programming over extreme volume.',
        ],
        userContext: {
          age: userContext.age,
          gender: userContext.gender,
          weight_kg: userContext.weight_kg,
          height_cm: userContext.height_cm,
          activity_level: userContext.activity_level,
          fitness_goal: userContext.fitness_goal,
          fitnessGoal: userContext.fitnessGoal,
        },
        preferences: dto.preferences ?? null,
      },
    };
  }

  private enrichRequestPayloadWithBlueprint<
    TPayload extends object,
    TBlueprint extends object,
  >(
    payload: TPayload,
    promptBlueprint: TBlueprint,
  ): TPayload & {
    promptBlueprint: TBlueprint;
  } {
    return {
      ...payload,
      promptBlueprint,
    };
  }

  private inferChatMessagePurpose(contextType: ChatContext): string {
    if (contextType === ChatContext.training_plan) {
      return 'training_plan_guidance';
    }

    if (contextType === ChatContext.tdee_adjustment) {
      return 'tdee_adjustment';
    }

    return 'general_support';
  }

  private isSessionInactive(lastActivityAt: Date): boolean {
    return Date.now() - lastActivityAt.getTime() > SESSION_INACTIVITY_WINDOW_MS;
  }

  private async archiveInactiveSession(
    session: AiChatSessionRecord,
  ): Promise<void> {
    await this.aiChatSessionRepository.updateSessionById(session.id, {
      isActive: false,
    });
    this.emitAiSessionArchived({
      userId: session.user_id,
      sessionId: session.id,
      contextType: session.context_type,
      archivedAt: new Date().toISOString(),
    });
  }

  private seedSessionTitle(message: string): string {
    return message.slice(0, MAX_SESSION_TITLE_LENGTH).trim();
  }

  private buildSessionArchivedException(): HttpException {
    return new HttpException(
      {
        type: 'SESSION_ARCHIVED',
        title: 'Chat Session Archived',
        status: 410,
        detail:
          'This chat session was archived after more than 14 days of inactivity.',
      },
      HttpStatus.GONE,
    );
  }

  private extractErrorDetail(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'detail' in response &&
        typeof response.detail === 'string'
      ) {
        return response.detail;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown AI chat failure.';
  }

  private emitAiSessionArchived(event: AiSessionArchivedEvent): void {
    this.eventEmitter.emit(AI_SESSION_ARCHIVED_EVENT, event);
  }

  private toChatSessionResponse(
    session: AiChatSessionRecord,
  ): AiChatSessionResponseDTO {
    return {
      id: session.id,
      user_id: session.user_id,
      context_type: session.context_type,
      title: session.title,
      is_active: session.is_active,
      last_activity_at: session.last_activity_at.toISOString(),
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString(),
    };
  }

  private toChatMessageResponse(
    message: AiChatMessageRecord,
  ): AiChatMessageResponseDTO {
    return {
      id: message.id,
      session_id: message.session_id,
      role: message.role,
      content:
        message.role === ChatRole.assistant
          ? guardAiResponseText(message.content)
          : message.content,
      action_triggered: message.action_triggered,
      created_at: message.created_at.toISOString(),
      updated_at: message.updated_at.toISOString(),
    };
  }

  private buildValidationException(
    title: string,
    detail: string,
  ): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title,
        status: 422,
        detail,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private buildBadGatewayException(detail: string): HttpException {
    return new HttpException(
      {
        type: 'BAD_GATEWAY',
        title: 'Invalid AI Plan Response',
        status: 502,
        detail,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private buildInvalidChatResponseException(): HttpException {
    return new HttpException(
      {
        type: 'BAD_GATEWAY',
        title: 'Invalid AI Chat Response',
        status: 502,
        detail: 'The AI chat service returned an invalid payload.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private isInvalidChatResponseError(error: unknown): boolean {
    if (!(error instanceof HttpException) || error.getStatus() !== 502) {
      return false;
    }

    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'title' in response &&
      (response as { title?: unknown }).title === 'Invalid AI Chat Response'
    );
  }
}

import { ExerciseCategory } from '@prisma/client';

import type {
  AIChatAction,
  AIChatInput,
  AIChatResponse,
  AiGeneratePlanResponse,
  GeneratePlanInput,
} from './ai-python-client.service';

const DAY_SEQUENCE = [1, 3, 5, 0, 2, 4, 6] as const;
const MODEL_NAME = 'grounded-fallback';

const STRENGTH_REPS_BY_GOAL: Record<string, number> = {
  bulking: 8,
  cutting: 10,
  maintenance: 10,
  sport_specific: 6,
};

export function buildFallbackAiChatResponse(
  input: AIChatInput,
): AIChatResponse {
  const latestMessage = resolveLatestUserMessage(input.messages);
  const action = inferChatAction(latestMessage, input.sessionContext.context_type);
  const params = buildActionParams(action, latestMessage, input);

  return {
    content: buildChatReply(latestMessage, input, action),
    action,
    params,
    model_used: MODEL_NAME,
    token_count: null,
  };
}

export function buildFallbackGeneratePlanResponse(
  input: GeneratePlanInput,
): AiGeneratePlanResponse {
  return {
    weeks: Array.from({ length: input.planInput.duration_weeks }, (_, index) => ({
      week_number: index + 1,
      days: buildFallbackWeekDays(input, index + 1),
    })),
    model_used: MODEL_NAME,
    token_count: null,
  };
}

function buildFallbackWeekDays(input: GeneratePlanInput, weekNumber: number) {
  return Array.from({ length: input.planInput.days_per_week }, (_, dayIndex) => {
    const exercises = selectExercisesForDay(input, dayIndex);
    const primary = exercises[0];

    return {
      day_of_week: DAY_SEQUENCE[dayIndex] ?? dayIndex % 7,
      focus_label: primary
        ? `${primary.muscle_group.replaceAll('_', ' ')} focus`
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : 'Full Body Focus',
      notes:
        `Week ${weekNumber}: ` +
        (input.planInput.preferences?.trim() ||
          'Keep sessions sustainable and technically clean.'),
      exercises: exercises.map((exercise, index) =>
        toFallbackExercise(input, exercise, index),
      ),
    };
  });
}

function selectExercisesForDay(input: GeneratePlanInput, dayIndex: number) {
  const size = input.allowedExercises.length;
  const ordered = Array.from({ length: size }, (_, offset) => {
    const index = (dayIndex + offset) % size;
    return input.allowedExercises[index];
  });
  const strength = ordered.filter(
    (exercise) => exercise.category === ExerciseCategory.strength,
  );
  const secondary = ordered.filter(
    (exercise) => exercise.category !== ExerciseCategory.strength,
  );
  const prioritized = strength.length > 0 ? [...strength, ...secondary] : ordered;

  return prioritized.slice(0, Math.min(4, prioritized.length));
}

function toFallbackExercise(
  input: GeneratePlanInput,
  exercise: GeneratePlanInput['allowedExercises'][number],
  index: number,
) {
  return {
    name: exercise.name,
    sets: resolveSets(exercise.category),
    reps: resolveReps(input, exercise.category),
    duration_seconds: resolveDurationSeconds(exercise.category),
    rest_seconds: resolveRestSeconds(exercise.category),
    weight_kg_target: null,
    order_index: index,
    notes: `Prioritize controlled form for ${exercise.muscle_group.replaceAll('_', ' ')} work.`,
  };
}

function resolveContextHint(contextType: string): string {
  switch (contextType) {
    case 'training_plan':
      return 'I can help you narrow preferences and training constraints before you generate a full workout plan.';
    case 'nutrition':
      return 'I can help you interpret calorie targets, meal logging, and nutrition tradeoffs.';
    case 'tdee_adjustment':
      return 'I can help you reason about activity level and goal changes before you recalculate TDEE.';
    default:
      return 'I can help with training, nutrition, and general fitness guidance inside the FitTrack workflow.';
  }
}

function buildChatReply(
  latestMessage: string,
  input: AIChatInput,
  action: AIChatAction,
): string {
  const goal = input.userContext.fitness_goal?.replaceAll('_', ' ');
  const activityLevel = input.userContext.activity_level?.replaceAll('_', ' ');
  const userPrefix =
    goal && activityLevel
      ? `Your current goal is ${goal} and your activity level is ${activityLevel}. `
      : '';
  const openingLine = buildOpeningLine(latestMessage, action);
  const contextHint = resolveContextHint(input.sessionContext.context_type);

  return `${openingLine}${userPrefix}${contextHint}`.trim();
}

function buildOpeningLine(latestMessage: string, action: AIChatAction): string {
  if (action === 'GENERATE_PLAN') {
    return 'I can build that training plan from your saved profile. ';
  }

  if (action === 'ADJUST_TDEE') {
    return 'I can recalculate your calorie and macro targets from your saved profile. ';
  }

  const normalized = latestMessage.toLowerCase();
  if (normalized.includes('stay on track')) {
    return 'I can help you stay on track this week. ';
  }

  if (normalized.includes('nutrition')) {
    return 'I can help with nutrition and meal planning. ';
  }

  if (normalized.includes('workout') || normalized.includes('training')) {
    return 'I can help with training decisions and programming. ';
  }

  return '';
}

function inferChatAction(
  latestMessage: string,
  contextType: string,
): AIChatAction {
  const normalized = latestMessage.toLowerCase();
  const actionVerbMatch = /\b(build|create|generate|make|design|write|set up|adjust|recalculate|recalc|update|change|revise|set)\b/;
  const wantsPlan =
    /\b(plan|program|routine|split|workout plan|training plan)\b/.test(
      normalized,
    ) &&
    (contextType === 'training_plan' || actionVerbMatch.test(normalized));
  const wantsTdee =
    /\b(tdee|calorie|calories|macro|macros|nutrition)\b/.test(normalized) &&
    (contextType === 'tdee_adjustment' || actionVerbMatch.test(normalized));

  if (wantsPlan) {
    return 'GENERATE_PLAN';
  }

  if (wantsTdee) {
    return 'ADJUST_TDEE';
  }

  return 'NONE';
}

function buildActionParams(
  action: AIChatAction,
  latestMessage: string,
  input: AIChatInput,
): Record<string, unknown> | null {
  if (action === 'GENERATE_PLAN') {
    return {
      duration_weeks: extractNumber(latestMessage, /(\d+)\s*(?:week|weeks)/i) ?? 4,
      days_per_week: extractNumber(latestMessage, /(\d+)\s*(?:day|days)/i) ?? 3,
      preferences: latestMessage,
    };
  }

  if (action === 'ADJUST_TDEE') {
    const params: Record<string, unknown> = {};

    if (input.userContext.activity_level) {
      params.activity_level = input.userContext.activity_level;
    }

    if (input.userContext.fitness_goal) {
      params.fitness_goal = input.userContext.fitness_goal;
    }

    if (input.userContext.weight_kg !== null) {
      params.weight_kg = input.userContext.weight_kg;
    }

    if (input.userContext.gender) {
      params.gender = input.userContext.gender;
    }

    return Object.keys(params).length > 0 ? params : null;
  }

  return null;
}

function extractNumber(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveLatestUserMessage(messages: AIChatInput['messages']): string {
  return (
    [...messages].reverse().find((message) => message.role === 'user')?.content
      .trim() ?? messages.at(-1)?.content.trim() ?? 'How can I improve this week?'
  );
}

function resolveSets(category: ExerciseCategory): number {
  if (category === ExerciseCategory.strength) {
    return 4;
  }

  return category === ExerciseCategory.flexibility ? 2 : 1;
}

function resolveReps(
  input: GeneratePlanInput,
  category: ExerciseCategory,
): number | null {
  if (category === ExerciseCategory.strength) {
    return STRENGTH_REPS_BY_GOAL[input.userContext.fitness_goal] ?? 10;
  }

  return category === ExerciseCategory.balance ? 12 : null;
}

function resolveDurationSeconds(category: ExerciseCategory): number | null {
  if (category === ExerciseCategory.cardio) {
    return 900;
  }

  return category === ExerciseCategory.flexibility ? 300 : null;
}

function resolveRestSeconds(category: ExerciseCategory): number {
  if (category === ExerciseCategory.strength) {
    return 90;
  }

  return category === ExerciseCategory.cardio ? 60 : 45;
}

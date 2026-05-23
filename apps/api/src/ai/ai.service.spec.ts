import { HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ChatContext,
  ChatRole,
  ExerciseCategory,
  FitnessGoal,
  UserRole,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { ExerciseService } from '../fitness/exercise/exercise.service';
import { TrainingPlanService } from '../fitness/training-plan/training-plan.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { UserService } from '../user/user.service';
import { AI_SESSION_ARCHIVED_EVENT } from './events/ai-session-archived.event';
import { AiChatMessageRepository } from './ai-chat-message.repository';
import { AiChatSessionRepository } from './ai-chat-session.repository';
import { AiInteractionLogRepository } from './ai-interaction-log.repository';
import { AiPythonClientService } from './ai-python-client.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  const userService = {
    getMyProfile: jest.fn(),
  };

  const exerciseService = {
    listActiveExercisesForGeneration: jest.fn(),
  };

  const trainingPlanService = {
    createAiGeneratedPlan: jest.fn(),
  };

  const nutritionService = {
    logNutrition: jest.fn(),
    recalculateTdee: jest.fn(),
  };

  const aiClient = {
    assertHealthy: jest.fn(),
    chat: jest.fn(),
    generatePlan: jest.fn(),
  };

  const aiChatSessionRepository = {
    createSession: jest.fn(),
    listOwnedSessions: jest.fn(),
    updateSessionById: jest.fn(),
    findOwnedActiveSessionByContext: jest.fn(),
    findOwnedSessionByIdOrThrow: jest.fn(),
    archiveOwnedSessionByIdOrThrow: jest.fn(),
    restoreOwnedSessionByIdOrThrow: jest.fn(),
  };

  const aiChatMessageRepository = {
    createMessage: jest.fn(),
    listRecentMessagesBySessionId: jest.fn(),
    listOwnedSessionMessages: jest.fn(),
  };

  const aiInteractionLogRepository = {
    createInteractionLog: jest.fn(),
    createPlanGenerationLog: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: UserService, useValue: userService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: TrainingPlanService, useValue: trainingPlanService },
        { provide: NutritionService, useValue: nutritionService },
        { provide: AiPythonClientService, useValue: aiClient },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: AiChatSessionRepository,
          useValue: aiChatSessionRepository,
        },
        {
          provide: AiChatMessageRepository,
          useValue: aiChatMessageRepository,
        },
        {
          provide: AiInteractionLogRepository,
          useValue: aiInteractionLogRepository,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  it('maps owned chat sessions to response DTOs', async () => {
    aiChatSessionRepository.listOwnedSessions.mockResolvedValue({
      data: [
        {
          id: 'session-1',
          user_id: 'user-1',
          context_type: 'general',
          title: 'Macros',
          is_active: true,
          last_activity_at: new Date('2026-03-27T06:00:00.000Z'),
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T06:00:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getMyChatSessions('user-1', { page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: 'session-1',
          user_id: 'user-1',
          context_type: 'general',
          title: 'Macros',
          is_active: true,
          last_activity_at: '2026-03-27T06:00:00.000Z',
          created_at: '2026-03-27T05:00:00.000Z',
          updated_at: '2026-03-27T06:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    expect(aiChatSessionRepository.listOwnedSessions).toHaveBeenCalledWith(
      'user-1',
      { page: 1, limit: 20 },
    );
  });

  it('loads a single owned chat session through the repository seam', async () => {
    aiChatSessionRepository.findOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: 'nutrition',
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-27T06:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T06:00:00.000Z'),
    });

    await expect(
      service.getChatSessionById('user-1', 'session-1'),
    ).resolves.toEqual({
      id: 'session-1',
      user_id: 'user-1',
      context_type: 'nutrition',
      title: null,
      is_active: true,
      last_activity_at: '2026-03-27T06:00:00.000Z',
      created_at: '2026-03-27T05:00:00.000Z',
      updated_at: '2026-03-27T06:00:00.000Z',
    });
  });

  it('maps owned chat messages to response DTOs', async () => {
    aiChatMessageRepository.listOwnedSessionMessages.mockResolvedValue({
      data: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: 'assistant',
          content: 'Logged lunch.',
          action_triggered: 'LOG_NUTRITION',
          created_at: new Date('2026-03-27T06:01:00.000Z'),
          updated_at: new Date('2026-03-27T06:01:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getChatMessages('user-1', 'session-1', { page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: 'assistant',
          content: 'Logged lunch.',
          action_triggered: 'LOG_NUTRITION',
          created_at: '2026-03-27T06:01:00.000Z',
          updated_at: '2026-03-27T06:01:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    expect(
      aiChatMessageRepository.listOwnedSessionMessages,
    ).toHaveBeenCalledWith('user-1', 'session-1', { page: 1, limit: 20 });
  });

  it('archives owned sessions through the repository seam', async () => {
    aiChatSessionRepository.archiveOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
    });

    await expect(
      service.archiveSession('user-1', 'session-1'),
    ).resolves.toBeUndefined();

    expect(
      aiChatSessionRepository.archiveOwnedSessionByIdOrThrow,
    ).toHaveBeenCalledWith('user-1', 'session-1');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('restores owned sessions through the repository seam', async () => {
    aiChatSessionRepository.restoreOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      is_active: true,
    });

    await expect(
      service.restoreSession('user-1', 'session-1'),
    ).resolves.toBeUndefined();

    expect(
      aiChatSessionRepository.restoreOwnedSessionByIdOrThrow,
    ).toHaveBeenCalledWith('user-1', 'session-1');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('creates a new general chat session, forwards recent history, persists the exchange, and seeds the title', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue(
      null,
    );
    aiChatSessionRepository.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([
      {
        id: 'message-0',
        session_id: 'session-1',
        role: ChatRole.assistant,
        content: 'How can I help today?',
        action_triggered: null,
        created_at: new Date('2026-03-27T05:01:00.000Z'),
        updated_at: new Date('2026-03-27T05:01:00.000Z'),
      },
    ]);
    aiClient.chat.mockResolvedValue({
      content: 'Let us start by reviewing what you ate today.',
      action: 'NONE',
      params: null,
      token_count: 88,
      model_used: 'fittrack-llama',
    });
    aiChatMessageRepository.createMessage.mockResolvedValue({
      id: 'message-1',
    });
    aiChatSessionRepository.updateSessionById.mockResolvedValue({
      id: 'session-1',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-1',
    });

    await expect(
      service.chat('user-1', {
        message: 'I want help with meal planning.',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'Let us start by reviewing what you ate today.',
      action_triggered: null,
      action_result: null,
    });

    expect(
      aiChatSessionRepository.findOwnedActiveSessionByContext,
    ).toHaveBeenCalledWith('user-1', ChatContext.general);
    expect(aiChatSessionRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      contextType: ChatContext.general,
    });
    expect(aiClient.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: ChatRole.assistant,
            content: 'How can I help today?',
          },
          {
            role: 'user',
            content: 'I want help with meal planning.',
          },
        ],
        sessionContext: expect.objectContaining({
          session_id: 'session-1',
          context_type: ChatContext.general,
          assistant_scope: 'member_fitness',
        }),
      }),
    );
    expect(aiChatMessageRepository.createMessage).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      role: ChatRole.user,
      content: 'I want help with meal planning.',
    });
    expect(aiChatMessageRepository.createMessage).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      role: ChatRole.assistant,
      content: 'Let us start by reviewing what you ate today.',
      actionTriggered: null,
    });
    expect(aiChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        title: 'I want help with meal planning.',
      }),
    );
    expect(
      aiInteractionLogRepository.createInteractionLog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        interactionType: 'chat',
        modelUsed: 'fittrack-llama',
        tokenCount: 88,
        requestPayload: expect.objectContaining({
          promptBlueprint: expect.objectContaining({
            domain: 'chat',
            persona:
              'FitTrack in-app coach: concise, warm, and action-oriented, with fitness-aware coaching language.',
            context: expect.objectContaining({
              sessionId: 'session-1',
              contextType: ChatContext.general,
              latestUserMessage: 'I want help with meal planning.',
              messagePurpose: 'nutrition_guidance',
              userContext: expect.objectContaining({
                fitness_goal: FitnessGoal.cutting,
              }),
            }),
            actionPolicy: expect.objectContaining({
              allowedActions: [
                'ADJUST_TDEE',
                'GENERATE_PLAN',
                'LOG_NUTRITION',
                'NONE',
              ],
            }),
          }),
        }),
      }),
    );
  });

  it.each([
    [UserRole.admin, 'admin-1', 'admin-session-1'],
    [UserRole.coach, 'coach-1', 'coach-session-1'],
  ] as const)(
    'scopes %s chat to business operations and suppresses assistant actions',
    async (role, userId, sessionId) => {
      userService.getMyProfile.mockResolvedValue({
        profile: {
          date_of_birth: null,
          gender: null,
          weight_kg: null,
          height_cm: null,
          activity_level: null,
          fitness_goal: null,
        },
      });
      aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue(
        null,
      );
      aiChatSessionRepository.createSession.mockResolvedValue({
        id: sessionId,
        user_id: userId,
        context_type: ChatContext.general,
        title: null,
        is_active: true,
        last_activity_at: new Date('2026-03-27T05:00:00.000Z'),
        created_at: new Date('2026-03-27T05:00:00.000Z'),
        updated_at: new Date('2026-03-27T05:00:00.000Z'),
      });
      aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue(
        [],
      );
      aiClient.chat.mockResolvedValue({
        content:
          'Review revenue, attendance, and staffing before the next shift.',
        action: 'GENERATE_PLAN',
        params: { duration_weeks: 4, days_per_week: 3 },
        token_count: 64,
        model_used: 'fittrack-llama',
      });
      aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
        id: 'admin-log-1',
      });

      await expect(
        service.chat(userId, role, {
          message: 'Which revenue and attendance issues should I review?',
        }),
      ).resolves.toEqual({
        session_id: sessionId,
        reply:
          'Review revenue, attendance, and staffing before the next shift.',
        action_triggered: null,
        action_result: null,
      });

      expect(aiClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionContext: expect.objectContaining({
            session_id: sessionId,
            context_type: ChatContext.general,
            assistant_scope: 'admin_business',
          }),
        }),
      );
      expect(trainingPlanService.createAiGeneratedPlan).not.toHaveBeenCalled();
      expect(nutritionService.recalculateTdee).not.toHaveBeenCalled();
      expect(nutritionService.logNutrition).not.toHaveBeenCalled();
      expect(
        aiInteractionLogRepository.createInteractionLog,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          requestPayload: expect.objectContaining({
            promptBlueprint: expect.objectContaining({
            persona:
              'FitTrack business operations assistant: concise, operational, and grounded in gym management workflows.',
              actionPolicy: expect.objectContaining({
                allowedActions: ['NONE'],
              }),
              context: expect.objectContaining({
                assistantScope: 'admin_business',
              }),
            }),
          }),
        }),
      );
    },
  );

  it.each([UserRole.staff])(
    'denies %s BrodigyAI access before resolving chat sessions',
    async (role) => {
      await expect(
        service.chat('staff-1', role, {
          message: 'Can BrodigyAI help with revenue today?',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          status: 403,
        }),
      });

      expect(
        aiChatSessionRepository.findOwnedActiveSessionByContext,
      ).not.toHaveBeenCalled();
      expect(aiClient.chat).not.toHaveBeenCalled();
    },
  );

  it('reuses an existing active context session without creating a replacement', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-existing',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Existing title',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'We can continue where we left off.',
      action: 'NONE',
      params: null,
      token_count: 90,
      model_used: 'fittrack-llama',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-reuse',
    });

    await expect(
      service.chat('user-1', {
        context_type: ChatContext.general,
        message: 'Continue my macro planning.',
      }),
    ).resolves.toEqual({
      session_id: 'session-existing',
      reply: 'We can continue where we left off.',
      action_triggered: null,
      action_result: null,
    });

    const updateCalls = aiChatSessionRepository.updateSessionById.mock
      .calls as Array<
      [
        string,
        {
          isActive?: boolean;
          lastActivityAt?: Date;
          title?: string;
        },
      ]
    >;

    expect(aiChatSessionRepository.createSession).not.toHaveBeenCalled();
    expect(updateCalls[0]?.[0]).toBe('session-existing');
    expect(updateCalls[0]?.[1].lastActivityAt).toBeInstanceOf(Date);
    expect(
      updateCalls.some(([, input]) => typeof input.title === 'string'),
    ).toBe(false);
  });

  it('archives the current active context session when the client explicitly starts a new conversation', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-existing',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Existing title',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatSessionRepository.createSession.mockResolvedValue({
      id: 'fresh-session',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-28T05:00:00.000Z'),
      created_at: new Date('2026-03-28T05:00:00.000Z'),
      updated_at: new Date('2026-03-28T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'Fresh thread ready.',
      action: 'NONE',
      params: null,
      token_count: 64,
      model_used: 'fittrack-llama',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-start-new',
    });

    await expect(
      service.chat('user-1', {
        context_type: ChatContext.general,
        message: 'Start over please.',
        start_new_session: true,
      }),
    ).resolves.toEqual({
      session_id: 'fresh-session',
      reply: 'Fresh thread ready.',
      action_triggered: null,
      action_result: null,
    });

    expect(aiChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'session-existing',
      { isActive: false },
    );
    expect(aiChatSessionRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      contextType: ChatContext.general,
    });
  });

  it('archives stale context sessions discovered during implicit reuse and creates a fresh replacement', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'stale-session',
      user_id: 'user-1',
      context_type: ChatContext.nutrition,
      title: 'Old nutrition session',
      is_active: true,
      last_activity_at: new Date('2026-03-01T05:00:00.000Z'),
      created_at: new Date('2026-03-01T05:00:00.000Z'),
      updated_at: new Date('2026-03-01T05:00:00.000Z'),
    });
    aiChatSessionRepository.createSession.mockResolvedValue({
      id: 'fresh-session',
      user_id: 'user-1',
      context_type: ChatContext.nutrition,
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-28T05:00:00.000Z'),
      created_at: new Date('2026-03-28T05:00:00.000Z'),
      updated_at: new Date('2026-03-28T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'I started a fresh nutrition chat for you.',
      action: 'NONE',
      params: null,
      token_count: 91,
      model_used: 'fittrack-llama',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-fresh',
    });

    await expect(
      service.chat('user-1', {
        context_type: ChatContext.nutrition,
        message: 'Start a new nutrition thread.',
      }),
    ).resolves.toEqual({
      session_id: 'fresh-session',
      reply: 'I started a fresh nutrition chat for you.',
      action_triggered: null,
      action_result: null,
    });

    expect(aiChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'stale-session',
      { isActive: false },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AI_SESSION_ARCHIVED_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'stale-session',
        contextType: ChatContext.nutrition,
      }),
    );
    expect(aiChatSessionRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      contextType: ChatContext.nutrition,
    });
    expect(aiClient.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionContext: expect.objectContaining({
          session_id: 'fresh-session',
          context_type: ChatContext.nutrition,
          assistant_scope: 'member_fitness',
        }),
      }),
    );
  });

  it('archives explicitly requested stale sessions and returns the documented 410 path', async () => {
    aiChatSessionRepository.findOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.nutrition,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date('2026-03-01T05:00:00.000Z'),
      created_at: new Date('2026-03-01T05:00:00.000Z'),
      updated_at: new Date('2026-03-01T05:00:00.000Z'),
    });
    aiChatSessionRepository.updateSessionById.mockResolvedValue({
      id: 'session-1',
    });

    await expect(
      service.chat('user-1', {
        session_id: 'session-1',
        message: 'Can we continue?',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(aiChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'session-1',
      { isActive: false },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      AI_SESSION_ARCHIVED_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        contextType: ChatContext.nutrition,
      }),
    );
    expect(aiClient.chat).not.toHaveBeenCalled();
  });

  it('rejects explicitly requested archived sessions before reaching the AI client', async () => {
    aiChatSessionRepository.findOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-archived',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Archived thread',
      is_active: false,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-28T05:00:00.000Z'),
      updated_at: new Date('2026-03-28T05:00:00.000Z'),
    });

    await expect(
      service.chat('user-1', {
        session_id: 'session-archived',
        message: 'Can we keep going here?',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(aiChatSessionRepository.updateSessionById).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      AI_SESSION_ARCHIVED_EVENT,
      expect.objectContaining({
        sessionId: 'session-archived',
      }),
    );
    expect(aiClient.chat).not.toHaveBeenCalled();
  });

  it('ignores unexpected AI actions and still returns the assistant reply', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'Let us keep the conversation going.',
      action: 'UNEXPECTED_ACTION',
      params: { calories: 300 },
      token_count: 44,
      model_used: 'fittrack-llama',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-3',
    });

    await expect(
      service.chat('user-1', {
        message: 'What should I do next?',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'Let us keep the conversation going.',
      action_triggered: null,
      action_result: null,
    });

    expect(nutritionService.recalculateTdee).not.toHaveBeenCalled();
    expect(nutritionService.logNutrition).not.toHaveBeenCalled();
    expect(trainingPlanService.createAiGeneratedPlan).not.toHaveBeenCalled();
  });

  it('ignores schema-mismatched nutrition actions without failing the chat reply', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'I can log that once I have complete meal details.',
      action: 'LOG_NUTRITION',
      params: {
        calories: 'not-a-number',
      },
      token_count: 45,
      model_used: 'fittrack-llama',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-4',
    });

    await expect(
      service.chat('user-1', {
        message: 'Log a snack for me.',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'I can log that once I have complete meal details.',
      action_triggered: null,
      action_result: null,
    });

    expect(nutritionService.logNutrition).not.toHaveBeenCalled();
  });

  it('executes validated tdee adjustments through NutritionService', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'I recalculated your targets.',
      action: 'ADJUST_TDEE',
      params: {
        activity_level: 'active',
        weight_kg: 76.5,
      },
      token_count: 46,
      model_used: 'fittrack-llama',
    });
    nutritionService.recalculateTdee.mockResolvedValue({
      tdee: { id: 'tdee-1' },
      macros: { id: 'macro-1' },
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-5',
    });

    await expect(
      service.chat('user-1', {
        message: 'Please recalculate my calories.',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'I recalculated your targets.',
      action_triggered: 'ADJUST_TDEE',
      action_result: {
        tdee: { id: 'tdee-1' },
        macros: { id: 'macro-1' },
      },
    });

    expect(nutritionService.recalculateTdee).toHaveBeenCalledWith('user-1', {
      activity_level: 'active',
      weight_kg: 76.5,
    });
  });

  it('executes validated nutrition logging with documented defaults', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'I logged that meal for you.',
      action: 'LOG_NUTRITION',
      params: {
        food_item: 'Greek yogurt',
        calories: 320,
      },
      token_count: 47,
      model_used: 'fittrack-llama',
    });
    nutritionService.logNutrition.mockResolvedValue({
      id: 'log-1',
      meal_name: 'General',
      food_item: 'Greek yogurt',
      calories: '320.00',
      protein_g: '0.00',
      carbs_g: '0.00',
      fat_g: '0.00',
      quantity: '1.00',
      unit: 'serving',
    });
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-6',
    });

    await expect(
      service.chat('user-1', {
        message: 'Log my yogurt snack.',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'I logged that meal for you.',
      action_triggered: 'LOG_NUTRITION',
      action_result: {
        id: 'log-1',
        meal_name: 'General',
        food_item: 'Greek yogurt',
        calories: '320.00',
        protein_g: '0.00',
        carbs_g: '0.00',
        fat_g: '0.00',
        quantity: '1.00',
        unit: 'serving',
      },
    });

    expect(nutritionService.logNutrition).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        food_item: 'Greek yogurt',
        calories: 320,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        quantity: 1,
        unit: 'serving',
        meal_name: 'General',
      }),
    );
  });

  it('routes validated plan generation through the existing generatePlan seam', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockResolvedValue({
      content: 'I created a new training plan for you.',
      action: 'GENERATE_PLAN',
      params: {
        duration_weeks: 6,
        days_per_week: 4,
        preferences: 'Prefer dumbbells',
      },
      token_count: 48,
      model_used: 'fittrack-llama',
    });
    const generatePlanSpy = jest
      .spyOn(service, 'generatePlan')
      .mockResolvedValue({ id: 'plan-77', source: 'ai_generated' } as never);
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-7',
    });

    await expect(
      service.chat('user-1', {
        message: 'Build me a new workout plan.',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'I created a new training plan for you.',
      action_triggered: 'GENERATE_PLAN',
      action_result: {
        id: 'plan-77',
        source: 'ai_generated',
      },
    });

    expect(generatePlanSpy).toHaveBeenCalledWith('user-1', {
      duration_weeks: 6,
      days_per_week: 4,
      preferences: 'Prefer dumbbells',
    });
  });

  it('logs chat failures with the shared interaction-log seam before rethrowing', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.cutting,
      },
    });
    aiChatSessionRepository.findOwnedActiveSessionByContext.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      context_type: ChatContext.general,
      title: 'Macros',
      is_active: true,
      last_activity_at: new Date(),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    aiChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([]);
    aiClient.chat.mockRejectedValue(
      new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'AI Chat Failed',
          status: 502,
          detail: 'The AI chat service rejected the chat request.',
        },
        502,
      ),
    );
    aiInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-2',
    });

    await expect(
      service.chat('user-1', {
        message: 'I want help with meal planning.',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(
      aiInteractionLogRepository.createInteractionLog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        interactionType: 'chat',
        error: 'The AI chat service rejected the chat request.',
      }),
    );
    expect(aiChatMessageRepository.createMessage).not.toHaveBeenCalled();
  });

  it('rejects generation when the user profile is missing required context', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: null,
        gender: null,
        weight_kg: null,
        height_cm: null,
        activity_level: null,
        fitness_goal: null,
      },
    });

    await expect(
      service.generatePlan('user-1', {
        duration_weeks: 8,
        days_per_week: 4,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(aiClient.assertHealthy).not.toHaveBeenCalled();
  });

  it('generates, logs, resolves, and persists an AI training plan', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.bulking,
      },
    });
    exerciseService.listActiveExercisesForGeneration.mockResolvedValue([
      {
        id: 'exercise-1',
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: ExerciseCategory.strength,
      },
    ]);
    aiClient.assertHealthy.mockResolvedValue(undefined);
    aiClient.generatePlan.mockResolvedValue({
      weeks: [
        {
          week_number: 1,
          days: [
            {
              day_of_week: 1,
              focus_label: 'Leg Day',
              exercises: [{ name: 'Barbell Back Squat', sets: 4, reps: 8 }],
            },
          ],
        },
      ],
      token_count: 321,
      model_used: 'fittrack-llama',
    });
    trainingPlanService.createAiGeneratedPlan.mockResolvedValue({
      id: 'plan-1',
      source: 'ai_generated',
    });

    await expect(
      service.generatePlan('user-1', {
        duration_weeks: 8,
        days_per_week: 4,
        preferences: 'Prefer barbells',
      }),
    ).resolves.toEqual({
      id: 'plan-1',
      source: 'ai_generated',
    });

    expect(aiClient.assertHealthy).toHaveBeenCalledTimes(1);
    expect(aiClient.generatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planInput: {
          duration_weeks: 8,
          days_per_week: 4,
          preferences: 'Prefer barbells',
        },
      }),
    );
    expect(
      aiInteractionLogRepository.createPlanGenerationLog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenCount: 321,
        modelUsed: 'fittrack-llama',
        requestPayload: expect.objectContaining({
          promptBlueprint: expect.objectContaining({
            domain: 'generate-plan',
            planConstraints: expect.objectContaining({
              durationWeeks: 8,
              daysPerWeek: 4,
              exerciseCatalogSize: 1,
              preferences: 'Prefer barbells',
              userContext: expect.objectContaining({
                fitnessGoal: FitnessGoal.bulking,
                fitness_goal: 'bulking',
              }),
              allowedExerciseCatalog: [
                {
                  name: 'Barbell Back Squat',
                  muscleGroup: 'legs',
                  category: ExerciseCategory.strength,
                },
              ],
            }),
          }),
        }),
      }),
    );
    expect(trainingPlanService.createAiGeneratedPlan).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        goal: FitnessGoal.bulking,
        title: 'AI Bulking Plan',
        durationWeeks: 8,
        daysPerWeek: 4,
        aiGenerationPrompt: expect.objectContaining({
          promptBlueprint: expect.objectContaining({
            domain: 'generate-plan',
            planConstraints: expect.objectContaining({
              durationWeeks: 8,
              daysPerWeek: 4,
              exerciseCatalogSize: 1,
              preferences: 'Prefer barbells',
            }),
          }),
        }),
        schedule: [
          {
            weekNumber: 1,
            dayOfWeek: 1,
            focusLabel: 'Leg Day',
            notes: null,
            exercises: [
              {
                exerciseId: 'exercise-1',
                sets: 4,
                reps: 8,
                durationSeconds: null,
                restSeconds: 60,
                weightKgTarget: null,
                orderIndex: 0,
                notes: null,
              },
            ],
          },
        ],
      }),
    );
  });

  it('normalizes overfull AI schedule weeks before persisting the plan', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.bulking,
      },
    });
    exerciseService.listActiveExercisesForGeneration.mockResolvedValue([
      {
        id: 'exercise-1',
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: ExerciseCategory.strength,
      },
    ]);
    aiClient.assertHealthy.mockResolvedValue(undefined);
    aiClient.generatePlan.mockResolvedValue({
      weeks: [
        {
          week_number: 1,
          days: [
            {
              day_of_week: 3,
              focus_label: 'Midweek Strength',
              exercises: [{ name: 'Barbell Back Squat', sets: 4, reps: 8 }],
            },
            {
              day_of_week: 1,
              focus_label: 'Week Opener',
              exercises: [{ name: 'Barbell Back Squat', sets: 5, reps: 5 }],
            },
            {
              day_of_week: 1,
              focus_label: 'Duplicate Day',
              exercises: [{ name: 'Barbell Back Squat', sets: 3, reps: 10 }],
            },
            {
              day_of_week: 5,
              focus_label: 'Should Be Trimmed',
              exercises: [{ name: 'Barbell Back Squat', sets: 3, reps: 12 }],
            },
          ],
        },
      ],
      token_count: 111,
      model_used: 'fittrack-llama',
    });
    trainingPlanService.createAiGeneratedPlan.mockResolvedValue({
      id: 'plan-2',
      source: 'ai_generated',
    });

    await expect(
      service.generatePlan('user-1', {
        duration_weeks: 6,
        days_per_week: 2,
      }),
    ).resolves.toEqual({
      id: 'plan-2',
      source: 'ai_generated',
    });

    expect(trainingPlanService.createAiGeneratedPlan).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        daysPerWeek: 2,
        schedule: [
          expect.objectContaining({
            weekNumber: 1,
            dayOfWeek: 1,
            focusLabel: 'Week Opener',
          }),
          expect.objectContaining({
            weekNumber: 1,
            dayOfWeek: 3,
            focusLabel: 'Midweek Strength',
          }),
        ],
      }),
    );
  });

  it('rejects AI responses that reference inactive catalog exercises', async () => {
    userService.getMyProfile.mockResolvedValue({
      profile: {
        date_of_birth: new Date('1998-03-26'),
        gender: 'male',
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 175 },
        activity_level: 'moderate',
        fitness_goal: FitnessGoal.bulking,
      },
    });
    exerciseService.listActiveExercisesForGeneration.mockResolvedValue([
      {
        id: 'exercise-1',
        name: 'Barbell Back Squat',
        muscle_group: 'legs',
        category: ExerciseCategory.strength,
      },
    ]);
    aiClient.assertHealthy.mockResolvedValue(undefined);
    aiClient.generatePlan.mockResolvedValue({
      weeks: [
        {
          week_number: 1,
          days: [
            {
              day_of_week: 1,
              exercises: [{ name: 'Unknown Exercise', sets: 4 }],
            },
          ],
        },
      ],
    });

    await expect(
      service.generatePlan('user-1', {
        duration_weeks: 8,
        days_per_week: 4,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(
      aiInteractionLogRepository.createPlanGenerationLog,
    ).toHaveBeenCalled();
    expect(trainingPlanService.createAiGeneratedPlan).not.toHaveBeenCalled();
  });
});

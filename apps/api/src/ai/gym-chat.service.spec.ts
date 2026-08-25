import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GymChatRole } from '@prisma/client';

import { SubscriptionService } from '../membership/subscription/subscription.service';
import { UserService } from '../user/user.service';
import {
  AiPythonClientService,
  GymChatInput,
} from './ai-python-client.service';
import {
  CreateGymChatInteractionLogInput,
  GymChatInteractionLogRepository,
} from './gym-chat-interaction-log.repository';
import { GymChatMessageRepository } from './gym-chat-message.repository';
import { GymChatSessionRepository } from './gym-chat-session.repository';
import { GymKnowledgeRepository } from './gym-knowledge.repository';
import { GymChatService } from './gym-chat.service';
import { GymKnowledgeService } from './gym-knowledge.service';

describe('GymChatService', () => {
  let service: GymChatService;

  const userService = {
    getMyProfile: jest.fn(),
  };

  const subscriptionService = {
    listPlans: jest.fn(),
    hasSubscriptionAccess: jest.fn(),
  };

  const aiClient = {
    chatGym: jest.fn(),
  };

  const gymChatSessionRepository = {
    listOwnedSessions: jest.fn(),
    findOwnedSessionByIdOrThrow: jest.fn(),
    findMostRecentOwnedActiveSession: jest.fn(),
    createSession: jest.fn(),
    updateSessionById: jest.fn(),
    archiveOwnedSessionByIdOrThrow: jest.fn(),
  };

  const gymChatMessageRepository = {
    listOwnedSessionMessages: jest.fn(),
    listRecentMessagesBySessionId: jest.fn(),
    createMessage: jest.fn(),
  };

  const gymChatInteractionLogRepository = {
    createInteractionLog: jest.fn(),
  };

  const gymKnowledgeRepository = {
    listOperatingHours: jest.fn(),
    listSpecialSchedules: jest.fn(),
    listFaqEntries: jest.fn(),
  };

  const gymKnowledgeService = {
    getGymProfile: jest.fn().mockResolvedValue({
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: 'Pasay City, Metro Manila, Philippines',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GymChatService,
        { provide: UserService, useValue: userService },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: AiPythonClientService, useValue: aiClient },
        {
          provide: GymChatSessionRepository,
          useValue: gymChatSessionRepository,
        },
        {
          provide: GymChatMessageRepository,
          useValue: gymChatMessageRepository,
        },
        {
          provide: GymChatInteractionLogRepository,
          useValue: gymChatInteractionLogRepository,
        },
        {
          provide: GymKnowledgeRepository,
          useValue: gymKnowledgeRepository,
        },
        { provide: GymKnowledgeService, useValue: gymKnowledgeService },
      ],
    }).compile();

    service = module.get<GymChatService>(GymChatService);
    jest.clearAllMocks();
  });

  it('maps owned gym chat sessions to response DTOs', async () => {
    gymChatSessionRepository.listOwnedSessions.mockResolvedValue({
      data: [
        {
          id: 'session-1',
          user_id: 'user-1',
          title: 'Membership plans',
          is_active: true,
          last_activity_at: new Date('2026-03-27T06:00:00.000Z'),
          created_at: new Date('2026-03-27T05:00:00.000Z'),
          updated_at: new Date('2026-03-27T06:00:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getMySessions('user-1', { page: 1, limit: 20, is_active: true }),
    ).resolves.toEqual({
      data: [
        {
          id: 'session-1',
          title: 'Membership plans',
          is_active: true,
          last_activity_at: '2026-03-27T06:00:00.000Z',
          created_at: '2026-03-27T05:00:00.000Z',
          updated_at: '2026-03-27T06:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('maps owned gym chat messages and filters grounded source values to strings', async () => {
    gymChatMessageRepository.listOwnedSessionMessages.mockResolvedValue({
      data: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: GymChatRole.assistant,
          content: 'We are open until 10 PM today.',
          grounded_sources: [
            ' gym_identity ',
            'OPERATING_HOURS',
            'gym_identity',
            'arbitrary_database_table',
            ' faq ',
            42,
            null,
          ],
          out_of_scope: false,
          created_at: new Date('2026-03-27T06:01:00.000Z'),
          updated_at: new Date('2026-03-27T06:01:00.000Z'),
        },
        {
          id: 'message-2',
          session_id: 'session-1',
          role: GymChatRole.assistant,
          content: 'No stored source array.',
          grounded_sources: { source: 'gym_profile' },
          out_of_scope: false,
          created_at: new Date('2026-03-27T06:02:00.000Z'),
          updated_at: new Date('2026-03-27T06:02:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 2, total_pages: 1 },
    });

    await expect(
      service.getSessionMessages('user-1', 'session-1', {
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [
        {
          id: 'message-1',
          session_id: 'session-1',
          role: GymChatRole.assistant,
          content: 'We are open until 10 PM today.',
          grounded_sources: ['gym_profile', 'operating_hours', 'faq'],
          out_of_scope: false,
          created_at: '2026-03-27T06:01:00.000Z',
          updated_at: '2026-03-27T06:01:00.000Z',
        },
        {
          id: 'message-2',
          session_id: 'session-1',
          role: GymChatRole.assistant,
          content: 'No stored source array.',
          grounded_sources: null,
          out_of_scope: false,
          created_at: '2026-03-27T06:02:00.000Z',
          updated_at: '2026-03-27T06:02:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 2, total_pages: 1 },
    });
  });

  it('archives owned gym chat sessions through the repository seam', async () => {
    gymChatSessionRepository.archiveOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'session-1',
      is_active: false,
    });

    await expect(
      service.archiveSession('user-1', 'session-1'),
    ).resolves.toBeUndefined();

    expect(
      gymChatSessionRepository.archiveOwnedSessionByIdOrThrow,
    ).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('creates or reuses a session, builds grounded payloads, persists the exchange, and logs the response', async () => {
    gymChatSessionRepository.findMostRecentOwnedActiveSession.mockResolvedValue(
      null,
    );
    gymChatSessionRepository.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([
      {
        day_of_week: 1,
        opens_at: new Date('1970-01-01T06:00:00.000Z'),
        closes_at: new Date('1970-01-01T22:00:00.000Z'),
        is_closed: false,
        label: 'Weekday',
      },
    ]);
    gymKnowledgeRepository.listSpecialSchedules.mockResolvedValue({
      data: [
        {
          starts_on: new Date('2020-01-01T00:00:00.000Z'),
          ends_on: new Date('2020-01-02T00:00:00.000Z'),
          opens_at: null,
          closes_at: null,
          is_closed: true,
          reason: 'Expired closure',
          pricing_note: null,
        },
        {
          starts_on: new Date('2099-12-24T00:00:00.000Z'),
          ends_on: new Date('2099-12-25T00:00:00.000Z'),
          opens_at: new Date('1970-01-01T08:00:00.000Z'),
          closes_at: new Date('1970-01-01T18:00:00.000Z'),
          is_closed: false,
          reason: 'Holiday schedule',
          pricing_note: null,
        },
      ],
      meta: { page: 1, limit: 100, total: 2, total_pages: 1 },
    });
    gymKnowledgeRepository.listFaqEntries.mockResolvedValue({
      data: [
        {
          category: 'membership',
          question: 'Do you offer day passes?',
          answer: 'Yes, at the front desk.',
          keywords: ['day pass'],
        },
      ],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
    subscriptionService.listPlans.mockResolvedValue({
      data: [
        {
          name: 'Monthly Flex',
          price: { toString: () => '1999' },
          duration_days: 30,
          description: 'Month-to-month access.',
        },
      ],
      meta: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
    gymChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue([
      {
        id: 'message-0',
        session_id: 'session-1',
        role: GymChatRole.assistant,
        content: 'How can I help today?',
        grounded_sources: null,
        out_of_scope: false,
        created_at: new Date('2026-03-27T05:01:00.000Z'),
        updated_at: new Date('2026-03-27T05:01:00.000Z'),
      },
    ]);
    userService.getMyProfile.mockResolvedValue({
      role: 'member',
      profile: { first_name: 'Alex' },
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(true);
    aiClient.chatGym.mockResolvedValue({
      reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
      out_of_scope: false,
      sources: ['gym_identity', 'membership_plans', 'database_record_id'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      model_used: 'fittrack-llama',
      token_count: 91,
    });
    gymChatMessageRepository.createMessage.mockResolvedValue({
      id: 'message-1',
    });
    gymChatSessionRepository.updateSessionById.mockResolvedValue({
      id: 'session-1',
    });
    gymChatInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-1',
    });

    await expect(
      service.sendMessage('user-1', {
        message: 'What membership plans do you offer?',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
      sources: ['gym_profile', 'membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      out_of_scope: false,
    });

    expect(gymChatSessionRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(
      gymChatMessageRepository.listRecentMessagesBySessionId,
    ).toHaveBeenCalledWith('session-1', 12);
    const [[chatRequest]] = aiClient.chatGym.mock.calls as [[GymChatInput]];

    expect(chatRequest.sessionId).toBe('session-1');
    expect(chatRequest.message).toBe('What membership plans do you offer?');
    expect(chatRequest.grounding.operating_hours).toHaveLength(1);
    expect(chatRequest.grounding.special_schedules).toEqual([
      expect.objectContaining({ reason: 'Holiday schedule' }),
    ]);
    expect(chatRequest.grounding.membership_plans).toEqual([
      expect.objectContaining({
        name: 'Monthly Flex',
        price: '1999',
      }),
    ]);
    expect(chatRequest.grounding.faqs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: 'Do you offer day passes?',
          answer: 'Yes, at the front desk.',
        }),
        expect.objectContaining({
          question: 'Gym name',
          answer: 'SERTFIT Gym',
        }),
        expect.objectContaining({
          question: 'Gym address',
          answer: 'Pasay City, Metro Manila, Philippines',
        }),
        expect.objectContaining({
          question: 'Gym opening time',
          answer: '06:00',
        }),
        expect.objectContaining({
          question: 'Gym closing time',
          answer: '22:00',
        }),
      ]),
    );
    expect(chatRequest.grounding.session_history).toEqual([
      {
        role: GymChatRole.assistant,
        content: 'How can I help today?',
      },
    ]);
    expect(chatRequest.grounding.user_context).toEqual({
      role: 'member',
    });
    expect(gymChatMessageRepository.createMessage).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      role: GymChatRole.user,
      content: 'What membership plans do you offer?',
    });
    expect(gymChatMessageRepository.createMessage).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      role: GymChatRole.assistant,
      content: 'Membership option: Monthly Flex at PHP 1999 for 30 days.',
      groundedSources: ['gym_profile', 'membership_plans'],
      outOfScope: false,
    });
    expect(gymChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        title: 'What membership plans do you offer?',
      }),
    );
    const [[interactionLogInput]] = gymChatInteractionLogRepository
      .createInteractionLog.mock.calls as [[CreateGymChatInteractionLogInput]];

    expect(interactionLogInput.userId).toBe('user-1');
    expect(interactionLogInput.sessionId).toBe('session-1');
    expect(interactionLogInput.outOfScope).toBe(false);
    expect(interactionLogInput.modelUsed).toBe('fittrack-llama');
    expect(interactionLogInput.tokenCount).toBe(91);
    expect(interactionLogInput.responsePayload).toMatchObject({
      sources: ['gym_profile', 'membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
    });
  });

  it('persists out-of-scope replies and logs the grounded response metadata', async () => {
    gymChatSessionRepository.findMostRecentOwnedActiveSession.mockResolvedValue(
      null,
    );
    gymChatSessionRepository.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([]);
    gymKnowledgeRepository.listSpecialSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymKnowledgeRepository.listFaqEntries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    subscriptionService.listPlans.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue(
      [],
    );
    userService.getMyProfile.mockResolvedValue({
      role: 'member',
      profile: { first_name: 'Alex' },
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);
    aiClient.chatGym.mockResolvedValue({
      reply:
        'I can only help with gym support topics like hours and memberships.',
      out_of_scope: true,
      sources: [],
      follow_up_suggestions: [
        'Ask about gym hours or holiday schedules.',
        'Ask about membership plans or FAQs.',
      ],
      model_used: null,
      token_count: null,
    });
    gymChatMessageRepository.createMessage.mockResolvedValue({
      id: 'message-1',
    });
    gymChatSessionRepository.updateSessionById.mockResolvedValue({
      id: 'session-1',
    });
    gymChatInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-1',
    });

    await expect(
      service.sendMessage('user-1', {
        message: 'Can you help me pick stocks for my portfolio?',
      }),
    ).resolves.toEqual({
      session_id: 'session-1',
      reply:
        'I can only help with gym support topics like hours and memberships.',
      sources: [],
      follow_up_suggestions: [
        'Ask about gym hours or holiday schedules.',
        'Ask about membership plans or FAQs.',
      ],
      out_of_scope: true,
    });

    expect(gymChatMessageRepository.createMessage).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      role: GymChatRole.user,
      content: 'Can you help me pick stocks for my portfolio?',
    });
    expect(gymChatMessageRepository.createMessage).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      role: GymChatRole.assistant,
      content:
        'I can only help with gym support topics like hours and memberships.',
      groundedSources: [],
      outOfScope: true,
    });

    const [[interactionLogInput]] = gymChatInteractionLogRepository
      .createInteractionLog.mock.calls as [[CreateGymChatInteractionLogInput]];

    expect(interactionLogInput.outOfScope).toBe(true);
    expect(interactionLogInput.responsePayload).toMatchObject({
      out_of_scope: true,
      follow_up_suggestions: [
        'Ask about gym hours or holiday schedules.',
        'Ask about membership plans or FAQs.',
      ],
    });
  });

  it('creates a fresh replacement without archiving stale implicitly reused sessions', async () => {
    gymChatSessionRepository.findMostRecentOwnedActiveSession.mockResolvedValue(
      {
        id: 'stale-session',
        user_id: 'user-1',
        title: 'Old thread',
        is_active: true,
        last_activity_at: new Date('2026-03-01T05:00:00.000Z'),
        created_at: new Date('2026-03-01T05:00:00.000Z'),
        updated_at: new Date('2026-03-01T05:00:00.000Z'),
      },
    );
    gymChatSessionRepository.createSession.mockResolvedValue({
      id: 'fresh-session',
      user_id: 'user-1',
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-28T05:00:00.000Z'),
      created_at: new Date('2026-03-28T05:00:00.000Z'),
      updated_at: new Date('2026-03-28T05:00:00.000Z'),
    });
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([]);
    gymKnowledgeRepository.listSpecialSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymKnowledgeRepository.listFaqEntries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    subscriptionService.listPlans.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue(
      [],
    );
    userService.getMyProfile.mockResolvedValue({
      role: 'member',
      profile: { first_name: 'Alex' },
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);
    aiClient.chatGym.mockResolvedValue({
      reply: 'I started a fresh gym chat for you.',
      out_of_scope: false,
      sources: [],
      follow_up_suggestions: ['Ask about gym hours or holiday schedules.'],
      model_used: null,
      token_count: null,
    });
    gymChatMessageRepository.createMessage.mockResolvedValue({
      id: 'message-1',
    });
    gymChatInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-1',
    });

    await service.sendMessage('user-1', { message: 'Start over.' });

    expect(gymChatSessionRepository.updateSessionById).not.toHaveBeenCalledWith(
      'stale-session',
      { isActive: false },
    );
    expect(gymChatSessionRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('rejects explicit stale sessions after lazily archiving them', async () => {
    gymChatSessionRepository.findOwnedSessionByIdOrThrow.mockResolvedValue({
      id: 'stale-session',
      user_id: 'user-1',
      title: 'Old thread',
      is_active: true,
      last_activity_at: new Date('2026-03-01T05:00:00.000Z'),
      created_at: new Date('2026-03-01T05:00:00.000Z'),
      updated_at: new Date('2026-03-01T05:00:00.000Z'),
    });

    await expect(
      service.sendMessage('user-1', {
        session_id: 'session-1',
        message: 'Continue the old thread.',
      }),
    ).rejects.toMatchObject({
      status: 410,
    } satisfies Partial<HttpException>);

    expect(gymChatSessionRepository.updateSessionById).toHaveBeenCalledWith(
      'stale-session',
      { isActive: false },
    );
    expect(aiClient.chatGym).not.toHaveBeenCalled();
    expect(
      gymChatInteractionLogRepository.createInteractionLog,
    ).not.toHaveBeenCalled();
  });

  it('logs failure details when the Python gym-chat call rejects', async () => {
    gymChatSessionRepository.findMostRecentOwnedActiveSession.mockResolvedValue(
      null,
    );
    gymChatSessionRepository.createSession.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      title: null,
      is_active: true,
      last_activity_at: new Date('2026-03-27T05:00:00.000Z'),
      created_at: new Date('2026-03-27T05:00:00.000Z'),
      updated_at: new Date('2026-03-27T05:00:00.000Z'),
    });
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([]);
    gymKnowledgeRepository.listSpecialSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymKnowledgeRepository.listFaqEntries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    subscriptionService.listPlans.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
    });
    gymChatMessageRepository.listRecentMessagesBySessionId.mockResolvedValue(
      [],
    );
    userService.getMyProfile.mockResolvedValue({
      role: 'member',
      profile: { first_name: 'Alex' },
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);
    aiClient.chatGym.mockRejectedValue(
      new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Gym Chat Failed',
          status: 502,
          detail: 'The AI gym-chat service rejected the grounded chat request.',
        },
        502,
      ),
    );
    gymChatInteractionLogRepository.createInteractionLog.mockResolvedValue({
      id: 'log-1',
    });

    await expect(
      service.sendMessage('user-1', {
        message: 'What are your hours today?',
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(gymChatMessageRepository.createMessage).not.toHaveBeenCalled();
    expect(
      gymChatInteractionLogRepository.createInteractionLog,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        error: 'The AI gym-chat service rejected the grounded chat request.',
      }),
    );
  });
});

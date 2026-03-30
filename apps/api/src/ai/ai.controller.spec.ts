import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiController } from './ai.controller';

function getMethodGuardMetadata(
  methodName:
    | 'chat'
    | 'getMyChatSessions'
    | 'getChatSessionById'
    | 'getChatMessages'
    | 'archiveSession'
    | 'generatePlan',
): unknown[] | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    AiController.prototype,
    methodName,
  );

  return Reflect.getMetadata(GUARDS_METADATA, descriptor?.value as object) as
    | unknown[]
    | undefined;
}

function getThrottleMetadata(methodName: 'chat' | 'generatePlan'): {
  limit: number | undefined;
  ttl: number | undefined;
} {
  const descriptor = Object.getOwnPropertyDescriptor(
    AiController.prototype,
    methodName,
  );

  return {
    limit: Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      descriptor?.value as object,
    ) as number | undefined,
    ttl: Reflect.getMetadata(
      `${THROTTLER_TTL}default`,
      descriptor?.value as object,
    ) as number | undefined,
  };
}

describe('AiController', () => {
  const aiService = {
    chat: jest.fn(),
    getMyChatSessions: jest.fn(),
    getChatSessionById: jest.fn(),
    getChatMessages: jest.fn(),
    archiveSession: jest.fn(),
    generatePlan: jest.fn(),
  };

  let controller: AiController;

  beforeEach(() => {
    controller = new AiController(aiService as never);
    jest.clearAllMocks();
  });

  it.each([
    'chat',
    'getMyChatSessions',
    'getChatSessionById',
    'getChatMessages',
    'archiveSession',
    'generatePlan',
  ] as const)('protects %s with JWT auth', (methodName) => {
    expect(getMethodGuardMetadata(methodName)).toEqual([JwtAuthGuard]);
  });

  it.each(['chat', 'generatePlan'] as const)(
    'applies the documented 10 req/min throttle to %s',
    (methodName) => {
      expect(getThrottleMetadata(methodName)).toEqual({
        limit: 10,
        ttl: 60,
      });
    },
  );

  it('delegates chat requests to the service', async () => {
    aiService.chat.mockResolvedValue({ session_id: 'session-1' });

    await controller.chat({ sub: 'user-1' } as never, {
      message: 'Help me with nutrition.',
      context_type: 'nutrition' as never,
    });

    expect(aiService.chat).toHaveBeenCalledWith('user-1', {
      message: 'Help me with nutrition.',
      context_type: 'nutrition',
    });
  });

  it('lists chat sessions through the service', async () => {
    aiService.getMyChatSessions.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getMyChatSessions({ sub: 'user-1' } as never, {
      page: 2,
      limit: 10,
    });

    expect(aiService.getMyChatSessions).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
    });
  });

  it('loads a single chat session through the service', async () => {
    aiService.getChatSessionById.mockResolvedValue({ id: 'session-1' });

    await controller.getChatSessionById(
      '11111111-1111-4111-8111-111111111111',
      { sub: 'user-1' } as never,
    );

    expect(aiService.getChatSessionById).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('loads chat messages through the service', async () => {
    aiService.getChatMessages.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getChatMessages(
      '11111111-1111-4111-8111-111111111111',
      { sub: 'user-1' } as never,
      { page: 1, limit: 20 },
    );

    expect(aiService.getChatMessages).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
      { page: 1, limit: 20 },
    );
  });

  it('archives chat sessions through the service and returns a confirmation message', async () => {
    aiService.archiveSession.mockResolvedValue(undefined);

    await expect(
      controller.archiveSession('11111111-1111-4111-8111-111111111111', {
        sub: 'user-1',
      } as never),
    ).resolves.toEqual({
      message: 'AI chat session archived.',
    });

    expect(aiService.archiveSession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('delegates AI plan generation to the service', async () => {
    aiService.generatePlan.mockResolvedValue({ id: 'plan-1' });

    await controller.generatePlan({ sub: 'user-1' } as never, {
      duration_weeks: 8,
      days_per_week: 4,
      preferences: 'Prefer dumbbells',
    });

    expect(aiService.generatePlan).toHaveBeenCalledWith('user-1', {
      duration_weeks: 8,
      days_per_week: 4,
      preferences: 'Prefer dumbbells',
    });
  });
});

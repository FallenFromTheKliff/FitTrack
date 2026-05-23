import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiController } from './ai.controller';

function getMethodGuardMetadata(
  methodName:
    | 'chat'
    | 'getMyChatSessions'
    | 'getChatSessionById'
    | 'getChatMessages'
    | 'archiveSession'
    | 'restoreSession'
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

function getRolesMetadata(
  methodName:
    | 'chat'
    | 'getMyChatSessions'
    | 'getChatSessionById'
    | 'getChatMessages'
    | 'archiveSession'
    | 'restoreSession'
    | 'generatePlan',
): UserRole[] | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    AiController.prototype,
    methodName,
  );

  return Reflect.getMetadata(ROLES_KEY, descriptor?.value as object) as
    | UserRole[]
    | undefined;
}

describe('AiController', () => {
  const aiService = {
    chat: jest.fn(),
    getMyChatSessions: jest.fn(),
    getChatSessionById: jest.fn(),
    getChatMessages: jest.fn(),
    archiveSession: jest.fn(),
    restoreSession: jest.fn(),
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
    'restoreSession',
    'generatePlan',
  ] as const)('protects %s with JWT auth', (methodName) => {
    expect(getMethodGuardMetadata(methodName)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it.each([
    'chat',
    'getMyChatSessions',
    'getChatSessionById',
    'getChatMessages',
    'archiveSession',
    'restoreSession',
  ] as const)('allows admins, coaches, and members to %s', (methodName) => {
    expect(getRolesMetadata(methodName)).toEqual([
      UserRole.admin,
      UserRole.coach,
      UserRole.member,
    ]);
  });

  it('allows only members to generate AI plans', () => {
    expect(getRolesMetadata('generatePlan')).toEqual([UserRole.member]);
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

    await controller.chat({ sub: 'user-1', role: UserRole.member } as never, {
      message: 'Help me with nutrition.',
      context_type: 'nutrition' as never,
    });

    expect(aiService.chat).toHaveBeenCalledWith(
      'user-1',
      UserRole.member,
      {
        message: 'Help me with nutrition.',
        context_type: 'nutrition',
      },
    );
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
      message: 'AI chat session deleted.',
    });

    expect(aiService.archiveSession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('restores chat sessions through the service and returns a confirmation message', async () => {
    aiService.restoreSession.mockResolvedValue(undefined);

    await expect(
      controller.restoreSession('11111111-1111-4111-8111-111111111111', {
        sub: 'user-1',
      } as never),
    ).resolves.toEqual({
      message: 'AI chat session restored.',
    });

    expect(aiService.restoreSession).toHaveBeenCalledWith(
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

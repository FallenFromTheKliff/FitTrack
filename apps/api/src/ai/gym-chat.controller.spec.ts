import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BrodigyAccessGuard } from './brodigy-access.guard';
import { GymChatController } from './gym-chat.controller';

function getMethodGuardMetadata(
  methodName:
    | 'sendMessage'
    | 'getMySessions'
    | 'getSessionMessages'
    | 'archiveSession',
): unknown[] | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    GymChatController.prototype,
    methodName,
  );

  return Reflect.getMetadata(GUARDS_METADATA, descriptor?.value as object) as
    | unknown[]
    | undefined;
}

function getRolesMetadata(
  methodName:
    | 'sendMessage'
    | 'getMySessions'
    | 'getSessionMessages'
    | 'archiveSession',
): UserRole[] | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(
    GymChatController.prototype,
    methodName,
  );

  return Reflect.getMetadata(ROLES_KEY, descriptor?.value as object) as
    | UserRole[]
    | undefined;
}

describe('GymChatController', () => {
  const gymChatService = {
    sendMessage: jest.fn(),
    getMySessions: jest.fn(),
    getSessionMessages: jest.fn(),
    archiveSession: jest.fn(),
  };

  let controller: GymChatController;

  beforeEach(() => {
    controller = new GymChatController(gymChatService as never);
    jest.clearAllMocks();
  });

  it.each([
    'sendMessage',
    'getMySessions',
    'getSessionMessages',
    'archiveSession',
  ] as const)('protects %s with JWT auth', (methodName) => {
    expect(getMethodGuardMetadata(methodName)).toEqual([
      JwtAuthGuard,
      RolesGuard,
      BrodigyAccessGuard,
    ]);
  });

  it.each([
    'sendMessage',
    'getMySessions',
    'getSessionMessages',
    'archiveSession',
  ] as const)('allows operators and members to %s', (methodName) => {
    expect(getRolesMetadata(methodName)).toEqual([
      UserRole.admin,
      UserRole.coach,
      UserRole.staff,
      UserRole.member,
    ]);
  });

  it('sends gym chat messages through the service', async () => {
    gymChatService.sendMessage.mockResolvedValue({
      session_id: 'session-1',
      reply: 'Membership option: Monthly Flex at 1999 for 30 days.',
      sources: ['membership_plans'],
      follow_up_suggestions: [
        'Ask which membership plan fits your visit frequency.',
      ],
      out_of_scope: false,
    });

    await controller.sendMessage({ sub: 'user-1' } as never, {
      session_id: '11111111-1111-4111-8111-111111111111',
      message: 'What membership plans do you offer?',
    });

    expect(gymChatService.sendMessage).toHaveBeenCalledWith('user-1', {
      session_id: '11111111-1111-4111-8111-111111111111',
      message: 'What membership plans do you offer?',
    });
  });

  it('lists gym chat sessions through the service', async () => {
    gymChatService.getMySessions.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getMySessions({ sub: 'user-1' } as never, {
      page: 2,
      limit: 10,
      is_active: true,
    });

    expect(gymChatService.getMySessions).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
      is_active: true,
    });
  });

  it('loads gym chat messages through the service', async () => {
    gymChatService.getSessionMessages.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getSessionMessages(
      '11111111-1111-4111-8111-111111111111',
      { sub: 'user-1' } as never,
      { page: 1, limit: 20 },
    );

    expect(gymChatService.getSessionMessages).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
      { page: 1, limit: 20 },
    );
  });

  it('archives gym chat sessions through the service and returns a confirmation message', async () => {
    gymChatService.archiveSession.mockResolvedValue(undefined);

    await expect(
      controller.archiveSession('11111111-1111-4111-8111-111111111111', {
        sub: 'user-1',
      } as never),
    ).resolves.toEqual({
      message: 'Gym chat session archived.',
    });

    expect(gymChatService.archiveSession).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });
});

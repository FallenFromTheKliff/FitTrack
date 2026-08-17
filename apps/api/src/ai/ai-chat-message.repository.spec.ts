import { HttpException } from '@nestjs/common';
import { ChatRole } from '@prisma/client';

import { AiChatMessageRepository } from './ai-chat-message.repository';

describe('AiChatMessageRepository', () => {
  const aiChatSession = {
    findUnique: jest.fn(),
  };

  const aiChatMessage = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  };

  const prisma = {
    aiChatSession,
    aiChatMessage,
    $transaction: jest.fn(
      (callback: (tx: { aiChatMessage: typeof aiChatMessage }) => unknown) =>
        Promise.resolve(callback({ aiChatMessage })),
    ),
  };

  let repo: AiChatMessageRepository;

  beforeEach(() => {
    repo = new AiChatMessageRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists messages only after confirming the session belongs to the caller', async () => {
    aiChatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
    });
    aiChatMessage.findMany.mockResolvedValue([{ id: 'message-1' }]);
    aiChatMessage.count.mockResolvedValue(1);

    await repo.listOwnedSessionMessages('user-1', 'session-1', {
      page: 1,
      limit: 20,
    });

    expect(aiChatSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      include: undefined,
    });
    expect(aiChatMessage.findMany).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
    expect(aiChatMessage.count).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
    });
  });

  it('rejects message reads for sessions owned by a different user', async () => {
    aiChatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'other-user',
    });

    await expect(
      repo.listOwnedSessionMessages('user-1', 'session-1', {
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(aiChatMessage.findMany).not.toHaveBeenCalled();
  });

  it('creates chat messages with optional triggered-action metadata', async () => {
    aiChatMessage.create.mockResolvedValue({ id: 'message-1' });

    await repo.createMessage({
      sessionId: 'session-1',
      role: ChatRole.assistant,
      content: 'I adjusted your macros.',
      actionTriggered: 'LOG_NUTRITION',
    });

    expect(aiChatMessage.create).toHaveBeenCalledWith({
      data: {
        session: { connect: { id: 'session-1' } },
        role: ChatRole.assistant,
        content: 'I adjusted your macros.',
        action_triggered: 'LOG_NUTRITION',
      },
      include: undefined,
    });
  });

  it('creates a user and assistant exchange atomically', async () => {
    aiChatMessage.create
      .mockResolvedValueOnce({ id: 'message-user' })
      .mockResolvedValueOnce({ id: 'message-assistant' });

    await expect(
      repo.createMessagePair({
        sessionId: 'session-1',
        userContent: 'Please log my lunch.',
        assistantContent: 'I logged your lunch.',
        actionTriggered: 'LOG_NUTRITION',
      }),
    ).resolves.toEqual([
      { id: 'message-user' },
      { id: 'message-assistant' },
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(aiChatMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        session: { connect: { id: 'session-1' } },
        role: ChatRole.user,
        content: 'Please log my lunch.',
        action_triggered: null,
      },
    });
    expect(aiChatMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        session: { connect: { id: 'session-1' } },
        role: ChatRole.assistant,
        content: 'I logged your lunch.',
        action_triggered: 'LOG_NUTRITION',
      },
    });
  });

  it('loads the most recent messages in chronological order for prompt-building', async () => {
    aiChatMessage.findMany.mockResolvedValue([
      { id: 'message-3', created_at: new Date('2026-03-27T06:03:00.000Z') },
      { id: 'message-2', created_at: new Date('2026-03-27T06:02:00.000Z') },
      { id: 'message-1', created_at: new Date('2026-03-27T06:01:00.000Z') },
    ]);

    await expect(
      repo.listRecentMessagesBySessionId('session-1', 3),
    ).resolves.toEqual([
      { id: 'message-1', created_at: new Date('2026-03-27T06:01:00.000Z') },
      { id: 'message-2', created_at: new Date('2026-03-27T06:02:00.000Z') },
      { id: 'message-3', created_at: new Date('2026-03-27T06:03:00.000Z') },
    ]);

    expect(aiChatMessage.findMany).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });
});

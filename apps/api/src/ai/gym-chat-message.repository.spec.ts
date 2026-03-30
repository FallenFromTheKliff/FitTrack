import { GymChatRole } from '@prisma/client';
import { HttpException } from '@nestjs/common';

import { GymChatMessageRepository } from './gym-chat-message.repository';

describe('GymChatMessageRepository', () => {
  const gymChatSession = {
    findUnique: jest.fn(),
  };

  const gymChatMessage = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  };

  const prisma = {
    gymChatSession,
    gymChatMessage,
  };

  let repo: GymChatMessageRepository;

  beforeEach(() => {
    repo = new GymChatMessageRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists messages only after confirming the session belongs to the caller', async () => {
    gymChatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
    });
    gymChatMessage.findMany.mockResolvedValue([{ id: 'message-1' }]);
    gymChatMessage.count.mockResolvedValue(1);

    await repo.listOwnedSessionMessages('user-1', 'session-1', {
      page: 1,
      limit: 20,
    });

    expect(gymChatSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      include: undefined,
    });
    expect(gymChatMessage.findMany).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
    expect(gymChatMessage.count).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
    });
  });

  it('rejects message reads for sessions owned by a different user', async () => {
    gymChatSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'other-user',
    });

    await expect(
      repo.listOwnedSessionMessages('user-1', 'session-1', {
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(HttpException);

    expect(gymChatMessage.findMany).not.toHaveBeenCalled();
  });

  it('creates chat messages with grounded source metadata and out-of-scope state', async () => {
    gymChatMessage.create.mockResolvedValue({ id: 'message-1' });

    await repo.createMessage({
      sessionId: 'session-1',
      role: GymChatRole.assistant,
      content: 'I can help with gym support topics only.',
      groundedSources: [],
      outOfScope: true,
    });

    expect(gymChatMessage.create).toHaveBeenCalledWith({
      data: {
        session: { connect: { id: 'session-1' } },
        role: GymChatRole.assistant,
        content: 'I can help with gym support topics only.',
        grounded_sources: [],
        out_of_scope: true,
      },
      include: undefined,
    });
  });

  it('loads the most recent messages in chronological order for grounding history', async () => {
    gymChatMessage.findMany.mockResolvedValue([
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

    expect(gymChatMessage.findMany).toHaveBeenCalledWith({
      where: { session_id: 'session-1' },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });
});

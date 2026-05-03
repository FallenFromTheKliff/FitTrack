import { ChatContext } from '@prisma/client';

import { AiChatSessionRepository } from './ai-chat-session.repository';

describe('AiChatSessionRepository', () => {
  const aiChatSession = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    aiChatSession,
    $transaction: jest.fn(
      (callback: (tx: { aiChatSession: typeof aiChatSession }) => unknown) =>
        Promise.resolve(callback({ aiChatSession })),
    ),
  };

  let repo: AiChatSessionRepository;

  beforeEach(() => {
    repo = new AiChatSessionRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists owned sessions with recent activity ordering', async () => {
    aiChatSession.findMany.mockResolvedValue([{ id: 'session-1' }]);
    aiChatSession.count.mockResolvedValue(1);

    await repo.listOwnedSessions('user-1', {
      page: 2,
      limit: 5,
    });

    expect(aiChatSession.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: [{ last_activity_at: 'desc' }, { created_at: 'desc' }],
      skip: 5,
      take: 5,
    });
    expect(aiChatSession.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
    });
  });

  it('loads an owned session by id with an OrThrow contract', async () => {
    aiChatSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await repo.findOwnedSessionByIdOrThrow('user-1', 'session-1');

    expect(aiChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        user_id: 'user-1',
      },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('looks up the active owned session by context', async () => {
    aiChatSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await repo.findOwnedActiveSessionByContext(
      'user-1',
      ChatContext.training_plan,
    );

    expect(aiChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        context_type: ChatContext.training_plan,
        is_active: true,
      },
      include: undefined,
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      select: undefined,
    });
  });

  it('creates sessions with a default active state and last activity timestamp', async () => {
    aiChatSession.create.mockResolvedValue({ id: 'session-1' });

    await repo.createSession({
      userId: 'user-1',
      contextType: ChatContext.general,
      title: 'General coaching',
    });

    const createCalls = aiChatSession.create.mock.calls as [
      [
        {
          data: {
            user: { connect: { id: string } };
            context_type: ChatContext;
            title: string | null;
            is_active: boolean;
            last_activity_at: Date;
          };
          include?: unknown;
        },
      ],
    ];
    const [createArgs] = createCalls[0];

    expect(createArgs.data.user).toEqual({ connect: { id: 'user-1' } });
    expect(createArgs.data.context_type).toBe(ChatContext.general);
    expect(createArgs.data.title).toBe('General coaching');
    expect(createArgs.data.is_active).toBe(true);
    expect(createArgs.data.last_activity_at).toBeInstanceOf(Date);
    expect(createArgs.include).toBeUndefined();
  });

  it('archives an owned session after the ownership guard passes', async () => {
    aiChatSession.findFirst.mockResolvedValue({ id: 'session-1' });
    aiChatSession.update.mockResolvedValue({
      id: 'session-1',
      is_active: false,
    });

    await repo.archiveOwnedSessionByIdOrThrow('user-1', 'session-1');

    expect(aiChatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { is_active: false },
      include: undefined,
    });
  });

  it('restores an owned session without archiving other active sessions', async () => {
    aiChatSession.findFirst.mockResolvedValue({ id: 'session-1' });
    aiChatSession.update.mockResolvedValue({
      id: 'session-1',
      is_active: true,
    });

    await repo.restoreOwnedSessionByIdOrThrow('user-1', 'session-1');

    expect(aiChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        user_id: 'user-1',
      },
    });
    const updateCalls = aiChatSession.update.mock.calls as [
      [
        {
          data: {
            is_active: boolean;
            last_activity_at: Date;
          };
          where: { id: string };
        },
      ],
    ];
    const [updateArgs] = updateCalls[0];
    expect(updateArgs.where).toEqual({ id: 'session-1' });
    expect(updateArgs.data.is_active).toBe(true);
    expect(updateArgs.data.last_activity_at).toBeInstanceOf(Date);
    expect('updateMany' in aiChatSession).toBe(false);
  });

  it('updates chat-session metadata by id', async () => {
    aiChatSession.update.mockResolvedValue({ id: 'session-1' });

    await repo.updateSessionById('session-1', {
      title: 'Macros',
      lastActivityAt: new Date('2026-03-27T06:00:00.000Z'),
    });

    expect(aiChatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        title: 'Macros',
        last_activity_at: new Date('2026-03-27T06:00:00.000Z'),
      },
      include: undefined,
    });
  });
});

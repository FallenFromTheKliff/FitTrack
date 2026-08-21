import { GymChatSessionRepository } from './gym-chat-session.repository';

describe('GymChatSessionRepository', () => {
  const gymChatSession = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const prisma = {
    gymChatSession,
  };

  let repo: GymChatSessionRepository;

  beforeEach(() => {
    repo = new GymChatSessionRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists owned sessions with recent activity ordering and optional active filtering', async () => {
    gymChatSession.findMany.mockResolvedValue([{ id: 'session-1' }]);
    gymChatSession.count.mockResolvedValue(1);

    await repo.listOwnedSessions('user-1', {
      page: 2,
      limit: 5,
      is_active: true,
    });

    expect(gymChatSession.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', is_active: true },
      orderBy: [{ last_activity_at: 'desc' }, { created_at: 'desc' }],
      skip: 5,
      take: 5,
    });
    expect(gymChatSession.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', is_active: true },
    });
  });

  it('loads an owned session by id with an OrThrow contract', async () => {
    gymChatSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await repo.findOwnedSessionByIdOrThrow('user-1', 'session-1');

    expect(gymChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        user_id: 'user-1',
      },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('looks up the most recent active owned session', async () => {
    gymChatSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await repo.findMostRecentOwnedActiveSession('user-1');

    expect(gymChatSession.findFirst).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        is_active: true,
      },
      include: undefined,
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      select: undefined,
    });
  });

  it('creates sessions with a default active state and last activity timestamp', async () => {
    gymChatSession.create.mockResolvedValue({ id: 'session-1' });

    await repo.createSession({
      userId: 'user-1',
      title: 'Gym hours',
    });

    const createCalls = gymChatSession.create.mock.calls as [
      [
        {
          data: {
            user: { connect: { id: string } };
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
    expect(createArgs.data.title).toBe('Gym hours');
    expect(createArgs.data.is_active).toBe(true);
    expect(createArgs.data.last_activity_at).toBeInstanceOf(Date);
    expect(createArgs.include).toBeUndefined();
  });

  it('archives an owned session after the ownership guard passes', async () => {
    gymChatSession.findFirst.mockResolvedValue({ id: 'session-1' });
    gymChatSession.update.mockResolvedValue({
      id: 'session-1',
      is_active: false,
    });

    await repo.archiveOwnedSessionByIdOrThrow('user-1', 'session-1');

    expect(gymChatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { is_active: false },
      include: undefined,
    });
  });

  it('updates gym chat session metadata by id', async () => {
    gymChatSession.update.mockResolvedValue({ id: 'session-1' });

    await repo.updateSessionById('session-1', {
      title: 'Gym hours',
      lastActivityAt: new Date('2026-03-27T06:00:00.000Z'),
      isActive: true,
    });

    expect(gymChatSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        title: 'Gym hours',
        is_active: true,
        last_activity_at: new Date('2026-03-27T06:00:00.000Z'),
      },
      include: undefined,
    });
  });
});

import { GymChatInteractionLogRepository } from './gym-chat-interaction-log.repository';

describe('GymChatInteractionLogRepository', () => {
  const gymChatInteractionLog = {
    create: jest.fn(),
  };

  const prisma = {
    gymChatInteractionLog,
  };

  let repo: GymChatInteractionLogRepository;

  beforeEach(() => {
    repo = new GymChatInteractionLogRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('creates grounded gym-chat interaction logs with optional session metadata', async () => {
    gymChatInteractionLog.create.mockResolvedValue({ id: 'log-1' });

    await repo.createInteractionLog({
      userId: 'user-1',
      sessionId: 'session-1',
      requestPayload: { message: 'What are your hours today?' },
      groundingPayload: { operating_hours: [] },
      responsePayload: {
        reply: 'We are open until 10 PM.',
        follow_up_suggestions: ['Ask about holiday hours.'],
      },
      latencyMs: 245,
      modelUsed: 'fittrack-llama',
      tokenCount: 88,
      outOfScope: false,
    });

    expect(gymChatInteractionLog.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: 'user-1' } },
        session: { connect: { id: 'session-1' } },
        request_payload: { message: 'What are your hours today?' },
        grounding_payload: { operating_hours: [] },
        response_payload: {
          reply: 'We are open until 10 PM.',
          follow_up_suggestions: ['Ask about holiday hours.'],
        },
        latency_ms: 245,
        model_used: 'fittrack-llama',
        token_count: 88,
        out_of_scope: false,
        error: null,
      },
      include: undefined,
    });
  });
});

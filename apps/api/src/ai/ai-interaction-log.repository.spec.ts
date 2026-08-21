import { InteractionType } from '@prisma/client';

import { AiInteractionLogRepository } from './ai-interaction-log.repository';

describe('AiInteractionLogRepository', () => {
  const aiInteractionLog = {
    create: jest.fn(),
  };

  const prisma = {
    aiInteractionLog,
  };

  let repo: AiInteractionLogRepository;

  beforeEach(() => {
    repo = new AiInteractionLogRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('creates generalized AI interaction logs with optional session metadata', async () => {
    aiInteractionLog.create.mockResolvedValue({ id: 'log-1' });

    await repo.createInteractionLog({
      userId: 'user-1',
      sessionId: 'session-1',
      interactionType: InteractionType.chat,
      requestPayload: { prompt: 'hello' },
      responsePayload: { reply: 'hi' },
      actionTriggered: 'LOG_NUTRITION',
      actionResult: { status: 'accepted' },
      latencyMs: 250,
      modelUsed: 'fittrack-llama',
      tokenCount: 123,
    });

    expect(aiInteractionLog.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: 'user-1' } },
        session: { connect: { id: 'session-1' } },
        interaction_type: InteractionType.chat,
        request_payload: { prompt: 'hello' },
        response_payload: { reply: 'hi' },
        action_triggered: 'LOG_NUTRITION',
        action_result: { status: 'accepted' },
        latency_ms: 250,
        model_used: 'fittrack-llama',
        token_count: 123,
        error: null,
      },
      include: undefined,
    });
  });

  it('routes plan-generation writes through the shared interaction-log seam', async () => {
    const spy = jest
      .spyOn(repo, 'createInteractionLog')
      .mockResolvedValue({ id: 'log-2' } as never);

    await repo.createPlanGenerationLog({
      userId: 'user-1',
      requestPayload: { duration_weeks: 8 },
      responsePayload: { weeks: [] },
      tokenCount: 321,
      modelUsed: 'fittrack-llama',
    });

    expect(spy).toHaveBeenCalledWith({
      userId: 'user-1',
      requestPayload: { duration_weeks: 8 },
      responsePayload: { weeks: [] },
      interactionType: InteractionType.plan_generation,
      actionTriggered: 'GENERATE_PLAN',
      tokenCount: 321,
      modelUsed: 'fittrack-llama',
    });
  });
});

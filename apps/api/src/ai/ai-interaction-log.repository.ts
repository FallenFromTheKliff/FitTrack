import { Injectable } from '@nestjs/common';
import { AiInteractionLog, InteractionType, Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

export type CreateAiInteractionLogInput = {
  userId: string;
  sessionId?: string | null;
  interactionType: InteractionType;
  requestPayload: Prisma.InputJsonValue;
  responsePayload?: Prisma.InputJsonValue | null;
  actionTriggered?: string | null;
  actionResult?: Prisma.InputJsonValue | null;
  latencyMs?: number | null;
  modelUsed?: string | null;
  tokenCount?: number | null;
  error?: string | null;
};

export type CreatePlanGenerationLogInput = Omit<
  CreateAiInteractionLogInput,
  'interactionType' | 'actionTriggered'
>;

@Injectable()
export class AiInteractionLogRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createInteractionLog(
    input: CreateAiInteractionLogInput,
  ): Promise<AiInteractionLog> {
    return this.create<AiInteractionLog>(this.prisma.aiInteractionLog, {
      user: { connect: { id: input.userId } },
      session: input.sessionId
        ? { connect: { id: input.sessionId } }
        : undefined,
      interaction_type: input.interactionType,
      request_payload: input.requestPayload,
      response_payload: input.responsePayload ?? null,
      action_triggered: input.actionTriggered ?? null,
      action_result: input.actionResult ?? null,
      latency_ms: input.latencyMs ?? null,
      model_used: input.modelUsed ?? null,
      token_count: input.tokenCount ?? null,
      error: input.error ?? null,
    });
  }

  createPlanGenerationLog(
    input: CreatePlanGenerationLogInput,
  ): Promise<AiInteractionLog> {
    return this.createInteractionLog({
      ...input,
      interactionType: InteractionType.plan_generation,
      actionTriggered: 'GENERATE_PLAN',
    });
  }
}

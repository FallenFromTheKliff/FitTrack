import { Injectable } from '@nestjs/common';
import { GymChatInteractionLog, Prisma } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

export type CreateGymChatInteractionLogInput = {
  userId: string;
  sessionId?: string | null;
  requestPayload: Prisma.InputJsonValue;
  groundingPayload?: Prisma.InputJsonValue | null;
  responsePayload?: Prisma.InputJsonValue | null;
  latencyMs?: number | null;
  modelUsed?: string | null;
  tokenCount?: number | null;
  outOfScope?: boolean;
  error?: string | null;
};

@Injectable()
export class GymChatInteractionLogRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createInteractionLog(
    input: CreateGymChatInteractionLogInput,
  ): Promise<GymChatInteractionLog> {
    return this.create<GymChatInteractionLog>(
      this.prisma.gymChatInteractionLog,
      {
        user: { connect: { id: input.userId } },
        session: input.sessionId
          ? { connect: { id: input.sessionId } }
          : undefined,
        request_payload: input.requestPayload,
        grounding_payload: input.groundingPayload ?? Prisma.JsonNull,
        response_payload: input.responsePayload ?? Prisma.JsonNull,
        latency_ms: input.latencyMs ?? null,
        model_used: input.modelUsed ?? null,
        token_count: input.tokenCount ?? null,
        out_of_scope: input.outOfScope ?? false,
        error: input.error ?? null,
      },
    );
  }
}

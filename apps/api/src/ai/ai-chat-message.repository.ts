import { Injectable } from '@nestjs/common';
import { AiChatMessage, ChatRole, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDTO } from '../user/dto/user-dto';

export type AiChatMessageRecord = AiChatMessage;

export interface CreateAiChatMessageInput {
  sessionId: string;
  role: ChatRole;
  content: string;
  actionTriggered?: string | null;
}

@Injectable()
export class AiChatMessageRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async listOwnedSessionMessages(
    userId: string,
    sessionId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<AiChatMessageRecord>> {
    await this.findByIdAndAssertOwnership(
      this.prisma.aiChatSession,
      sessionId,
      userId,
      'AiChatSession',
    );

    return this.paginate<AiChatMessageRecord>(
      this.prisma.aiChatMessage,
      {
        where: { session_id: sessionId },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  createMessage(input: CreateAiChatMessageInput): Promise<AiChatMessageRecord> {
    const data: Prisma.AiChatMessageCreateInput = {
      session: { connect: { id: input.sessionId } },
      role: input.role,
      content: input.content,
      action_triggered: input.actionTriggered ?? null,
    };

    return this.create<AiChatMessageRecord>(this.prisma.aiChatMessage, data);
  }

  async listRecentMessagesBySessionId(
    sessionId: string,
    limit = 20,
  ): Promise<AiChatMessageRecord[]> {
    const records = await this.prisma.aiChatMessage.findMany({
      where: { session_id: sessionId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return [...records].reverse();
  }
}

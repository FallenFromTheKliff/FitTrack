import { Injectable } from '@nestjs/common';
import { GymChatMessage, GymChatRole, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDTO } from '../user/dto/user-dto';

export type GymChatMessageRecord = GymChatMessage;

export interface CreateGymChatMessageInput {
  sessionId: string;
  role: GymChatRole;
  content: string;
  groundedSources?: Prisma.InputJsonValue | null;
  outOfScope?: boolean;
}

@Injectable()
export class GymChatMessageRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async listOwnedSessionMessages(
    userId: string,
    sessionId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymChatMessageRecord>> {
    await this.findByIdAndAssertOwnership(
      this.prisma.gymChatSession,
      sessionId,
      userId,
      'GymChatSession',
    );

    return this.paginate<GymChatMessageRecord>(
      this.prisma.gymChatMessage,
      {
        where: { session_id: sessionId },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  createMessage(
    input: CreateGymChatMessageInput,
  ): Promise<GymChatMessageRecord> {
    const data: Prisma.GymChatMessageCreateInput = {
      session: { connect: { id: input.sessionId } },
      role: input.role,
      content: input.content,
      grounded_sources: input.groundedSources ?? Prisma.JsonNull,
      out_of_scope: input.outOfScope ?? false,
    };

    return this.create<GymChatMessageRecord>(this.prisma.gymChatMessage, data);
  }

  async listRecentMessagesBySessionId(
    sessionId: string,
    limit = 20,
  ): Promise<GymChatMessageRecord[]> {
    const records = await this.prisma.gymChatMessage.findMany({
      where: { session_id: sessionId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return [...records].reverse();
  }
}

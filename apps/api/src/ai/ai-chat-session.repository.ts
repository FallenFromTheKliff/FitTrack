import { Injectable } from '@nestjs/common';
import { AiChatSession, ChatContext, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDTO } from '../user/dto/user-dto';

export type AiChatSessionRecord = AiChatSession;

export interface CreateAiChatSessionInput {
  userId: string;
  contextType: ChatContext;
  title?: string | null;
  isActive?: boolean;
  lastActivityAt?: Date;
}

export interface UpdateAiChatSessionInput {
  title?: string | null;
  isActive?: boolean;
  lastActivityAt?: Date;
}

@Injectable()
export class AiChatSessionRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listOwnedSessions(
    userId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<AiChatSessionRecord>> {
    return this.paginateByUserId<AiChatSessionRecord>(
      this.prisma.aiChatSession,
      userId,
      {
        orderBy: [{ last_activity_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findOwnedSessionById(
    userId: string,
    sessionId: string,
  ): Promise<AiChatSessionRecord | null> {
    return this.findOne<AiChatSessionRecord>(this.prisma.aiChatSession, {
      id: sessionId,
      user_id: userId,
    });
  }

  findOwnedSessionByIdOrThrow(
    userId: string,
    sessionId: string,
  ): Promise<AiChatSessionRecord> {
    return this.findOneOrThrow<AiChatSessionRecord>(
      this.prisma.aiChatSession,
      {
        id: sessionId,
        user_id: userId,
      },
      'AiChatSession',
    );
  }

  findOwnedActiveSessionByContext(
    userId: string,
    contextType: ChatContext,
  ): Promise<AiChatSessionRecord | null> {
    return this.findOne<AiChatSessionRecord>(
      this.prisma.aiChatSession,
      {
        user_id: userId,
        context_type: contextType,
        is_active: true,
      },
      undefined,
      [{ updated_at: 'desc' }, { created_at: 'desc' }],
    );
  }

  createSession(input: CreateAiChatSessionInput): Promise<AiChatSessionRecord> {
    const data: Prisma.AiChatSessionCreateInput = {
      user: { connect: { id: input.userId } },
      context_type: input.contextType,
      title: input.title ?? null,
      is_active: input.isActive ?? true,
      last_activity_at: input.lastActivityAt ?? new Date(),
    };

    return this.create<AiChatSessionRecord>(this.prisma.aiChatSession, data);
  }

  async archiveOwnedSessionByIdOrThrow(
    userId: string,
    sessionId: string,
  ): Promise<AiChatSessionRecord> {
    await this.findOwnedSessionByIdOrThrow(userId, sessionId);

    return this.updateById<AiChatSessionRecord>(
      this.prisma.aiChatSession,
      sessionId,
      { is_active: false },
    );
  }

  updateSessionById(
    sessionId: string,
    input: UpdateAiChatSessionInput,
  ): Promise<AiChatSessionRecord> {
    const data: Prisma.AiChatSessionUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.isActive !== undefined) {
      data.is_active = input.isActive;
    }

    if (input.lastActivityAt !== undefined) {
      data.last_activity_at = input.lastActivityAt;
    }

    return this.updateById<AiChatSessionRecord>(
      this.prisma.aiChatSession,
      sessionId,
      data,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { GymChatSession, Prisma } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import { GymChatSessionFilterDTO } from './dto/gym-chat-session.dto';

export type GymChatSessionRecord = GymChatSession;

export interface CreateGymChatSessionInput {
  userId: string;
  title?: string | null;
  isActive?: boolean;
  lastActivityAt?: Date;
}

export interface UpdateGymChatSessionInput {
  title?: string | null;
  isActive?: boolean;
  lastActivityAt?: Date;
}

@Injectable()
export class GymChatSessionRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listOwnedSessions(
    userId: string,
    dto: GymChatSessionFilterDTO,
  ): Promise<PaginatedResult<GymChatSessionRecord>> {
    return this.paginateByUserId<GymChatSessionRecord>(
      this.prisma.gymChatSession,
      userId,
      {
        additionalWhere:
          dto.is_active === undefined
            ? undefined
            : { is_active: dto.is_active },
        orderBy: [{ last_activity_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findOwnedSessionByIdOrThrow(
    userId: string,
    sessionId: string,
  ): Promise<GymChatSessionRecord> {
    return this.findOneOrThrow<GymChatSessionRecord>(
      this.prisma.gymChatSession,
      {
        id: sessionId,
        user_id: userId,
      },
      'GymChatSession',
    );
  }

  findMostRecentOwnedActiveSession(
    userId: string,
  ): Promise<GymChatSessionRecord | null> {
    return this.findOne<GymChatSessionRecord>(
      this.prisma.gymChatSession,
      {
        user_id: userId,
        is_active: true,
      },
      undefined,
      [{ updated_at: 'desc' }, { created_at: 'desc' }],
    );
  }

  createSession(
    input: CreateGymChatSessionInput,
  ): Promise<GymChatSessionRecord> {
    const data: Prisma.GymChatSessionCreateInput = {
      user: { connect: { id: input.userId } },
      title: input.title ?? null,
      is_active: input.isActive ?? true,
      last_activity_at: input.lastActivityAt ?? new Date(),
    };

    return this.create<GymChatSessionRecord>(this.prisma.gymChatSession, data);
  }

  async archiveOwnedSessionByIdOrThrow(
    userId: string,
    sessionId: string,
  ): Promise<GymChatSessionRecord> {
    await this.findOwnedSessionByIdOrThrow(userId, sessionId);

    return this.updateById<GymChatSessionRecord>(
      this.prisma.gymChatSession,
      sessionId,
      { is_active: false },
    );
  }

  updateSessionById(
    sessionId: string,
    input: UpdateGymChatSessionInput,
  ): Promise<GymChatSessionRecord> {
    const data: Prisma.GymChatSessionUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.isActive !== undefined) {
      data.is_active = input.isActive;
    }

    if (input.lastActivityAt !== undefined) {
      data.last_activity_at = input.lastActivityAt;
    }

    return this.updateById<GymChatSessionRecord>(
      this.prisma.gymChatSession,
      sessionId,
      data,
    );
  }
}

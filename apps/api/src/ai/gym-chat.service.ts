import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { GymChatRole, MembershipPlan, Prisma } from '@prisma/client';

import { PaginatedResult } from '../common/base-repository/base-repository';
import { SubscriptionService } from '../membership/subscription/subscription.service';
import { PaginationDTO } from '../user/dto/user-dto';
import { UserService } from '../user/user.service';
import {
  AiPythonClientService,
  GymChatGroundingInput,
  GymChatInput,
} from './ai-python-client.service';
import {
  GymChatMessageResponseDTO,
  GymChatReplyResponseDTO,
  GymChatSessionFilterDTO,
  GymChatSessionResponseDTO,
  SendGymChatMessageDTO,
} from './dto/gym-chat-session.dto';
import {
  CreateGymChatInteractionLogInput,
  GymChatInteractionLogRepository,
} from './gym-chat-interaction-log.repository';
import {
  GymChatMessageRecord,
  GymChatMessageRepository,
} from './gym-chat-message.repository';
import {
  GymChatSessionRecord,
  GymChatSessionRepository,
} from './gym-chat-session.repository';
import { GymKnowledgeRepository } from './gym-knowledge.repository';

type GymChatUserAggregate = {
  role: string;
  profile: {
    first_name: string;
  };
};

type GymChatSessionResolution = {
  session: GymChatSessionRecord;
  seedTitle: boolean;
};

const SESSION_INACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GYM_CHAT_HISTORY_MESSAGES = 20;
const MAX_SESSION_TITLE_LENGTH = 80;
const GROUNDING_PAGE_SIZE = 100;

@Injectable()
export class GymChatService {
  constructor(
    private readonly userService: UserService,
    private readonly subscriptionService: SubscriptionService,
    private readonly aiClient: AiPythonClientService,
    private readonly gymChatSessionRepository: GymChatSessionRepository,
    private readonly gymChatMessageRepository: GymChatMessageRepository,
    private readonly gymChatInteractionLogRepository: GymChatInteractionLogRepository,
    private readonly gymKnowledgeRepository: GymKnowledgeRepository,
  ) {}

  async sendMessage(
    userId: string,
    dto: SendGymChatMessageDTO,
  ): Promise<GymChatReplyResponseDTO> {
    const resolved = await this.resolveChatSession(userId, dto);
    const grounding = await this.buildGroundingPayload(
      userId,
      resolved.session.id,
    );
    const requestPayload = this.buildGymChatRequestPayload(
      resolved.session.id,
      dto.message,
      grounding,
    );
    const startedAt = Date.now();

    try {
      const response = await this.aiClient.chatGym(requestPayload);
      const latencyMs = Date.now() - startedAt;

      await this.gymChatMessageRepository.createMessage({
        sessionId: resolved.session.id,
        role: GymChatRole.user,
        content: dto.message,
      });
      await this.gymChatMessageRepository.createMessage({
        sessionId: resolved.session.id,
        role: GymChatRole.assistant,
        content: response.reply,
        groundedSources: response.sources,
        outOfScope: response.out_of_scope,
      });

      await this.gymChatSessionRepository.updateSessionById(
        resolved.session.id,
        {
          lastActivityAt: new Date(),
          ...(resolved.seedTitle
            ? { title: this.seedSessionTitle(dto.message) }
            : {}),
        },
      );

      await this.gymChatInteractionLogRepository.createInteractionLog(
        this.buildInteractionLogInput({
          userId,
          sessionId: resolved.session.id,
          requestPayload: {
            session_id: resolved.session.id,
            message: dto.message,
            policy: {
              gym_only: true,
              refuse_out_of_scope: true,
            },
          },
          groundingPayload: grounding,
          responsePayload: response,
          latencyMs,
          modelUsed: response.model_used ?? null,
          tokenCount: response.token_count ?? null,
          outOfScope: response.out_of_scope,
        }),
      );

      return {
        session_id: resolved.session.id,
        reply: response.reply,
        sources: response.sources,
        follow_up_suggestions: response.follow_up_suggestions,
        out_of_scope: response.out_of_scope,
      };
    } catch (error) {
      await this.gymChatInteractionLogRepository.createInteractionLog(
        this.buildInteractionLogInput({
          userId,
          sessionId: resolved.session.id,
          requestPayload: {
            session_id: resolved.session.id,
            message: dto.message,
            policy: {
              gym_only: true,
              refuse_out_of_scope: true,
            },
          },
          groundingPayload: grounding,
          latencyMs: Date.now() - startedAt,
          error: this.extractErrorDetail(error),
        }),
      );

      throw error;
    }
  }

  async getMySessions(
    userId: string,
    dto: GymChatSessionFilterDTO,
  ): Promise<PaginatedResult<GymChatSessionResponseDTO>> {
    const result = await this.gymChatSessionRepository.listOwnedSessions(
      userId,
      dto,
    );

    return {
      data: result.data.map((session) => this.toSessionResponse(session)),
      meta: result.meta,
    };
  }

  async getSessionMessages(
    userId: string,
    sessionId: string,
    dto: PaginationDTO,
  ): Promise<PaginatedResult<GymChatMessageResponseDTO>> {
    const result = await this.gymChatMessageRepository.listOwnedSessionMessages(
      userId,
      sessionId,
      dto,
    );

    return {
      data: result.data.map((message) => this.toMessageResponse(message)),
      meta: result.meta,
    };
  }

  async archiveSession(userId: string, sessionId: string): Promise<void> {
    await this.gymChatSessionRepository.archiveOwnedSessionByIdOrThrow(
      userId,
      sessionId,
    );
  }

  private async resolveChatSession(
    userId: string,
    dto: SendGymChatMessageDTO,
  ): Promise<GymChatSessionResolution> {
    if (dto.session_id) {
      const session =
        await this.gymChatSessionRepository.findOwnedSessionByIdOrThrow(
          userId,
          dto.session_id,
        );

      if (!session.is_active) {
        throw this.buildSessionArchivedException(
          'This gym chat session is archived and can no longer receive new messages.',
        );
      }

      if (this.isSessionInactive(session.last_activity_at)) {
        await this.archiveInactiveSession(session);
        throw this.buildSessionArchivedException(
          'This gym chat session was archived after more than 14 days of inactivity.',
        );
      }

      return {
        session,
        seedTitle: session.title === null,
      };
    }

    const activeSession =
      await this.gymChatSessionRepository.findMostRecentOwnedActiveSession(
        userId,
      );

    if (!activeSession) {
      return {
        session: await this.gymChatSessionRepository.createSession({ userId }),
        seedTitle: true,
      };
    }

    if (this.isSessionInactive(activeSession.last_activity_at)) {
      await this.archiveInactiveSession(activeSession);

      return {
        session: await this.gymChatSessionRepository.createSession({ userId }),
        seedTitle: true,
      };
    }

    return {
      session: activeSession,
      seedTitle: activeSession.title === null,
    };
  }

  private async buildGroundingPayload(
    userId: string,
    sessionId: string,
  ): Promise<GymChatGroundingInput> {
    const [
      operatingHours,
      specialSchedules,
      promotions,
      faqEntries,
      plans,
      sessionHistory,
      aggregate,
      hasActiveMembership,
    ] = await Promise.all([
      this.gymKnowledgeRepository.listOperatingHours(),
      this.gymKnowledgeRepository.listSpecialSchedules({
        page: 1,
        limit: GROUNDING_PAGE_SIZE,
      }),
      this.gymKnowledgeRepository.listPromotions({
        page: 1,
        limit: GROUNDING_PAGE_SIZE,
      }),
      this.gymKnowledgeRepository.listFaqEntries({
        page: 1,
        limit: GROUNDING_PAGE_SIZE,
      }),
      this.subscriptionService.listPlans({
        page: 1,
        limit: GROUNDING_PAGE_SIZE,
      }),
      this.gymChatMessageRepository.listRecentMessagesBySessionId(
        sessionId,
        MAX_GYM_CHAT_HISTORY_MESSAGES,
      ),
      this.userService.getMyProfile(userId) as Promise<GymChatUserAggregate>,
      this.subscriptionService.hasSubscriptionAccess(userId),
    ]);

    return {
      operating_hours: operatingHours.map((entry) => ({
        day_of_week: entry.day_of_week,
        opens_at: this.formatTime(entry.opens_at),
        closes_at: this.formatTime(entry.closes_at),
        is_closed: entry.is_closed,
        label: entry.label,
      })),
      special_schedules: specialSchedules.data.map((entry) => ({
        starts_on: this.formatDateOnly(entry.starts_on),
        ends_on: this.formatDateOnly(entry.ends_on),
        opens_at: entry.opens_at ? this.formatTime(entry.opens_at) : null,
        closes_at: entry.closes_at ? this.formatTime(entry.closes_at) : null,
        is_closed: entry.is_closed,
        reason: entry.reason,
        pricing_note: entry.pricing_note,
      })),
      promotions: promotions.data.map((entry) => ({
        title: entry.title,
        description: entry.description,
        promo_code: entry.promo_code,
        starts_at: entry.starts_at.toISOString(),
        ends_at: entry.ends_at.toISOString(),
        pricing_note: entry.pricing_note,
      })),
      faqs: faqEntries.data.map((entry) => ({
        category: entry.category,
        question: entry.question,
        answer: entry.answer,
        keywords: this.normalizeGroundedSources(entry.keywords),
      })),
      membership_plans: plans.data.map((plan) =>
        this.toMembershipPlanPayload(plan),
      ),
      session_history: sessionHistory.flatMap((entry) => {
        if (
          entry.role !== GymChatRole.user &&
          entry.role !== GymChatRole.assistant
        ) {
          return [];
        }

        return [
          {
            role: entry.role,
            content: entry.content,
          },
        ];
      }),
      user_context: {
        first_name: aggregate.profile.first_name,
        role: aggregate.role,
        active_membership: hasActiveMembership,
      },
    };
  }

  private buildGymChatRequestPayload(
    sessionId: string,
    message: string,
    grounding: GymChatGroundingInput,
  ): GymChatInput {
    return {
      sessionId,
      message,
      grounding,
      policy: {
        gymOnly: true,
        refuseOutOfScope: true,
      },
    };
  }

  private buildInteractionLogInput(
    input: Omit<
      CreateGymChatInteractionLogInput,
      'requestPayload' | 'groundingPayload' | 'responsePayload'
    > & {
      requestPayload: Record<string, unknown>;
      groundingPayload?: Record<string, unknown> | null;
      responsePayload?: Record<string, unknown> | null;
    },
  ): CreateGymChatInteractionLogInput {
    return {
      ...input,
      requestPayload: input.requestPayload as Prisma.InputJsonValue,
      groundingPayload:
        (input.groundingPayload as Prisma.InputJsonValue | null | undefined) ??
        null,
      responsePayload:
        (input.responsePayload as Prisma.InputJsonValue | null | undefined) ??
        null,
    };
  }

  private async archiveInactiveSession(
    session: GymChatSessionRecord,
  ): Promise<void> {
    await this.gymChatSessionRepository.updateSessionById(session.id, {
      isActive: false,
    });
  }

  private isSessionInactive(lastActivityAt: Date): boolean {
    return Date.now() - lastActivityAt.getTime() > SESSION_INACTIVITY_WINDOW_MS;
  }

  private seedSessionTitle(message: string): string {
    return message.slice(0, MAX_SESSION_TITLE_LENGTH).trim();
  }

  private buildSessionArchivedException(detail: string): HttpException {
    return new HttpException(
      {
        type: 'SESSION_ARCHIVED',
        title: 'Gym Chat Session Archived',
        status: 410,
        detail,
      },
      HttpStatus.GONE,
    );
  }

  private toMembershipPlanPayload(plan: MembershipPlan) {
    return {
      name: plan.name,
      price: plan.price.toString(),
      duration_days: plan.duration_days,
      description: plan.description,
    };
  }

  private toSessionResponse(
    session: GymChatSessionRecord,
  ): GymChatSessionResponseDTO {
    return {
      id: session.id,
      title: session.title,
      is_active: session.is_active,
      last_activity_at: session.last_activity_at.toISOString(),
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString(),
    };
  }

  private toMessageResponse(
    message: GymChatMessageRecord,
  ): GymChatMessageResponseDTO {
    return {
      id: message.id,
      session_id: message.session_id,
      role: message.role,
      content: message.content,
      grounded_sources: this.normalizeGroundedSources(message.grounded_sources),
      out_of_scope: message.out_of_scope,
      created_at: message.created_at.toISOString(),
      updated_at: message.updated_at.toISOString(),
    };
  }

  private normalizeGroundedSources(
    value: Prisma.JsonValue | null,
  ): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private formatTime(value: Date): string {
    return value.toISOString().slice(11, 16);
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private extractErrorDetail(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'detail' in response &&
        typeof response.detail === 'string'
      ) {
        return response.detail;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown gym chat failure.';
  }
}

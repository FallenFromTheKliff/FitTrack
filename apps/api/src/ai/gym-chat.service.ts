import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  GymChatRole,
  GymFaqCategory,
  Prisma,
} from '@prisma/client';

import {
  guardAiResponseText,
  isValidAiResponseText,
} from '../../../../packages/utils/ai-response-text';
import { PaginatedResult } from '../common/base-repository/base-repository';
import { SubscriptionService } from '../membership/subscription/subscription.service';
import { PaginationDTO } from '../user/dto/user-dto';
import { UserService } from '../user/user.service';
import {
  AiPythonClientService,
  GymChatFaqInput,
  GymChatGroundingInput,
  GymChatInput,
  GymChatResponse,
} from './ai-python-client.service';
import {
  GymChatMessageResponseDTO,
  GymChatReplyResponseDTO,
  GymChatSessionFilterDTO,
  GymChatSessionResponseDTO,
  SendGymChatMessageDTO,
} from './dto/gym-chat-session.dto';
import type { GymProfileResponseDTO } from './dto/gym-knowledge.dto';
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
import { GymKnowledgeService } from './gym-knowledge.service';

type GymChatUserAggregate = {
  role: string;
};

type GymChatSessionResolution = {
  session: GymChatSessionRecord;
  seedTitle: boolean;
};

const SESSION_INACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_GYM_CHAT_HISTORY_MESSAGES = 12;
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
    private readonly gymKnowledgeService: GymKnowledgeService,
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
      this.assertValidGymResponse(response);
      const groundedSources = this.normalizeProviderSources(response.sources);
      const normalizedResponse = {
        ...response,
        sources: groundedSources,
      };
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
        groundedSources,
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
          responsePayload: normalizedResponse,
          latencyMs,
          modelUsed: response.model_used ?? null,
          tokenCount: response.token_count ?? null,
          outOfScope: response.out_of_scope,
        }),
      );

      return {
        session_id: resolved.session.id,
        reply: response.reply,
        sources: groundedSources,
        follow_up_suggestions: response.follow_up_suggestions,
        out_of_scope: response.out_of_scope,
      };
    } catch (error) {
      if (this.isInvalidGymChatResponseError(error)) {
        throw error;
      }
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
      faqEntries,
      plans,
      sessionHistory,
      aggregate,
      gymProfile,
    ] = await Promise.all([
      this.gymKnowledgeRepository.listOperatingHours(),
      this.gymKnowledgeRepository.listSpecialSchedules({
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
      this.gymKnowledgeService.getGymProfile(),
    ]);

    return {
      operating_hours: operatingHours.map((entry) => ({
        day_of_week: entry.day_of_week,
        opens_at: this.formatTime(entry.opens_at),
        closes_at: this.formatTime(entry.closes_at),
        is_closed: entry.is_closed,
        label: entry.label,
      })),
      special_schedules: specialSchedules.data
        .filter(
          (entry) =>
            this.formatDateOnly(entry.ends_on) >=
            this.formatGymDateOnly(new Date()),
        )
        .map((entry) => ({
          starts_on: this.formatDateOnly(entry.starts_on),
          ends_on: this.formatDateOnly(entry.ends_on),
          opens_at: entry.opens_at ? this.formatTime(entry.opens_at) : null,
          closes_at: entry.closes_at ? this.formatTime(entry.closes_at) : null,
          is_closed: entry.is_closed,
          reason: entry.reason,
          pricing_note: entry.pricing_note,
        })),
      faqs: [
        ...faqEntries.data.map((entry) => ({
          category: entry.category,
          question: entry.question,
          answer: entry.answer,
          keywords: this.normalizeGroundedSources(entry.keywords),
        })),
        ...this.buildGymProfileFaqs(gymProfile),
      ],
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
        if (
          entry.role === GymChatRole.assistant &&
          !isValidAiResponseText(entry.content)
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
        role: aggregate.role,
      },
    };
  }

  private buildGymProfileFaqs(
    profile: GymProfileResponseDTO,
  ): GymChatFaqInput[] {
    const entries: Array<{
      question: string;
      answer: string;
      keywords: string[];
    }> = [
      { question: 'Gym name', answer: profile.name, keywords: ['gym', 'name'] },
      {
        question: 'Gym address',
        answer: profile.location,
        keywords: ['gym', 'address', 'location'],
      },
      {
        question: 'Gym phone',
        answer: profile.phone,
        keywords: ['gym', 'phone', 'contact'],
      },
      {
        question: 'Gym email',
        answer: profile.email,
        keywords: ['gym', 'email', 'contact'],
      },
      {
        question: 'Gym opening time',
        answer: profile.opening_time,
        keywords: ['gym', 'hours', 'opening'],
      },
      {
        question: 'Gym closing time',
        answer: profile.closing_time,
        keywords: ['gym', 'hours', 'closing'],
      },
    ];

    return entries.map(({ question, answer, keywords }) => ({
      category: GymFaqCategory.general,
      question,
      answer,
      keywords,
    }));
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

  private toMembershipPlanPayload(plan: {
    name: string;
    price: string | number | { toString(): string };
    duration_days: number;
    description: string | null;
  }) {
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
      content:
        message.role === GymChatRole.assistant
          ? guardAiResponseText(message.content)
          : message.content,
      grounded_sources: this.normalizeGroundedSources(message.grounded_sources),
      out_of_scope: message.out_of_scope,
      created_at: message.created_at.toISOString(),
      updated_at: message.updated_at.toISOString(),
    };
  }

  private assertValidGymResponse(response: GymChatResponse): void {
    const candidate =
      typeof response === 'object' &&
      response !== null &&
      !Array.isArray(response)
        ? (response as unknown as Record<string, unknown>)
        : null;
    const allowedKeys = new Set([
      'reply',
      'out_of_scope',
      'sources',
      'follow_up_suggestions',
      'model_used',
      'token_count',
    ]);
    if (
      !candidate ||
      Object.keys(candidate).some((key) => !allowedKeys.has(key)) ||
      !isValidAiResponseText(candidate.reply) ||
      typeof candidate.out_of_scope !== 'boolean' ||
      !Array.isArray(candidate.sources) ||
      !candidate.sources.every(
        (source) =>
          typeof source === 'string' &&
          new Set([
            'gym_profile',
            'operating_hours',
            'membership_plans',
            'special_schedules',
            'faq',
            'conversation_history',
            'gym_identity',
          ]).has(source),
      ) ||
      !Array.isArray(candidate.follow_up_suggestions) ||
      candidate.follow_up_suggestions.length > 2 ||
      !candidate.follow_up_suggestions.every(
        (suggestion) =>
          typeof suggestion === 'string' &&
          isValidAiResponseText(suggestion),
      ) ||
      (candidate.model_used !== undefined &&
        candidate.model_used !== null &&
        (typeof candidate.model_used !== 'string' ||
          !candidate.model_used.trim())) ||
      (candidate.token_count !== undefined &&
        candidate.token_count !== null &&
        (typeof candidate.token_count !== 'number' ||
          !Number.isInteger(candidate.token_count) ||
          candidate.token_count < 0))
    ) {
      throw this.buildInvalidGymChatResponseException();
    }
  }

  private normalizeProviderSources(value: string[]): string[] {
    const allowedSources = new Set([
      'gym_profile',
      'operating_hours',
      'membership_plans',
      'special_schedules',
      'faq',
      'conversation_history',
    ]);
    const normalized = value.map((source) =>
      source.trim().toLowerCase() === 'gym_identity'
        ? 'gym_profile'
        : source.trim().toLowerCase(),
    );
    if (normalized.some((source) => !allowedSources.has(source))) {
      throw this.buildInvalidGymChatResponseException();
    }

    return [
      ...new Set(
        normalized,
      ),
    ];
  }

  private normalizeGroundedSources(
    value: Prisma.JsonValue | null,
  ): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const allowedSources = new Set([
      'gym_profile',
      'operating_hours',
      'membership_plans',
      'special_schedules',
      'faq',
      'conversation_history',
    ]);
    const normalized = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((source) =>
        source.trim().toLowerCase() === 'gym_identity'
          ? 'gym_profile'
          : source.trim().toLowerCase(),
      )
      .filter((source) => allowedSources.has(source));
    return [...new Set(normalized)];
  }

  private formatGymDateOnly(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Manila',
      year: 'numeric',
    }).formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  }

  private formatTime(value: Date): string {
    return value.toISOString().slice(11, 16);
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private buildInvalidGymChatResponseException(): HttpException {
    return new HttpException(
      {
        type: 'BAD_GATEWAY',
        title: 'Invalid Gym Chat Response',
        status: 502,
        detail: 'The AI gym-chat service returned an invalid payload.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private isInvalidGymChatResponseError(error: unknown): boolean {
    if (!(error instanceof HttpException) || error.getStatus() !== 502) {
      return false;
    }

    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'title' in response &&
      (response as { title?: unknown }).title === 'Invalid Gym Chat Response'
    );
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

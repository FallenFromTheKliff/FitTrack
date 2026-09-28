import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';

import type {
  BusinessAnalyticsInsightRequest,
  BusinessAnalyticsInsightResponse,
} from '../ai/ai-python-client.service';
import {
  BaseRepository,
  type PaginatedResult,
} from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';
import type { BusinessInsightFilterDTO } from './dto/business-analytics-insight.dto';

const BUSINESS_INSIGHT_RUN_INCLUDE = {
  requester: {
    select: {
      id: true,
      role: true,
      status: true,
      profile: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
  },
} satisfies Prisma.BusinessInsightRunInclude;

export type BusinessInsightRunRequester = {
  id: string;
  role: UserRole;
  status: UserStatus;
  profile: {
    first_name: string;
    last_name: string;
  } | null;
};

export type BusinessInsightRunRecord = Prisma.BusinessInsightRunGetPayload<{
  include: typeof BUSINESS_INSIGHT_RUN_INCLUDE;
}>;

export interface CreateBusinessInsightRunInput {
  requestedBy: string;
  requestPayload: BusinessAnalyticsInsightRequest;
  insightPayload: BusinessAnalyticsInsightResponse;
  latencyMs: number;
}

@Injectable()
export class BusinessInsightRunRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  createInsightRun(
    input: CreateBusinessInsightRunInput,
  ): Promise<BusinessInsightRunRecord> {
    const window = input.requestPayload.grounding.window;
    const data: Prisma.BusinessInsightRunUncheckedCreateInput = {
      requested_by: input.requestedBy,
      focus: window.focus,
      period: window.period,
      start_date: this.toDateOnlyDate(window.start_date),
      end_date: this.toDateOnlyDate(window.end_date),
      request_payload: input.requestPayload as Prisma.InputJsonValue,
      insight_payload: input.insightPayload as Prisma.InputJsonValue,
      model_used: input.insightPayload.model_used ?? null,
      token_count: input.insightPayload.token_count ?? null,
      latency_ms: input.latencyMs,
    };

    return this.create<BusinessInsightRunRecord>(
      this.prisma.businessInsightRun,
      data,
      BUSINESS_INSIGHT_RUN_INCLUDE,
    );
  }

  listInsightRuns(
    dto: BusinessInsightFilterDTO,
  ): Promise<PaginatedResult<BusinessInsightRunRecord>> {
    const where: Prisma.BusinessInsightRunWhereInput = {};

    if (dto.focus) {
      where.focus = dto.focus;
    }
    if (dto.period) {
      where.period = dto.period;
    }

    return this.paginate<BusinessInsightRunRecord>(
      this.prisma.businessInsightRun,
      {
        where,
        include: BUSINESS_INSIGHT_RUN_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findInsightRunByIdOrThrow(id: string): Promise<BusinessInsightRunRecord> {
    return this.findByIdOrThrow<BusinessInsightRunRecord>(
      this.prisma.businessInsightRun,
      id,
      'BusinessInsightRun',
      BUSINESS_INSIGHT_RUN_INCLUDE,
    );
  }

  findLatestPreviousInsightRun(
    currentCreatedAt: Date,
    currentId: string,
  ): Promise<BusinessInsightRunRecord | null> {
    return this.prisma.businessInsightRun.findFirst({
      where: {
        created_at: { lt: currentCreatedAt },
        id: { not: currentId },
      },
      include: BUSINESS_INSIGHT_RUN_INCLUDE,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
  }

  private toDateOnlyDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }
}

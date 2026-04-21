import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  BaseRepository,
  PaginatedResult,
  PaginationOptions,
} from '../common/base-repository/base-repository';
import { AuditActorResponseDTO, AuditLogResponseDTO } from './dto/audit.dto';

// =============================================================================
// AuditEvent - emitted by any domain service after a sensitive mutation.
// Event name: 'audit.log'
// Fire-and-forget - never awaited by the emitting service.
// =============================================================================

export interface AuditEvent {
  userId: string | null; // actor (null = system / CRON)
  action: string; // e.g. USER_BANNED, PAYMENT_VERIFIED
  entity: string; // model name e.g. User, Payment
  entityId: string; // UUID of the affected record
  before?: Prisma.InputJsonValue; // snapshot before change
  after?: Prisma.InputJsonValue; // snapshot after change
  ipAddress?: string;
}

// =============================================================================
// Audit Action Constants
// Import these in domain services to avoid magic strings.
// =============================================================================

export const AuditAction = {
  // S2 - Auth
  USER_CREATED: 'USER_CREATED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PHONE_VERIFIED: 'PHONE_VERIFIED',
  GOOGLE_LINKED: 'GOOGLE_LINKED',

  // S3 - Users
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',

  // S4 - Payments
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',

  // S4 - Subscriptions
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_SUSPENDED: 'SUBSCRIPTION_SUSPENDED',

  // S5 - Bookings
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',

  // S6 - Coaching
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  COACH_COMMISSION_CHANGED: 'COACH_COMMISSION_CHANGED',

  // S10 - Inventory
  EQUIPMENT_WRITEOFF: 'EQUIPMENT_WRITEOFF',
  PRODUCT_RESTOCKED: 'PRODUCT_RESTOCKED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// =============================================================================
// AuditFilterOptions - passed from controller to service
// =============================================================================

export interface AuditFilterOptions extends PaginationOptions {
  entity?: string;
  entity_id?: string;
  user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
}

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { include: { profile: true } } };
}>;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return 'Unknown audit logging error';
}

// =============================================================================
// AuditService
// =============================================================================

@Injectable()
export class AuditService extends BaseRepository {
  private readonly logger = new Logger(AuditService.name);

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  @OnEvent('audit.log', { async: true })
  async handleAuditEvent(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: event.userId ?? null,
          action: event.action,
          entity: event.entity,
          entity_id: event.entityId,
          before: event.before ?? undefined,
          after: event.after ?? undefined,
          ip_address: event.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log [${event.action}] on ${event.entity}:${event.entityId}`,
        formatError(error),
      );
    }
  }

  async getAuditLogs(
    options: AuditFilterOptions,
  ): Promise<PaginatedResult<AuditLogResponseDTO>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (options.entity) {
      where.entity = options.entity;
    }
    if (options.entity_id) {
      where.entity_id = options.entity_id;
    }
    if (options.user_id) {
      where.user_id = options.user_id;
    }
    if (options.action) {
      where.action = options.action;
    }

    if (options.start_date || options.end_date) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (options.start_date) {
        createdAt.gte = new Date(options.start_date);
      }
      if (options.end_date) {
        createdAt.lte = new Date(options.end_date);
      }
      where.created_at = createdAt;
    }

    const result = await this.paginate<AuditLogWithUser>(
      this.prisma.auditLog,
      {
        where,
        include: { user: { include: { profile: true } } },
        orderBy: { created_at: 'desc' },
      },
      { page: options.page, limit: options.limit },
    );

    return {
      data: result.data.map((auditLog) => this.toAuditLogResponse(auditLog)),
      meta: result.meta,
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogResponseDTO> {
    const auditLog = await this.findByIdOrThrow<AuditLogWithUser>(
      this.prisma.auditLog,
      id,
      'AuditLog',
      {
        user: { include: { profile: true } },
      },
    );

    return this.toAuditLogResponse(auditLog);
  }

  private toAuditLogResponse(auditLog: AuditLogWithUser): AuditLogResponseDTO {
    return {
      id: auditLog.id,
      user_id: auditLog.user_id,
      actor: auditLog.user ? this.toAuditActor(auditLog.user) : null,
      action: auditLog.action,
      entity: auditLog.entity,
      entity_id: auditLog.entity_id,
      before: auditLog.before ?? null,
      after: auditLog.after ?? null,
      ip_address: auditLog.ip_address,
      created_at: auditLog.created_at.toISOString(),
    };
  }

  private toAuditActor(
    user: NonNullable<AuditLogWithUser['user']>,
  ): AuditActorResponseDTO {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      profile: user.profile
        ? {
            first_name: user.profile.first_name,
            last_name: user.profile.last_name,
          }
        : null,
    };
  }
}

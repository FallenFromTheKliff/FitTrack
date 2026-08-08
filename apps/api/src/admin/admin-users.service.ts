import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  MembershipCardSource,
  NotificationType,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from 'prisma/prisma.service';
import { AuditAction, type AuditEvent } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACCOUNT_ACTIVITY_EVENT } from '../user/events/account-activity.event';
import {
  AdminUserFilterDto,
  UpdateMembershipCardDto,
  UpgradeToCoachDto,
} from './dto/admin.dto';

const MANUAL_MEMBERSHIP_GRANT_PRICE = new Prisma.Decimal(400);
const MANUALLY_VERIFIABLE_ACCOUNT_ROLES = new Set<UserRole>([
  UserRole.admin,
  UserRole.coach,
  UserRole.member,
  UserRole.staff,
]);

function normalizeOptionalBooleanFilter(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function canManuallyVerifyAccount(actingRole: UserRole, targetRole: UserRole) {
  if (!MANUALLY_VERIFIABLE_ACCOUNT_ROLES.has(targetRole)) {
    return false;
  }

  if (actingRole === UserRole.admin) {
    return true;
  }

  if (actingRole === UserRole.staff) {
    return targetRole !== UserRole.admin;
  }

  return false;
}

function getManualVerificationNotificationBody(role: UserRole) {
  if (role === UserRole.member) {
    return 'Your FitTrack account is verified. You can sign in as a non-member and subscribe when you are ready.';
  }

  return 'Your FitTrack team account is verified. You can sign in with your assigned role.';
}

function toFrontendRole(role: UserRole) {
  switch (role) {
    case UserRole.admin:
      return { id: 1, name: 'ADMIN' as const };
    case UserRole.staff:
      return { id: 2, name: 'STAFF' as const };
    case UserRole.coach:
      return { id: 3, name: 'COACH' as const };
    case UserRole.member:
    default:
      return { id: 4, name: 'USER' as const };
  }
}

function toFrontendMembershipType(role: UserRole) {
  return role === UserRole.member ? 'member' : null;
}

function toFrontendMembershipCard(
  role: UserRole,
  card: {
    activated_at: Date | null;
    purchased_at: Date;
    revoke_reason: string | null;
    revoked_at: Date | null;
    source: MembershipCardSource;
    status: 'active' | 'pending_verification' | 'revoked';
    updated_at: Date;
    verified_at: Date | null;
  } | null,
) {
  if (role !== UserRole.member) {
    return null;
  }

  return {
    activatedAt: card?.activated_at?.toISOString() ?? null,
    purchasedAt: card?.purchased_at.toISOString() ?? null,
    revokeReason: card?.revoke_reason ?? null,
    revokedAt: card?.revoked_at?.toISOString() ?? null,
    source: card?.source ?? null,
    status: card?.status ?? 'none',
    updatedAt: card?.updated_at.toISOString() ?? null,
    verifiedAt: card?.verified_at?.toISOString() ?? null,
  };
}

function getPreferredAccountEmail(
  identities?: Array<{
    identifier: string;
    is_primary?: boolean;
    provider: AuthProvider;
  }> | null,
) {
  if (!identities?.length) {
    return null;
  }

  return (
    identities.find(
      (identity) =>
        identity.provider === AuthProvider.email && identity.is_primary,
    )?.identifier ??
    identities.find((identity) => identity.provider === AuthProvider.email)
      ?.identifier ??
    identities.find((identity) => identity.provider === AuthProvider.google)
      ?.identifier ??
    null
  );
}

function getProfileDisplayName(
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null,
) {
  return [profile?.first_name, profile?.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();
}

function isQrCodeReady(qrCodeToken: string | null) {
  return typeof qrCodeToken === 'string' && qrCodeToken.trim() !== '';
}

function isAttendanceQrReady(
  role: UserRole,
  qrCodeToken: string | null,
  card: {
    status: 'active' | 'pending_verification' | 'revoked';
  } | null,
) {
  return (
    role === UserRole.member &&
    card?.status === 'active' &&
    isQrCodeReady(qrCodeToken)
  );
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async getAll(
    actingRole?: UserRole,
    filters: AdminUserFilterDto = {},
    actingUserId?: string,
  ) {
    const where = this.buildUserDirectoryWhere(
      actingRole,
      filters,
      actingUserId,
    );
    const users = await this.prisma.user.findMany({
      where,
      include: {
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
        attendance_logs: {
          select: {
            check_in_at: true,
          },
          orderBy: {
            check_in_at: 'desc',
          },
          take: 1,
        },
        membership_card: true,
        profile: true,
      },
      orderBy: { created_at: 'desc' },
    });
    const restoredAtByUserId =
      await this.getLatestAccountActivityTimestampsByUserId(
        users.map((user) => user.id),
        'account_restored',
      );

    return users.map((user) => {
      const primaryEmail =
        user.auth_identities.find(
          (identity) =>
            identity.provider === AuthProvider.email && identity.is_primary,
        ) ??
        user.auth_identities.find(
          (identity) => identity.provider === AuthProvider.email,
        );

      return {
        id: user.id,
        email: primaryEmail?.identifier ?? '',
        phone_no: user.profile?.phone ?? null,
        role: toFrontendRole(user.role),
        status: user.status,
        emailVerified: Boolean(user.email_verified_at),
        phoneVerified: false,
        deletedAt: user.deletedAt?.toISOString() ?? null,
        restoredAt: user.deletedAt
          ? null
          : (restoredAtByUserId.get(user.id)?.toISOString() ?? null),
        createdAt: user.created_at.toISOString(),
        lastCheckInAt:
          user.attendance_logs[0]?.check_in_at?.toISOString() ?? null,
        membershipCard: toFrontendMembershipCard(
          user.role,
          user.membership_card,
        ),
        qrCodeReady: isQrCodeReady(user.qr_code_token),
        attendanceQrReady: isAttendanceQrReady(
          user.role,
          user.qr_code_token,
          user.membership_card,
        ),
        updatedAt: user.updated_at.toISOString(),
        profile: user.profile
          ? {
              firstName: user.profile.first_name,
              lastName: user.profile.last_name,
              dateOfBirth: user.profile.date_of_birth?.toISOString() ?? null,
              gender: user.profile.gender ?? null,
              activityLevel: user.profile.activity_level ?? null,
              fitnessGoal: user.profile.fitness_goal ?? null,
              currentWeightKg:
                user.profile.weight_kg !== null
                  ? Number(user.profile.weight_kg)
                  : null,
              heightCm:
                user.profile.height_cm !== null
                  ? Number(user.profile.height_cm)
                  : null,
              avatarUrl: user.profile.avatar_url ?? null,
              membershipType: toFrontendMembershipType(user.role),
            }
          : null,
      };
    });
  }

  private buildUserDirectoryWhere(
    actingRole: UserRole | undefined,
    filters: AdminUserFilterDto,
    actingUserId?: string,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const andFilters: Prisma.UserWhereInput[] = [];
    const requestedRole =
      actingRole === UserRole.coach ? UserRole.member : filters.role;

    if (requestedRole) {
      where.role = requestedRole;
    }

    if (actingRole === UserRole.staff) {
      andFilters.push({ role: { not: UserRole.admin } });
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const archivedFilter = normalizeOptionalBooleanFilter(filters.archived);
    if (archivedFilter !== undefined) {
      where.deletedAt = archivedFilter ? { not: null } : null;
    }

    if (actingRole === UserRole.coach && actingUserId) {
      andFilters.push({
        member_appointments: {
          some: {
            coach: {
              user_id: actingUserId,
            },
          },
        },
      });
    }

    if (filters.activityLevel) {
      andFilters.push({
        profile: {
          is: {
            activity_level: filters.activityLevel,
          },
        },
      });
    }

    if (filters.membershipStatus === 'active') {
      andFilters.push({
        subscriptions: {
          some: {
            status: 'active',
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
        },
      });
    } else if (filters.membershipStatus === 'expired') {
      andFilters.push({
        subscriptions: {
          some: {
            OR: [{ status: 'expired' }, { expires_at: { lt: new Date() } }],
          },
        },
      });
      andFilters.push({
        subscriptions: {
          none: {
            status: 'active',
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
        },
      });
    }

    if (filters.sessionStatus === 'has_upcoming') {
      andFilters.push({
        member_appointments: {
          some: {
            ...(actingRole === UserRole.coach && actingUserId
              ? { coach: { user_id: actingUserId } }
              : {}),
            scheduled_at: { gte: new Date() },
            status: { in: ['pending_coach', 'pending_payment', 'confirmed'] },
          },
        },
      });
    } else if (filters.sessionStatus === 'no_upcoming') {
      andFilters.push({
        member_appointments: {
          none: {
            ...(actingRole === UserRole.coach && actingUserId
              ? { coach: { user_id: actingUserId } }
              : {}),
            scheduled_at: { gte: new Date() },
            status: { in: ['pending_coach', 'pending_payment', 'confirmed'] },
          },
        },
      });
    }

    const search = filters.search?.trim();
    const normalizedNameSearch = search?.replace(/\s+/g, ' ');
    if (search) {
      const nameTokens = normalizedNameSearch?.split(' ') ?? [];
      where.OR = [
        {
          AND: nameTokens.map((token) => ({
            OR: [
              {
                profile: {
                  first_name: { contains: token, mode: 'insensitive' },
                },
              },
              {
                profile: {
                  last_name: { contains: token, mode: 'insensitive' },
                },
              },
            ],
          })),
        },
        {
          auth_identities: {
            some: {
              identifier: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            phone: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    switch (filters.tier) {
      case 'active_member':
        where.role = UserRole.member;
        where.status = UserStatus.active;
        where.membership_card = { is: { status: 'active' } };
        break;
      case 'pending_membership':
        where.role = UserRole.member;
        where.membership_card = {
          is: { status: 'pending_verification' },
        };
        break;
      case 'pending_verification':
        where.role = UserRole.member;
        where.status = UserStatus.pending;
        break;
      case 'revoked':
        where.role = UserRole.member;
        where.membership_card = { is: { status: 'revoked' } };
        break;
      case 'verified_non_member':
        where.role = UserRole.member;
        where.status = UserStatus.active;
        where.membership_card = { is: null };
        break;
      default:
        break;
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    return where;
  }

  async updateMembershipCard(
    userId: string,
    dto: UpdateMembershipCardDto,
    actingUserId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        qr_code_token: true,
        deletedAt: true,
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
        },
        membership_card: {
          select: {
            activated_at: true,
            id: true,
            purchased_at: true,
            source: true,
            status: true,
            verified_at: true,
          },
        },
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException(
        'Archived users cannot have membership-card access changed',
      );
    }

    if (user.role !== UserRole.member) {
      throw new BadRequestException(
        'Membership cards only apply to member accounts',
      );
    }

    if (user.status === UserStatus.pending) {
      throw new BadRequestException(
        'Pending verification accounts must be verified as non-members before membership-card access can be changed',
      );
    }

    if (dto.action === 'grant') {
      const now = new Date();
      const isRestore = user.membership_card?.status === 'revoked';
      const isFirstManualGrant = !user.membership_card;
      const source = isRestore
        ? MembershipCardSource.admin_repair
        : (user.membership_card?.source ??
          dto.source ??
          MembershipCardSource.admin_grant);
      const activatedAt = user.membership_card?.activated_at ?? now;

      const { completedPayment, membershipCard } =
        await this.prisma.$transaction(async (tx) => {
          const updatedCard = await tx.membershipCard.upsert({
            where: { user_id: userId },
            create: {
              user: { connect: { id: userId } },
              status: 'active',
              source,
              verified_at: now,
              verified_by: actingUserId,
              activated_at: now,
            },
            update: {
              status: 'active',
              source,
              verified_at: now,
              verified_by: actingUserId,
              activated_at: activatedAt,
              revoked_at: null,
              revoked_by: null,
              revoke_reason: null,
            },
          });

          if (user.status === UserStatus.pending || !user.qr_code_token) {
            await tx.user.update({
              where: { id: userId },
              data: {
                ...(user.status === UserStatus.pending
                  ? { status: UserStatus.active }
                  : {}),
                ...(!user.qr_code_token
                  ? { qr_code_token: randomBytes(32).toString('hex') }
                  : {}),
              },
            });
          }

          const latestOpenPayment = await tx.payment.findFirst({
            where: {
              payable_id: updatedCard.id,
              payable_type: PayableType.membership_card,
              status: {
                in: [
                  PaymentStatus.pending,
                  PaymentStatus.processing,
                  PaymentStatus.awaiting_verification,
                ],
              },
            },
            orderBy: { created_at: 'desc' },
          });

          const settledPayment = latestOpenPayment
            ? await tx.payment.update({
                where: { id: latestOpenPayment.id },
                data: {
                  rejection_reason: null,
                  status: PaymentStatus.completed,
                  verified_at: now,
                  verified_by: actingUserId,
                },
              })
            : isFirstManualGrant
              ? await tx.payment.create({
                  data: {
                    amount: MANUAL_MEMBERSHIP_GRANT_PRICE,
                    idempotency_key: `admin-grant:${updatedCard.id}`,
                    payable_id: updatedCard.id,
                    payable_type: PayableType.membership_card,
                    payment_stage: PaymentStage.full,
                    provider: PaymentProvider.cash,
                    status: PaymentStatus.completed,
                    user: { connect: { id: userId } },
                    verifier: { connect: { id: actingUserId } },
                    verified_at: now,
                  },
                })
              : null;

          return {
            completedPayment: settledPayment,
            membershipCard: updatedCard,
          };
        });

      await this.emitAccountActivity({
        action: 'membership_card_granted',
        actorId: actingUserId,
        targetEmail: getPreferredAccountEmail(user.auth_identities),
        targetName: getProfileDisplayName(user.profile),
        targetRole: user.role,
        targetUserId: user.id,
      });

      if (completedPayment) {
        await this.emitAccountActivity({
          action: 'payment_approved',
          actorId: actingUserId,
          details: {
            amount: completedPayment.amount.toString(),
            payable_id: completedPayment.payable_id,
            payable_type: completedPayment.payable_type,
            payment_id: completedPayment.id,
          },
          occurredAt: now.toISOString(),
          targetEmail: getPreferredAccountEmail(user.auth_identities),
          targetName: getProfileDisplayName(user.profile),
          targetRole: user.role,
          targetUserId: user.id,
        });
      }

      return {
        membershipCard: toFrontendMembershipCard(user.role, membershipCard),
        message: 'Membership card access granted.',
      };
    }

    if (!user.membership_card) {
      throw new NotFoundException('Membership card not found');
    }

    const membershipCard = await this.prisma.membershipCard.update({
      where: { user_id: userId },
      data: {
        status: 'revoked',
        revoked_at: new Date(),
        revoked_by: actingUserId,
        revoke_reason: dto.reason?.trim() || null,
      },
    });

    await this.emitAccountActivity({
      action: 'membership_card_revoked',
      actorId: actingUserId,
      details: {
        reason: dto.reason?.trim() || null,
      },
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetName: getProfileDisplayName(user.profile),
      targetRole: user.role,
      targetUserId: user.id,
    });

    return {
      membershipCard: toFrontendMembershipCard(user.role, membershipCard),
      message: 'Membership card access revoked.',
    };
  }

  async softDeleteUser(
    userId: string,
    actingUserId: string,
    actingRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
        membership_card: {
          select: {
            id: true,
            status: true,
          },
        },
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
        },
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('User is already archived');
    }

    if (user.id === actingUserId) {
      throw new BadRequestException(
        'You cannot archive your own account from the members directory',
      );
    }

    if (user.role === UserRole.admin) {
      throw new BadRequestException(
        'Admin accounts cannot be archived from the members directory',
      );
    }

    if (user.status === UserStatus.pending) {
      throw new BadRequestException(
        'Pending verification accounts must be verified before they can be archived',
      );
    }

    if (actingRole === UserRole.staff && user.role !== UserRole.member) {
      throw new ForbiddenException(
        'Staff accounts can archive member accounts only',
      );
    }

    const archivedAt = new Date();
    const deleted = await this.prisma.$transaction(async (tx) => {
      const archivedUser = await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: archivedAt,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (
        user.role === UserRole.member &&
        user.membership_card &&
        user.membership_card.status !== 'revoked'
      ) {
        await tx.membershipCard.update({
          where: { user_id: userId },
          data: {
            status: 'revoked',
            revoked_at: archivedAt,
            revoked_by: actingUserId,
            revoke_reason: 'Automatically revoked when account was archived.',
          },
        });
      }

      return archivedUser;
    });

    await this.emitAccountActivity({
      action: 'account_archived',
      actorId: actingUserId,
      occurredAt: archivedAt.toISOString(),
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetName: getProfileDisplayName(user.profile),
      targetRole: user.role,
      targetUserId: user.id,
    });

    if (
      user.role === UserRole.member &&
      user.membership_card &&
      user.membership_card.status !== 'revoked'
    ) {
      await this.emitAccountActivity({
        action: 'membership_card_revoked',
        actorId: actingUserId,
        details: {
          reason: 'Automatically revoked when account was archived.',
        },
        occurredAt: archivedAt.toISOString(),
        targetEmail: getPreferredAccountEmail(user.auth_identities),
        targetName: getProfileDisplayName(user.profile),
        targetRole: user.role,
        targetUserId: user.id,
      });
    }

    return {
      message: 'User archived successfully',
      user: deleted,
    };
  }

  async restoreUser(
    userId: string,
    actingUserId: string,
    actingRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        membership_card: {
          select: {
            activated_at: true,
            id: true,
            purchased_at: true,
            revoked_at: true,
            revoke_reason: true,
            status: true,
            verified_at: true,
          },
        },
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
        },
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actingUserId) {
      throw new BadRequestException(
        'You cannot restore your own account from the members directory',
      );
    }

    if (user.role === UserRole.admin) {
      throw new BadRequestException(
        'Admin accounts cannot be restored from the members directory',
      );
    }

    if (actingRole === UserRole.staff && user.role !== UserRole.member) {
      throw new ForbiddenException(
        'Staff accounts can restore member and non-member accounts only',
      );
    }

    const pendingRequest = await this.prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: AccountDeletionRequestStatus.pending,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (!user.deletedAt && !pendingRequest) {
      throw new BadRequestException('User is already active');
    }

    const restoredAt = new Date();
    const wasAutoRevokedByArchive =
      user.role === UserRole.member &&
      Boolean(user.deletedAt) &&
      user.membership_card?.status === 'revoked' &&
      user.membership_card.revoke_reason ===
        'Automatically revoked when account was archived.' &&
      Boolean(user.membership_card.revoked_at) &&
      Math.abs(
        user.membership_card.revoked_at!.getTime() - user.deletedAt!.getTime(),
      ) <= 60_000;

    const restoredUser = await this.prisma.$transaction(async (tx) => {
      if (pendingRequest) {
        await tx.accountDeletionRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: AccountDeletionRequestStatus.cancelled,
            reviewNotes: 'Cancelled by account restore',
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: null,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (wasAutoRevokedByArchive && user.membership_card) {
        await tx.membershipCard.update({
          where: { id: user.membership_card.id },
          data: {
            status: 'active',
            activated_at: user.membership_card.activated_at ?? restoredAt,
            verified_at: restoredAt,
            verified_by: actingUserId,
            revoked_at: null,
            revoked_by: null,
            revoke_reason: null,
          },
        });
      }

      return updatedUser;
    });

    await this.emitAccountActivity({
      action: 'account_restored',
      actorId: actingUserId,
      occurredAt: restoredAt.toISOString(),
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetName: getProfileDisplayName(user.profile),
      targetRole: user.role,
      targetUserId: user.id,
    });

    if (wasAutoRevokedByArchive) {
      await this.emitAccountActivity({
        action: 'membership_card_granted',
        actorId: actingUserId,
        details: {
          reason: 'Automatically restored when account was unarchived.',
        },
        occurredAt: restoredAt.toISOString(),
        targetEmail: getPreferredAccountEmail(user.auth_identities),
        targetName: getProfileDisplayName(user.profile),
        targetRole: user.role,
        targetUserId: user.id,
      });
    }

    return {
      message: 'User restored successfully',
      user: {
        id: restoredUser.id,
        deletedAt: restoredUser.deletedAt?.toISOString() ?? null,
        restoredAt: restoredAt.toISOString(),
        membershipCardRestored: wasAutoRevokedByArchive,
      },
    };
  }

  upgradeToCoach(dto: UpgradeToCoachDto, actingUserId: string) {
    void dto;
    void actingUserId;
    throw new BadRequestException(
      'Coach user accounts are no longer supported. Create standalone coach profiles from Gym Operations instead.',
    );
  }

  async verifyNonMember(
    userId: string,
    actingUserId: string,
    actingRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        auth_identities: {
          select: {
            identifier: true,
            is_primary: true,
            provider: true,
          },
        },
        deletedAt: true,
        email_verified_at: true,
        membership_card: {
          select: {
            status: true,
          },
        },
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === actingUserId) {
      throw new ForbiddenException(
        'You cannot manually verify your own account',
      );
    }

    if (user.deletedAt) {
      throw new BadRequestException('Archived users cannot be verified');
    }

    if (!MANUALLY_VERIFIABLE_ACCOUNT_ROLES.has(user.role)) {
      throw new BadRequestException(
        'Only pending member and team accounts can be manually verified',
      );
    }

    if (!canManuallyVerifyAccount(actingRole, user.role)) {
      throw new ForbiddenException(
        actingRole === UserRole.staff
          ? 'Staff accounts cannot manually verify admin accounts'
          : 'You do not have permission to manually verify this account',
      );
    }

    if (user.status !== UserStatus.pending) {
      throw new BadRequestException(
        'Only pending verification accounts can be manually verified',
      );
    }

    if (user.membership_card?.status === 'active') {
      throw new BadRequestException(
        'This account already has active membership-card access',
      );
    }

    const now = new Date();
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          email_verified_at: user.email_verified_at ?? now,
          status: UserStatus.active,
        },
        select: {
          email_verified_at: true,
          id: true,
          status: true,
        },
      });

      await tx.authIdentity.updateMany({
        where: {
          provider: AuthProvider.email,
          user_id: userId,
          verified_at: null,
        },
        data: { verified_at: now },
      });

      return updated;
    });

    this.emitAudit({
      userId: actingUserId,
      action: AuditAction.USER_STATUS_CHANGED,
      entity: 'User',
      entityId: userId,
      before: {
        email_verified_at: user.email_verified_at?.toISOString() ?? null,
        status: user.status,
      },
      after: {
        email_verified_at: updatedUser.email_verified_at?.toISOString() ?? null,
        role: user.role,
        status: updatedUser.status,
        verification: 'manual',
      },
    });

    await this.emitAccountActivity({
      action: 'account_verified_non_member',
      actorId: actingUserId,
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetName: getProfileDisplayName(user.profile),
      targetRole: user.role,
      targetUserId: user.id,
    });

    const verificationBody = getManualVerificationNotificationBody(user.role);

    await this.notificationsService?.dispatch(
      user.id,
      NotificationType.system,
      {
        title: 'Account verified',
        body: verificationBody,
        data: {
          kind: 'account_verified_non_member',
          role: user.role,
          verified_at: now.toISOString(),
          verification: 'manual',
        },
        email: {
          subject: 'Your FitTrack account is verified',
          html: `<p>${verificationBody}</p>`,
        },
      },
    );

    return {
      message: 'Account manually verified.',
      user: {
        emailVerified: true,
        id: updatedUser.id,
        status: updatedUser.status,
      },
    };
  }

  private async emitAccountActivity(event: {
    action:
      | 'account_archived'
      | 'account_restored'
      | 'account_verified_non_member'
      | 'coach_upgraded'
      | 'membership_card_granted'
      | 'membership_card_revoked'
      | 'payment_approved';
    actorId: string;
    details?: Record<string, boolean | number | string | null>;
    occurredAt?: string;
    targetEmail?: string | null;
    targetName?: string | null;
    targetRole?: UserRole | null;
    targetUserId: string;
  }) {
    await this.eventEmitter?.emitAsync(ACCOUNT_ACTIVITY_EVENT, {
      ...event,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    });
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter?.emit('audit.log', event);
  }

  private async getLatestAccountActivityTimestampsByUserId(
    userIds: string[],
    action: 'account_archived' | 'account_restored',
  ) {
    if (userIds.length === 0) {
      return new Map<string, Date>();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ occurredAt: Date; targetUserId: string }>
    >(Prisma.sql`
      SELECT
        (data->>'target_user_id') AS "targetUserId",
        MAX(COALESCE((data->>'occurred_at')::timestamptz, created_at)) AS "occurredAt"
      FROM notifications
      WHERE
        data->>'kind' = 'account_activity'
        AND data->>'action' = ${action}
        AND data->>'target_user_id' IN (${Prisma.join(
          userIds.map((userId) => Prisma.sql`${userId}`),
        )})
      GROUP BY data->>'target_user_id'
    `);

    return new Map(
      rows
        .filter(
          (
            row,
          ): row is {
            occurredAt: Date;
            targetUserId: string;
          } => Boolean(row.targetUserId && row.occurredAt),
        )
        .map((row) => [row.targetUserId, new Date(row.occurredAt)]),
    );
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  MembershipCardSource,
  UserRole,
} from '@prisma/client';

import { PrismaService } from 'prisma/prisma.service';
import { ACCOUNT_ACTIVITY_EVENT } from '../user/events/account-activity.event';
import { UpdateMembershipCardDto, UpgradeToCoachDto } from './dto/admin.dto';

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
  ) {}

  async getAll() {
    const users = await this.prisma.user.findMany({
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
        emailVerified: Boolean(user.email_verified_at),
        phoneVerified: false,
        deletedAt: user.deletedAt?.toISOString() ?? null,
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
            id: true,
            source: true,
            status: true,
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

    if (dto.action === 'grant') {
      const now = new Date();
      const source =
        dto.source ??
        (user.membership_card
          ? MembershipCardSource.admin_repair
          : MembershipCardSource.admin_grant);

      const membershipCard = await this.prisma.membershipCard.upsert({
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
          activated_at: now,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        },
      });

      this.emitAccountActivity({
        action: 'membership_card_granted',
        actorId: actingUserId,
        targetEmail: getPreferredAccountEmail(user.auth_identities),
        targetRole: user.role,
        targetUserId: user.id,
      });

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

    this.emitAccountActivity({
      action: 'membership_card_revoked',
      actorId: actingUserId,
      details: {
        reason: dto.reason?.trim() || null,
      },
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetRole: user.role,
      targetUserId: user.id,
    });

    return {
      membershipCard: toFrontendMembershipCard(user.role, membershipCard),
      message: 'Membership card access revoked.',
    };
  }

  async softDeleteUser(userId: string, actingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
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

    const deleted = await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    this.emitAccountActivity({
      action: 'account_archived',
      actorId: actingUserId,
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetRole: user.role,
      targetUserId: user.id,
    });

    return {
      message: 'User archived successfully',
      user: deleted,
    };
  }

  async restoreUser(userId: string, actingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
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

    const restoredUser = await this.prisma.$transaction(async (tx) => {
      if (pendingRequest) {
        await tx.accountDeletionRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: AccountDeletionRequestStatus.cancelled,
            reviewNotes: 'Cancelled by admin restore',
          },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: null,
        },
        select: {
          id: true,
          deletedAt: true,
        },
      });
    });

    this.emitAccountActivity({
      action: 'account_restored',
      actorId: actingUserId,
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetRole: user.role,
      targetUserId: user.id,
    });

    return {
      message: 'User restored successfully',
      user: {
        id: restoredUser.id,
        deletedAt: restoredUser.deletedAt?.toISOString() ?? null,
      },
    };
  }

  async upgradeToCoach(dto: UpgradeToCoachDto, actingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('Deleted users cannot be upgraded');
    }

    if (user.role === UserRole.admin) {
      throw new BadRequestException(
        'Admin accounts cannot be upgraded to coach',
      );
    }

    const existingCoachProfile = await this.prisma.coachProfile.findUnique({
      where: { user_id: dto.userId },
      select: { id: true },
    });

    if (user.role === UserRole.coach || existingCoachProfile) {
      throw new ConflictException('User is already a coach');
    }

    const coachProfile = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dto.userId },
        data: { role: UserRole.coach },
      });

      return tx.coachProfile.create({
        data: {
          user_id: dto.userId,
          specialization: dto.specialties.join(', '),
          bio: dto.bio?.trim() || null,
          certification:
            dto.certifications && dto.certifications.length > 0
              ? dto.certifications.join(', ')
              : null,
          hourly_rate: dto.hourlyRate,
        },
      });
    });

    this.emitAccountActivity({
      action: 'coach_upgraded',
      actorId: actingUserId,
      targetEmail: getPreferredAccountEmail(user.auth_identities),
      targetRole: UserRole.coach,
      targetUserId: dto.userId,
    });

    return {
      message: 'User upgraded to coach successfully',
      coach: {
        id: coachProfile.id,
        userId: dto.userId,
      },
    };
  }

  private emitAccountActivity(event: {
    action:
      | 'account_archived'
      | 'account_restored'
      | 'coach_upgraded'
      | 'membership_card_granted'
      | 'membership_card_revoked';
    actorId: string;
    details?: Record<string, boolean | number | string | null>;
    targetEmail?: string | null;
    targetRole?: UserRole | string | null;
    targetUserId: string;
  }) {
    this.eventEmitter?.emit(ACCOUNT_ACTIVITY_EVENT, {
      ...event,
      occurredAt: new Date().toISOString(),
    });
  }
}

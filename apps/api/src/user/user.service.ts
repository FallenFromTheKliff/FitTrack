import {
  Injectable,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  Prisma,
} from '@prisma/client';

import { FilesService } from '../files/files.service';
import type { UploadedImageFile } from '../files/files.types';
import { UserRepository } from './user.repository';
import { AuditAction, AuditEvent } from '../audit/audit.service';
import { assertValidMemberDateOfBirth } from '../common/validators';
import {
  UpdateProfileDTO,
  LogProgressDTO,
  DateRangeDTO,
  UserFilterDTO,
  UpdateUserStatusDTO,
  ScanQrDTO,
  ManualAttendanceCheckInDTO,
  AttendanceFilterDTO,
  UpdatePhoneDTO,
  CreateAppFeedbackDTO,
} from './dto/user-dto';
import { CreateDeletionRequestDto } from './dto/deletion-request.dto';
import { ACCOUNT_ACTIVITY_EVENT } from './events/account-activity.event';
import { ActivityLevelService } from './activity-level.service';

const PROFILE_DIRECT_FIELDS = [
  'first_name',
  'last_name',
  'avatar_url',
  'gender',
  'weight_kg',
  'height_cm',
  'activity_level',
  'fitness_goal',
] as const;

const MEASUREMENT_FIELDS = [
  'weight_kg',
  'height_cm',
  'body_fat_pct',
  'muscle_mass_kg',
  'waist_cm',
  'chest_cm',
] as const;

const ATTENDANCE_QR_TTL_MS = 15 * 60 * 1000;
const ATTENDANCE_QR_REFRESH_COOLDOWN_MS = 90 * 1000;

function createAttendanceQrToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function getAttendanceQrExpiresAt(date = new Date()) {
  return new Date(date.getTime() + ATTENDANCE_QR_TTL_MS);
}

function getAttendanceQrRefreshAvailableAt(rotatedAt: Date | null | undefined) {
  if (!rotatedAt) return null;
  return new Date(rotatedAt.getTime() + ATTENDANCE_QR_REFRESH_COOLDOWN_MS);
}

function toIsoStringOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toDateOnlyOrNull(value: unknown): string | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : null;

  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  ) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

type ProfileResponseSource = {
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  activity_level: unknown;
  fitness_goal: unknown;
  date_of_birth: unknown;
  weight_kg: unknown;
  height_cm: unknown;
};

function toCanonicalProfileResponse<T extends ProfileResponseSource>(
  profile: T,
): T & {
  activityLevel: T['activity_level'] | null;
  avatarUrl: string | null;
  currentWeightKg: number | null;
  dateOfBirth: string | null;
  fitnessGoal: T['fitness_goal'] | null;
  firstName: string;
  heightCm: number | null;
  lastName: string;
} {
  const firstName =
    typeof profile.first_name === 'string' ? profile.first_name.trim() : '';
  const lastName =
    typeof profile.last_name === 'string' ? profile.last_name.trim() : '';
  const phone = typeof profile.phone === 'string' ? profile.phone.trim() : null;

  return {
    ...profile,
    first_name: firstName,
    last_name: lastName,
    phone,
    activityLevel: profile.activity_level ?? null,
    avatarUrl: profile.avatar_url ?? null,
    currentWeightKg: toNumberOrNull(profile.weight_kg),
    dateOfBirth: toDateOnlyOrNull(profile.date_of_birth),
    fitnessGoal: profile.fitness_goal ?? null,
    firstName,
    heightCm: toNumberOrNull(profile.height_cm),
    lastName,
  } as T & {
    activityLevel: T['activity_level'] | null;
    avatarUrl: string | null;
    currentWeightKg: number | null;
    dateOfBirth: string | null;
    fitnessGoal: T['fitness_goal'] | null;
    firstName: string;
    heightCm: number | null;
    lastName: string;
  };
}

function getUserDisplayName(profile?: {
  first_name?: string | null;
  last_name?: string | null;
} | null) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown user';
}

export interface GamificationParticipantProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface GamificationNotificationTarget {
  user_id: string;
  display_name: string;
  email: string | null;
  rank_up_email_enabled: boolean;
}

export interface NotificationDispatchContext {
  user_id: string;
  preferred_email: string | null;
  preferred_phone: string | null;
  phone_verified_at: Date | null;
}

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      result[key] = value as T[K];
    }
  }

  return result;
}

function getIdentityIdentifier(
  identities: Array<{
    provider: AuthProvider;
    identifier: string;
    verified_at: Date | null;
    is_primary: boolean;
  }>,
  providers: readonly AuthProvider[],
) {
  return (
    identities.find((identity) => providers.includes(identity.provider))
      ?.identifier ?? null
  );
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly repo: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly filesService: FilesService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.repo.findUserAggregateOrThrow(userId);
    const profile = toCanonicalProfileResponse(user.profile);
    const email =
      getIdentityIdentifier(user.auth_identities, [
        AuthProvider.email,
        AuthProvider.google,
      ]) ?? '';
    const phone = profile.phone;
    const hasQrCodeToken =
      typeof user.qr_code_token === 'string' &&
      user.qr_code_token.trim() !== '';
    const hasActiveMembershipCard = user.membership_card?.status === 'active';
    const qrCodeReady = hasQrCodeToken;
    const attendanceQrReady = hasActiveMembershipCard && hasQrCodeToken;

    return {
      ...user,
      profile,
      email,
      phone,
      phone_no: phone,
      hasAcceptedPrivacy: user.has_accepted_privacy,
      privacyAcceptedAt: user.privacy_accepted_at?.toISOString() ?? null,
      qrCodeReady,
      attendanceQrReady,
      emailVerified:
        user.email_verified_at !== null ||
        user.auth_identities.some(
          (identity) =>
            (identity.provider === AuthProvider.email ||
              identity.provider === AuthProvider.google) &&
            identity.verified_at !== null,
        ),
      phoneVerified: false,
    };
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDTO) {
    await this.repo.findUserByIdOrThrow(userId);
    const profile = await this.updateExistingUserProfile(userId, dto);
    return toCanonicalProfileResponse(profile);
  }

  async acceptPrivacyPolicy(userId: string) {
    const acceptedAt = new Date();
    const user = await this.repo.updateUser(userId, {
      has_accepted_privacy: true,
      privacy_accepted_at: acceptedAt,
    });

    return {
      hasAcceptedPrivacy: user.has_accepted_privacy,
      privacyAcceptedAt: user.privacy_accepted_at?.toISOString() ?? null,
    };
  }

  async submitAppFeedback(userId: string, dto: CreateAppFeedbackDTO) {
    await this.repo.findUserByIdOrThrow(userId);

    return this.repo.createAppFeedback({
      user: { connect: { id: userId } },
      category: dto.category ?? 'general_feedback',
      message: dto.message,
    });
  }

  async listAppFeedback() {
    const feedback = await this.repo.listAppFeedback();

    return feedback.map((entry) => ({
      created_at: entry.created_at.toISOString(),
      category: entry.category,
      id: entry.id,
      message: entry.message,
      submitted_by: {
        id: entry.user.id,
        name: getUserDisplayName(entry.user.profile),
        role: entry.user.role,
      },
      updated_at: entry.updated_at.toISOString(),
    }));
  }

  async getDeletionRequestStatus(userId: string) {
    const user = await this.repo.findUserByIdOrThrow(userId);
    const request = await this.repo.findLatestDeletionRequest(userId);
    const latestStatus = request?.status ?? null;

    if (
      user.deletedAt === null &&
      latestStatus === AccountDeletionRequestStatus.approved
    ) {
      return {
        status: null,
      };
    }

    return {
      status: latestStatus,
    };
  }

  async requestDeletion(userId: string, dto: CreateDeletionRequestDto) {
    const user = await this.repo.findUserByIdOrThrow(userId);

    if (user.deletedAt) {
      throw new BadRequestException('User account is already deleted');
    }

    const pending = await this.repo.findPendingDeletionRequestByUserId(userId);

    if (pending) {
      throw new ConflictException('Deletion request is already pending');
    }

    const request = await this.repo.createDeletionRequest({
      user: { connect: { id: userId } },
      ...(dto.reason?.trim() ? { reason: dto.reason.trim() } : {}),
      status: AccountDeletionRequestStatus.pending,
    });

    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      createdAt: request.createdAt,
    };
  }

  async cancelDeletionRequest(userId: string) {
    await this.repo.findUserByIdOrThrow(userId);

    const pending = await this.repo.findPendingDeletionRequestByUserId(userId);

    if (!pending) {
      throw new BadRequestException('No pending deletion request found');
    }

    const request = await this.repo.updateDeletionRequest(pending.id, {
      status: AccountDeletionRequestStatus.cancelled,
      reviewNotes: 'Cancelled by member',
    });

    return {
      id: request.id,
      status: request.status,
    };
  }

  async updatePhone(userId: string, dto: UpdatePhoneDTO): Promise<void> {
    await this.repo.updatePhoneAndResetVerification(userId, dto.phone_number);
  }

  async uploadAvatarFile(
    userId: string,
    file: UploadedImageFile | undefined,
  ): Promise<{ avatar_url: string }> {
    await this.repo.findUserByIdOrThrow(userId);
    const { url } = await this.filesService.uploadImage(file, 'avatars');
    await this.repo.updateProfile(userId, { avatar_url: url });
    return { avatar_url: url };
  }

  async logProgress(userId: string, dto: LogProgressDTO) {
    this.assertAtLeastOneMeasurement(dto);
    await this.repo.findUserByIdOrThrow(userId);

    return this.repo.createProgressMetric({
      user: { connect: { id: userId } },
      weight_kg: dto.weight_kg ?? null,
      height_cm: dto.height_cm ?? null,
      body_fat_pct: dto.body_fat_pct ?? null,
      muscle_mass_kg: dto.muscle_mass_kg ?? null,
      waist_cm: dto.waist_cm ?? null,
      chest_cm: dto.chest_cm ?? null,
      notes: dto.notes ?? null,
      recorded_at: dto.recorded_at ? new Date(dto.recorded_at) : new Date(),
    });
  }

  async getProgressHistory(userId: string, dto: DateRangeDTO) {
    await this.repo.findUserByIdOrThrow(userId);
    return this.repo.getProgressHistory(userId, dto);
  }

  async refreshQrToken(userId: string) {
    const user = await this.repo.findUserAggregateOrThrow(userId);
    const latestDeletionRequest =
      await this.repo.findLatestDeletionRequest(userId);
    const latestDeletionStatus = latestDeletionRequest?.status ?? null;
    const blockedResponse = this.resolveBlockedAttendanceQrResponse(
      user,
      latestDeletionStatus,
    );

    if (blockedResponse) {
      return blockedResponse;
    }

    const now = new Date();
    const refreshAvailableAt = getAttendanceQrRefreshAvailableAt(
      user.qr_code_rotated_at,
    );

    if (refreshAvailableAt && refreshAvailableAt.getTime() > now.getTime()) {
      throw new HttpException(
        {
          type: 'QR_REFRESH_COOLDOWN',
          title: 'QR Refresh Cooling Down',
          status: 429,
          detail:
            'A fresh attendance QR was already issued recently. Try again after the cooldown ends.',
          refreshAvailableAt: refreshAvailableAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.rotateAttendanceQr(userId, now);
  }

  async getAttendanceQr(userId: string) {
    const user = await this.repo.findUserAggregateOrThrow(userId);
    const latestDeletionRequest =
      await this.repo.findLatestDeletionRequest(userId);
    const latestDeletionStatus = latestDeletionRequest?.status ?? null;
    const blockedResponse = this.resolveBlockedAttendanceQrResponse(
      user,
      latestDeletionStatus,
    );

    if (blockedResponse) {
      return blockedResponse;
    }

    const now = new Date();
    const currentToken = user.qr_code_token?.trim() ?? '';
    const expiresAt = user.qr_code_expires_at ?? null;

    if (currentToken && expiresAt && expiresAt.getTime() > now.getTime()) {
      return this.buildReadyAttendanceQrResponse(
        currentToken,
        expiresAt,
        user.qr_code_rotated_at ?? null,
      );
    }

    return this.rotateAttendanceQr(userId, now);
  }

  getAllUsers(dto: UserFilterDTO) {
    return this.repo.listUsers(dto);
  }

  async listGamificationParticipants(): Promise<
    GamificationParticipantProfile[]
  > {
    const participants = await this.repo.listGamificationParticipants();

    return participants.map((participant) => ({
      user_id: participant.user_id,
      display_name:
        `${participant.first_name} ${participant.last_name}`.trim() ||
        'FitTrack member',
      avatar_url: participant.avatar_url,
    }));
  }

  async getGamificationNotificationTarget(
    userId: string,
  ): Promise<GamificationNotificationTarget> {
    const target =
      await this.repo.findGamificationNotificationTargetOrThrow(userId);

    return {
      user_id: target.user_id,
      display_name: `${target.first_name} ${target.last_name}`.trim(),
      email: target.preferred_email,
      rank_up_email_enabled: target.rank_up_email !== false,
    };
  }

  async getNotificationDispatchContext(
    userId: string,
  ): Promise<NotificationDispatchContext> {
    const target =
      await this.repo.findNotificationDispatchTargetOrThrow(userId);

    return {
      user_id: target.user_id,
      preferred_email:
        target.auth_identities.find(
          ({ provider }) => provider === 'email' || provider === 'google',
        )?.identifier ?? null,
      preferred_phone: target.profile_phone,
      phone_verified_at: null,
    };
  }

  async getUserById(id: string) {
    return this.repo.findUserAggregateOrThrow(id);
  }

  async adminUpdateUser(id: string, dto: UpdateProfileDTO, actorId: string) {
    const target = await this.repo.findUserAggregateOrThrow(id);
    const updatedProfile = await this.updateExistingUserProfile(id, dto);

    await this.eventEmitter.emitAsync(ACCOUNT_ACTIVITY_EVENT, {
      action: 'account_updated',
      actorId,
      occurredAt: new Date().toISOString(),
      targetEmail: getIdentityIdentifier(target.auth_identities, [
        AuthProvider.email,
        AuthProvider.google,
      ]),
      targetName: `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim(),
      targetRole: target.role,
      targetUserId: id,
    });

    return updatedProfile;
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDTO,
    actorId: string,
    ip: string,
  ): Promise<void> {
    const before = await this.repo.findUserByIdOrThrow(id);

    await this.repo.updateUser(id, { status: dto.status });

    this.logger.log(
      `User ${id} status changed to ${dto.status} by ${actorId}. Reason: ${dto.reason ?? 'none'}`,
    );

    this.emitAudit({
      userId: actorId,
      action: AuditAction.USER_STATUS_CHANGED,
      entity: 'User',
      entityId: id,
      before: { status: before.status },
      after: { status: dto.status, reason: dto.reason ?? null },
      ipAddress: ip,
    });
  }

  async getMyAttendance(userId: string, dto: DateRangeDTO) {
    await this.repo.findUserByIdOrThrow(userId);
    return this.repo.getMyAttendance(userId, dto);
  }

  private updateExistingUserProfile(userId: string, dto: UpdateProfileDTO) {
    const data = this.toProfileUpdateInput(dto);
    if (Object.keys(data).length === 0) {
      return this.repo.findUserProfileByUserIdOrThrow(userId);
    }

    return this.repo.updateProfile(userId, data);
  }

  private toProfileUpdateInput(
    dto: UpdateProfileDTO,
  ): Prisma.UserProfileUpdateInput {
    return {
      ...pickDefined(dto, PROFILE_DIRECT_FIELDS),
      ...(dto.date_of_birth !== undefined
        ? { date_of_birth: assertValidMemberDateOfBirth(dto.date_of_birth) }
        : {}),
    };
  }

  private assertAtLeastOneMeasurement(dto: LogProgressDTO): void {
    const hasData = MEASUREMENT_FIELDS.some(
      (field) => dto[field] !== undefined,
    );

    if (!hasData) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Measurement Provided',
          status: 422,
          detail: 'At least one measurement field is required.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private buildBlockedAttendanceQrResponse(reason: string) {
    return {
      ready: false,
      qrValue: null,
      expiresAt: null,
      refreshAvailableAt: null,
      reason,
    };
  }

  private buildReadyAttendanceQrResponse(
    qrValue: string,
    expiresAt: Date,
    rotatedAt: Date | null,
  ) {
    return {
      ready: true,
      qrValue,
      expiresAt: expiresAt.toISOString(),
      refreshAvailableAt: toIsoStringOrNull(
        getAttendanceQrRefreshAvailableAt(rotatedAt),
      ),
      reason: null,
    };
  }

  private resolveBlockedAttendanceQrResponse(
    user: Awaited<ReturnType<UserRepository['findUserAggregateOrThrow']>>,
    latestDeletionStatus: AccountDeletionRequestStatus | null,
  ) {
    if (
      user.deletedAt ||
      latestDeletionStatus === AccountDeletionRequestStatus.pending
    ) {
      return this.buildBlockedAttendanceQrResponse(
        'Archived accounts cannot use attendance QR check-in.',
      );
    }

    if (user.membership_card?.status !== 'active') {
      return this.buildBlockedAttendanceQrResponse(
        user.membership_card?.status === 'pending_verification'
          ? 'Your membership card is still pending verification.'
          : user.membership_card?.status === 'revoked'
            ? 'Your membership card access is revoked right now.'
            : 'Attendance QR unlocks once this account has an active membership card.',
      );
    }

    return null;
  }

  private async rotateAttendanceQr(userId: string, now = new Date()) {
    const qrToken = createAttendanceQrToken();
    const expiresAt = getAttendanceQrExpiresAt(now);
    const updatedUser = await this.repo.updateUser(userId, {
      qr_code_token: qrToken,
      qr_code_rotated_at: now,
      qr_code_expires_at: expiresAt,
    });

    return this.buildReadyAttendanceQrResponse(
      updatedUser.qr_code_token?.trim() ?? qrToken,
      updatedUser.qr_code_expires_at ?? expiresAt,
      updatedUser.qr_code_rotated_at ?? now,
    );
  }
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly activityLevelService: ActivityLevelService,
  ) {}

  async scanQr(scannerUserId: string | null, dto: ScanQrDTO) {
    const qrValue =
      dto.qrValue?.trim() ||
      dto.qr_value?.trim() ||
      dto.qr_code_token?.trim() ||
      '';

    if (!qrValue) {
      throw new HttpException(
        {
          type: 'NOT_FOUND',
          title: 'Invalid QR',
          status: 404,
          detail: 'QR code not found or membership access is inactive.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const user = await this.repo.findActiveUserByQrTokenOrThrow(qrValue);
    const latestDeletionRequest = await this.repo.findLatestDeletionRequest(
      user.id,
    );
    if (
      latestDeletionRequest?.status === AccountDeletionRequestStatus.pending
    ) {
      throw new HttpException(
        {
          type: 'NOT_FOUND',
          title: 'Invalid QR',
          status: 404,
          detail: 'Archived accounts cannot use attendance QR check-in.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.createCheckIn(user.id, scannerUserId);
  }

  async manualCheckIn(
    scannerUserId: string | null,
    dto: ManualAttendanceCheckInDTO,
  ) {
    const user = await this.repo.findAttendanceEligibleUserByIdOrThrow(
      dto.user_id,
    );
    return this.createCheckIn(user.id, scannerUserId);
  }

  private async createCheckIn(userId: string, scannerUserId: string | null) {
    const existing = await this.repo.findOpenAttendanceToday(userId);
    if (existing) {
      throw new HttpException(
        {
          type: 'ALREADY_CHECKED_IN',
          title: 'Already Checked In',
          status: 409,
          detail: 'This member already has an open check-in today.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const log = await this.repo.createAttendanceLog({
      user: { connect: { id: userId } },
      scanner: scannerUserId ? { connect: { id: scannerUserId } } : undefined,
      check_in_at: new Date(),
    });

    const target = await this.repo.findUserAggregateOrThrow(userId);
    const profile = target.profile;

    await this.eventEmitter.emitAsync(ACCOUNT_ACTIVITY_EVENT, {
      action: 'attendance_check_in',
      actorId: scannerUserId ?? userId,
      details: {
        attendance_id: log.id,
        check_in_at: log.check_in_at.toISOString(),
      },
      occurredAt: new Date().toISOString(),
      targetEmail: getIdentityIdentifier(target.auth_identities, [
        AuthProvider.email,
        AuthProvider.google,
      ]),
      targetName: `${profile.first_name} ${profile.last_name}`.trim(),
      targetRole: target.role,
      targetUserId: userId,
    });
    await this.activityLevelService.recalculateForUser(userId);

    return {
      attendance_id: log.id,
      member_name: `${profile.first_name} ${profile.last_name}`.trim(),
      check_in_at: log.check_in_at,
    };
  }

  async checkout(attendanceId: string) {
    const log = await this.repo.findAttendanceLogByIdOrThrow(attendanceId);
    if (log.check_out_at) {
      throw new HttpException(
        {
          type: 'ALREADY_CHECKED_OUT',
          title: 'Already Checked Out',
          status: 409,
          detail: 'This attendance entry already has a check-out time.',
        },
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.repo.checkoutAttendance(attendanceId);
    await this.activityLevelService.recalculateForUser(updated.user_id);
    return updated;
  }

  getAttendanceLogs(dto: AttendanceFilterDTO) {
    return this.repo.getAllAttendance(dto);
  }
}

import {
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { Prisma, UserRole } from '@prisma/client';

import { AuthService } from '../auth/auth.service';
import { FilesService } from '../files/files.service';
import type { UploadedImageFile } from '../files/files.types';
import { SubscriptionService } from '../membership/subscription/subscription.service';
import { UserRepository } from './user.repository';
import { AuditAction, AuditEvent } from '../audit/audit.service';
import {
  UpdateProfileDTO,
  LogProgressDTO,
  DateRangeDTO,
  UserFilterDTO,
  UpdateUserStatusDTO,
  ScanQrDTO,
  AttendanceFilterDTO,
  UpdatePhoneDTO,
} from './dto/user-dto';

const PROFILE_DIRECT_FIELDS = [
  'first_name',
  'last_name',
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
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly repo: UserRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly authService: AuthService,
    private readonly filesService: FilesService,
  ) {}

  async getMyProfile(userId: string) {
    return this.repo.findUserAggregateOrThrow(userId);
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDTO) {
    await this.repo.findUserByIdOrThrow(userId);
    return this.updateExistingUserProfile(userId, dto);
  }

  async updatePhone(userId: string, dto: UpdatePhoneDTO): Promise<void> {
    await this.repo.updatePhoneAndResetVerification(userId, dto.phone_number);
    await this.authService.sendPhoneOtp(userId);
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

  async refreshQrToken(userId: string): Promise<{ qr_code_token: string }> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.repo.updateUser(userId, { qr_code_token: token });
    return { qr_code_token: token };
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
      display_name: `${participant.first_name} ${participant.last_name}`.trim(),
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
      preferred_phone:
        target.auth_identities.find(({ provider }) => provider === 'phone')
          ?.identifier ?? null,
      phone_verified_at: target.phone_verified_at,
    };
  }

  async getUserById(id: string) {
    return this.repo.findUserAggregateOrThrow(id);
  }

  async adminUpdateUser(id: string, dto: UpdateProfileDTO) {
    await this.repo.findUserByIdOrThrow(id);
    return this.updateExistingUserProfile(id, dto);
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
    return this.repo.updateProfile(userId, this.toProfileUpdateInput(dto));
  }

  private toProfileUpdateInput(
    dto: UpdateProfileDTO,
  ): Prisma.UserProfileUpdateInput {
    return {
      ...pickDefined(dto, PROFILE_DIRECT_FIELDS),
      ...(dto.date_of_birth !== undefined
        ? { date_of_birth: new Date(dto.date_of_birth) }
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
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: UserRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async scanQr(scannerUserId: string | null, dto: ScanQrDTO) {
    const user = await this.repo.findActiveUserByQrTokenOrThrow(
      dto.qr_code_token,
    );

    if (user.role === UserRole.member) {
      const hasSub = await this.subscriptionService.hasSubscriptionAccess(
        user.id,
      );
      if (!hasSub) {
        throw new ForbiddenException({
          type: 'SUBSCRIPTION_REQUIRED',
          title: 'Subscription Required',
          status: 403,
          detail: 'This member does not have an active subscription.',
        });
      }
    }

    const existing = await this.repo.findOpenAttendanceToday(user.id);
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
      user: { connect: { id: user.id } },
      scanner: scannerUserId ? { connect: { id: scannerUserId } } : undefined,
      check_in_at: new Date(),
    });

    const profile = await this.repo.findUserProfileByUserIdOrThrow(user.id);
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
    return this.repo.checkoutAttendance(attendanceId);
  }

  getAttendanceLogs(dto: AttendanceFilterDTO) {
    return this.repo.getAllAttendance(dto);
  }
}

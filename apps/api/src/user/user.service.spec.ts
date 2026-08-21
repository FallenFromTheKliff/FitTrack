import {
  AccountDeletionRequestStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { FilesService } from '../files/files.service';
import { ActivityLevelService } from './activity-level.service';
import { AttendanceService, UserService } from './user.service';
import { UserRepository } from './user.repository';

describe('UserService', () => {
  let service: UserService;

  const repo = {
    findUserAggregateOrThrow: jest.fn(),
    findUserByIdOrThrow: jest.fn(),
    findUserProfileByUserIdOrThrow: jest.fn(),
    updateProfile: jest.fn(),
    updatePhoneAndResetVerification: jest.fn(),
    createProgressMetric: jest.fn(),
    getProgressHistory: jest.fn(),
    getMyAttendance: jest.fn(),
    listUsers: jest.fn(),
    listGamificationParticipants: jest.fn(),
    findGamificationNotificationTargetOrThrow: jest.fn(),
    findNotificationDispatchTargetOrThrow: jest.fn(),
    findLatestDeletionRequest: jest.fn(),
    findPendingDeletionRequestByUserId: jest.fn(),
    createDeletionRequest: jest.fn(),
    updateDeletionRequest: jest.fn(),
    updateUser: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const filesService = {
    uploadImage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('maps only defined profile fields when updating a profile', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.updateProfile.mockResolvedValue({});

    await service.updateMyProfile('user-1', {
      first_name: 'Fit',
      avatar_url: 'https://cdn.fittrack.test/avatars/fit.png',
      height_cm: 180,
      date_of_birth: '1998-03-22',
    });

    expect(repo.updateProfile).toHaveBeenCalledWith('user-1', {
      first_name: 'Fit',
      avatar_url: 'https://cdn.fittrack.test/avatars/fit.png',
      height_cm: 180,
      date_of_birth: new Date('1998-03-22T00:00:00.000Z'),
    });
  });

  it('rejects an explicit null birthdate with a field-local problem', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.updateMyProfile('user-1', {
        date_of_birth: null as unknown as string,
      }),
    ).rejects.toMatchObject({
      response: {
        field: 'date_of_birth',
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Date Of Birth',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      },
    });
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it('does not persist an empty profile patch', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.findUserProfileByUserIdOrThrow.mockResolvedValue({
      first_name: 'Fit',
      last_name: 'Track',
      phone: '+639171234567',
      date_of_birth: new Date('1998-03-22T00:00:00.000Z'),
      weight_kg: { toNumber: () => 78 },
      height_cm: { toNumber: () => 180 },
    });

    await expect(service.updateMyProfile('user-1', {})).resolves.toEqual(
      expect.objectContaining({
        first_name: 'Fit',
        dateOfBirth: '1998-03-22',
        currentWeightKg: 78,
        heightCm: 180,
      }),
    );
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects future or underage member profile birth dates', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    const nextYear = new Date().getUTCFullYear() + 1;
    const underageYear = new Date().getUTCFullYear() - 1;

    await expect(
      service.updateMyProfile('user-1', {
        date_of_birth: `${nextYear}-01-01`,
      }),
    ).rejects.toMatchObject({
      response: {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Date Of Birth',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      },
    });

    await expect(
      service.updateMyProfile('user-1', {
        date_of_birth: `${underageYear}-01-01`,
      }),
    ).rejects.toMatchObject({
      response: {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Date Of Birth',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      },
    });
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it('enriches /users/me aggregates with preferred email and phone fields', async () => {
    repo.findUserAggregateOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: null,
      phone_verified_at: null,
      qr_code_token: 'qr-token',
      auth_identities: [
        {
          provider: 'email',
          identifier: 'member@example.com',
          verified_at: new Date('2026-03-31T00:00:00.000Z'),
          is_primary: true,
        },
        {
          provider: 'phone',
          identifier: '+639171234567',
          verified_at: null,
          is_primary: false,
        },
      ],
      profile: {
        phone: '09171234567',
      },
      membership_card: {
        status: 'active',
      },
      notification_prefs: {},
    });

    await expect(service.getMyProfile('user-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'user-1',
        email: 'member@example.com',
        phone: '09171234567',
        phone_no: '09171234567',
        emailVerified: true,
        phoneVerified: false,
        qrCodeReady: true,
        attendanceQrReady: true,
      }),
    );
  });

  it('returns canonical profile values for client diffing', async () => {
    repo.findUserAggregateOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: null,
      phone_verified_at: null,
      has_accepted_privacy: true,
      privacy_accepted_at: null,
      qr_code_token: 'qr-token',
      auth_identities: [],
      profile: {
        first_name: ' Fit ',
        last_name: ' Track ',
        phone: ' +639171234567 ',
        date_of_birth: new Date('1998-03-22T00:00:00.000Z'),
        weight_kg: { toNumber: () => 78 },
        height_cm: { toNumber: () => 180 },
      },
      membership_card: null,
      notification_prefs: {},
    });

    await expect(service.getMyProfile('user-1')).resolves.toEqual(
      expect.objectContaining({
        phone: '+639171234567',
        phone_no: '+639171234567',
        profile: expect.objectContaining({
          first_name: 'Fit',
          last_name: 'Track',
          phone: '+639171234567',
          date_of_birth: new Date('1998-03-22T00:00:00.000Z'),
          dateOfBirth: '1998-03-22',
          currentWeightKg: 78,
          heightCm: 180,
        }),
      }),
    );
  });

  it.each(['pending_verification', 'revoked'] as const)(
    'keeps attendance QR available when the membership card is %s',
    async (membershipCardStatus) => {
      repo.findUserAggregateOrThrow.mockResolvedValue({
        id: 'user-1',
        role: UserRole.member,
        status: UserStatus.active,
        email_verified_at: null,
        phone_verified_at: null,
        qr_code_token: 'qr-token',
        auth_identities: [
          {
            provider: 'email',
            identifier: 'member@example.com',
            verified_at: new Date('2026-03-31T00:00:00.000Z'),
            is_primary: true,
          },
        ],
        profile: {
          phone: '09171234567',
        },
        membership_card: {
          status: membershipCardStatus,
        },
        notification_prefs: {},
      });

      await expect(service.getMyProfile('user-1')).resolves.toEqual(
        expect.objectContaining({
          qrCodeReady: true,
          attendanceQrReady: true,
        }),
      );
    },
  );

  it('makes attendance QR available for an active member without a membership card', async () => {
    repo.findUserAggregateOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: null,
      phone_verified_at: null,
      qr_code_token: 'qr-token',
      auth_identities: [],
      profile: { phone: null },
      membership_card: null,
      notification_prefs: {},
    });

    await expect(service.getMyProfile('user-1')).resolves.toEqual(
      expect.objectContaining({
        qrCodeReady: true,
        attendanceQrReady: true,
      }),
    );
  });

  it('returns the latest deletion request status for a member', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.findLatestDeletionRequest.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
    });

    await expect(service.getDeletionRequestStatus('user-1')).resolves.toEqual({
      status: AccountDeletionRequestStatus.pending,
    });
  });

  it('creates a pending deletion request when none exists', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      deletedAt: null,
    });
    repo.findPendingDeletionRequestByUserId.mockResolvedValue(null);
    repo.createDeletionRequest.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
      reason: 'Need to leave',
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    const result = await service.requestDeletion('user-1', {
      reason: 'Need to leave',
    });

    expect(repo.createDeletionRequest).toHaveBeenCalledWith({
      user: { connect: { id: 'user-1' } },
      reason: 'Need to leave',
      status: AccountDeletionRequestStatus.pending,
    });
    expect(result).toEqual({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
      reason: 'Need to leave',
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
    });
  });

  it('rejects duplicate pending deletion requests', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      deletedAt: null,
    });
    repo.findPendingDeletionRequestByUserId.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
    });

    await expect(
      service.requestDeletion('user-1', { reason: 'Need to leave' }),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels a pending deletion request for the current member', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.findPendingDeletionRequestByUserId.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
    });
    repo.updateDeletionRequest.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.cancelled,
    });

    await expect(service.cancelDeletionRequest('user-1')).resolves.toEqual({
      id: 'request-1',
      status: AccountDeletionRequestStatus.cancelled,
    });

    expect(repo.updateDeletionRequest).toHaveBeenCalledWith('request-1', {
      status: AccountDeletionRequestStatus.cancelled,
      reviewNotes: 'Cancelled by member',
    });
  });

  it('updates phone state transactionally without triggering OTP delivery', async () => {
    repo.updatePhoneAndResetVerification.mockResolvedValue(undefined);

    await service.updatePhone('user-1', { phone_number: '+639171234567' });

    expect(repo.updatePhoneAndResetVerification).toHaveBeenCalledWith(
      'user-1',
      '+639171234567',
    );
  });

  it('uploads avatars through the shared files service', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.updateProfile.mockResolvedValue({});
    filesService.uploadImage.mockResolvedValue({
      url: 'https://cdn.fittrack.test/avatars/avatar.png',
    });

    const result = await service.uploadAvatarFile('user-1', {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('avatar'),
    });

    expect(filesService.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'avatar.png' }),
      'avatars',
    );
    expect(repo.updateProfile).toHaveBeenCalledWith('user-1', {
      avatar_url: 'https://cdn.fittrack.test/avatars/avatar.png',
    });
    expect(result).toEqual({
      avatar_url: 'https://cdn.fittrack.test/avatars/avatar.png',
    });
  });

  it('rejects progress logs that contain no measurements', async () => {
    await expect(service.logProgress('user-1', {})).rejects.toThrow(
      HttpException,
    );
    expect(repo.createProgressMetric).not.toHaveBeenCalled();
  });

  it('checks that the user exists before loading progress history', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({ id: 'user-1' });
    repo.getProgressHistory.mockResolvedValue({ data: [], meta: {} });

    await service.getProgressHistory('user-1', {});

    expect(repo.findUserByIdOrThrow).toHaveBeenCalledWith('user-1');
    expect(repo.getProgressHistory).toHaveBeenCalledWith('user-1', {});
  });

  it('maps gamification participants to leaderboard-safe display profiles', async () => {
    repo.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-1',
        first_name: 'Fit',
        last_name: 'Track',
        avatar_url: 'https://cdn.fittrack.test/avatars/fit.png',
      },
    ]);

    await expect(service.listGamificationParticipants()).resolves.toEqual([
      {
        user_id: 'user-1',
        display_name: 'Fit Track',
        avatar_url: 'https://cdn.fittrack.test/avatars/fit.png',
      },
    ]);
  });

  it('maps gamification notification targets to delivery-safe data', async () => {
    repo.findGamificationNotificationTargetOrThrow.mockResolvedValue({
      user_id: 'user-1',
      first_name: 'Fit',
      last_name: 'Track',
      preferred_email: 'fit@example.com',
      rank_up_email: null,
    });

    await expect(
      service.getGamificationNotificationTarget('user-1'),
    ).resolves.toEqual({
      user_id: 'user-1',
      display_name: 'Fit Track',
      email: 'fit@example.com',
      rank_up_email_enabled: true,
    });
  });

  it('maps notification dispatch context with preferred email and verified phone', async () => {
    repo.findNotificationDispatchTargetOrThrow.mockResolvedValue({
      user_id: 'user-1',
      profile_phone: '+639171234567',
      auth_identities: [
        { provider: 'google', identifier: 'fit@example.com' },
        { provider: 'phone', identifier: '+639171234567' },
      ],
    });

    await expect(
      service.getNotificationDispatchContext('user-1'),
    ).resolves.toEqual({
      user_id: 'user-1',
      preferred_email: 'fit@example.com',
      preferred_phone: '+639171234567',
      phone_verified_at: null,
    });
  });

  it('updates user status and emits an audit event', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.active,
    });
    repo.updateUser.mockResolvedValue({});

    await service.updateUserStatus(
      'user-1',
      { status: 'suspended', reason: 'Testing' },
      'admin-1',
      '127.0.0.1',
    );

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      status: 'suspended',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'admin-1',
        entityId: 'user-1',
        before: { status: UserStatus.active },
        after: { status: 'suspended', reason: 'Testing' },
      }),
    );
  });

  it('hides historical approved deletion state after restore clears deletedAt', async () => {
    repo.findUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      deletedAt: null,
    });
    repo.findLatestDeletionRequest.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.approved,
    });

    await expect(service.getDeletionRequestStatus('user-1')).resolves.toEqual({
      status: null,
    });
  });

  it('returns a rotating attendance QR payload for active members without a card', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-13T12:00:00.000Z'));
    repo.findUserAggregateOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      qr_code_token: 'seed-qr-token',
      qr_code_rotated_at: new Date('2026-04-13T11:59:00.000Z'),
      qr_code_expires_at: new Date('2026-04-13T12:15:00.000Z'),
      deletedAt: null,
      email_verified_at: null,
      phone_verified_at: null,
      auth_identities: [],
      membership_card: null,
      notification_prefs: {},
      profile: {
        phone: null,
      },
    });
    repo.findLatestDeletionRequest.mockResolvedValue(null);

    await expect(service.getAttendanceQr('user-1')).resolves.toEqual({
      ready: true,
      qrValue: 'seed-qr-token',
      expiresAt: '2026-04-13T12:15:00.000Z',
      refreshAvailableAt: '2026-04-13T12:00:30.000Z',
      reason: null,
    });

    jest.useRealTimers();
  });

  it('refreshes the attendance QR with a fresh expiry and enforces cooldown', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-13T12:00:00.000Z'));
    repo.findUserAggregateOrThrow
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.member,
        status: UserStatus.active,
        qr_code_token: 'old-token',
        qr_code_rotated_at: null,
        qr_code_expires_at: null,
        deletedAt: null,
        email_verified_at: null,
        phone_verified_at: null,
        auth_identities: [],
        membership_card: null,
        notification_prefs: {},
        profile: {
          phone: null,
        },
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        role: UserRole.member,
        status: UserStatus.active,
        qr_code_token: 'fresh-token',
        qr_code_rotated_at: new Date('2026-04-13T12:00:00.000Z'),
        qr_code_expires_at: new Date('2026-04-13T12:15:00.000Z'),
        deletedAt: null,
        email_verified_at: null,
        phone_verified_at: null,
        auth_identities: [],
        membership_card: null,
        notification_prefs: {},
        profile: {
          phone: null,
        },
      });
    repo.findLatestDeletionRequest.mockResolvedValue(null);
    repo.updateUser.mockResolvedValue({
      qr_code_token: 'fresh-token',
      qr_code_rotated_at: new Date('2026-04-13T12:00:00.000Z'),
      qr_code_expires_at: new Date('2026-04-13T12:15:00.000Z'),
    });

    await expect(service.refreshQrToken('user-1')).resolves.toEqual({
      ready: true,
      qrValue: 'fresh-token',
      expiresAt: '2026-04-13T12:15:00.000Z',
      refreshAvailableAt: '2026-04-13T12:01:30.000Z',
      reason: null,
    });

    await expect(service.refreshQrToken('user-1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', {
      qr_code_token: expect.any(String),
      qr_code_rotated_at: new Date('2026-04-13T12:00:00.000Z'),
      qr_code_expires_at: new Date('2026-04-13T12:15:00.000Z'),
    });

    jest.useRealTimers();
  });
});

describe('AttendanceService', () => {
  let service: AttendanceService;

  const repo = {
    findActiveUserByQrTokenOrThrow: jest.fn(),
    findUserAggregateOrThrow: jest.fn(),
    findLatestDeletionRequest: jest.fn(),
    findOpenAttendanceToday: jest.fn(),
    createAttendanceLog: jest.fn(),
    findUserProfileByUserIdOrThrow: jest.fn(),
    findAttendanceLogByIdOrThrow: jest.fn(),
    checkoutAttendance: jest.fn(),
    getAllAttendance: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn(),
    emitAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: UserRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: ActivityLevelService,
          useValue: { recalculateForUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects scans when the QR token is invalid or the account is ineligible', async () => {
    repo.findActiveUserByQrTokenOrThrow.mockRejectedValue(
      new NotFoundException('Invalid QR'),
    );

    await expect(
      service.scanQr('staff-1', { qr_code_token: 'qr-token' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates an attendance log when an active member without a card scans', async () => {
    repo.findActiveUserByQrTokenOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: 'active',
      qr_code_token: 'seed-qr-token',
      membership_card: null,
    });
    repo.findLatestDeletionRequest.mockResolvedValue(null);
    repo.findOpenAttendanceToday.mockResolvedValue(null);
    repo.createAttendanceLog.mockResolvedValue({
      id: 'attendance-1',
      check_in_at: new Date('2026-03-22T10:00:00Z'),
    });
    repo.findUserProfileByUserIdOrThrow.mockResolvedValue({
      first_name: 'Fit',
      last_name: 'Track',
    });
    repo.findUserAggregateOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      auth_identities: [
        {
          provider: 'email',
          identifier: 'member@example.com',
          is_primary: true,
          verified_at: new Date('2026-03-22T00:00:00.000Z'),
        },
      ],
      profile: {
        first_name: 'Fit',
        last_name: 'Track',
      },
    });

    const result = await service.scanQr('staff-1', {
      qr_value: 'seed-qr-token',
    });

    expect(result).toEqual({
      attendance_id: 'attendance-1',
      member_name: 'Fit Track',
      check_in_at: new Date('2026-03-22T10:00:00Z'),
    });
  });

  it('rejects archived accounts even when the QR token matches', async () => {
    repo.findActiveUserByQrTokenOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: 'active',
      qr_code_token: 'seed-qr-token',
    });
    repo.findLatestDeletionRequest.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
    });

    await expect(
      service.scanQr('staff-1', {
        qr_value: 'seed-qr-token',
      }),
    ).rejects.toThrow(HttpException);
  });
});

import { ForbiddenException, HttpException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';

import { AuthService } from '../auth/auth.service';
import { FilesService } from '../files/files.service';
import { SubscriptionService } from '../membership/subscription/subscription.service';
import { AttendanceService, UserService } from './user.service';
import { UserRepository } from './user.repository';

describe('UserService', () => {
  let service: UserService;

  const repo = {
    findUserAggregateOrThrow: jest.fn(),
    findUserByIdOrThrow: jest.fn(),
    updateProfile: jest.fn(),
    updatePhoneAndResetVerification: jest.fn(),
    createProgressMetric: jest.fn(),
    getProgressHistory: jest.fn(),
    getMyAttendance: jest.fn(),
    listUsers: jest.fn(),
    listGamificationParticipants: jest.fn(),
    findGamificationNotificationTargetOrThrow: jest.fn(),
    findNotificationDispatchTargetOrThrow: jest.fn(),
    updateUser: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const authService = {
    sendPhoneOtp: jest.fn(),
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
        { provide: AuthService, useValue: authService },
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
      height_cm: 180,
      date_of_birth: '2026-03-22T00:00:00.000Z',
    });

    expect(repo.updateProfile).toHaveBeenCalledWith('user-1', {
      first_name: 'Fit',
      height_cm: 180,
      date_of_birth: new Date('2026-03-22T00:00:00.000Z'),
    });
  });

  it('updates phone state transactionally and sends a new OTP', async () => {
    repo.updatePhoneAndResetVerification.mockResolvedValue(undefined);
    authService.sendPhoneOtp.mockResolvedValue(undefined);

    await service.updatePhone('user-1', { phone_number: '+639171234567' });

    expect(repo.updatePhoneAndResetVerification).toHaveBeenCalledWith(
      'user-1',
      '+639171234567',
    );
    expect(authService.sendPhoneOtp).toHaveBeenCalledWith('user-1');
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
      phone_verified_at: new Date('2026-03-28T06:00:00.000Z'),
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
      phone_verified_at: new Date('2026-03-28T06:00:00.000Z'),
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
});

describe('AttendanceService', () => {
  let service: AttendanceService;

  const repo = {
    findActiveUserByQrTokenOrThrow: jest.fn(),
    findOpenAttendanceToday: jest.fn(),
    createAttendanceLog: jest.fn(),
    findUserProfileByUserIdOrThrow: jest.fn(),
    findAttendanceLogByIdOrThrow: jest.fn(),
    checkoutAttendance: jest.fn(),
    getAllAttendance: jest.fn(),
  };

  const membershipService = {
    hasSubscriptionAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: UserRepository, useValue: repo },
        { provide: SubscriptionService, useValue: membershipService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    jest.clearAllMocks();
  });

  it('blocks member check-in without an active subscription', async () => {
    repo.findActiveUserByQrTokenOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: 'active',
    });
    membershipService.hasSubscriptionAccess.mockResolvedValue(false);

    await expect(
      service.scanQr('staff-1', { qr_code_token: 'qr-token' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates an attendance log when the member can check in', async () => {
    repo.findActiveUserByQrTokenOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: 'active',
    });
    membershipService.hasSubscriptionAccess.mockResolvedValue(true);
    repo.findOpenAttendanceToday.mockResolvedValue(null);
    repo.createAttendanceLog.mockResolvedValue({
      id: 'attendance-1',
      check_in_at: new Date('2026-03-22T10:00:00Z'),
    });
    repo.findUserProfileByUserIdOrThrow.mockResolvedValue({
      first_name: 'Fit',
      last_name: 'Track',
    });

    const result = await service.scanQr('staff-1', {
      qr_code_token: 'qr-token',
    });

    expect(result).toEqual({
      attendance_id: 'attendance-1',
      member_name: 'Fit Track',
      check_in_at: new Date('2026-03-22T10:00:00Z'),
    });
  });
});

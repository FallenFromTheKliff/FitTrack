import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { FinalizePoseSessionDTO } from './dto/pose.dto';
import { PoseController } from './pose.controller';

function getGuardMetadata(
  methodName:
    | 'startSession'
    | 'getSessionById'
    | 'analyzeSession'
    | 'finalizeSession'
    | 'listProfiles',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    PoseController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(methodName: 'listProfiles'): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    PoseController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('PoseController', () => {
  const poseService = {
    getPoseSessionById: jest.fn(),
    finalizePoseSessionById: jest.fn(),
    listPoseProfiles: jest.fn(),
  };

  let controller: PoseController;

  beforeEach(() => {
    controller = new PoseController(poseService as never);
    jest.clearAllMocks();
  });

  it('protects owned pose-session routes with JWT auth', () => {
    expect(getGuardMetadata('startSession')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('getSessionById')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('analyzeSession')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
    expect(getGuardMetadata('finalizeSession')).toEqual([
      JwtAuthGuard,
      ActiveMemberCardGuard,
    ]);
  });

  it('locks profile listing to admin users', () => {
    expect(getGuardMetadata('listProfiles')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('listProfiles')).toEqual([UserRole.admin]);
  });

  it('loads a pose session through the service', async () => {
    poseService.getPoseSessionById.mockResolvedValue({ id: 'pose-1' });

    await controller.getSessionById('pose-1', { sub: 'user-1' } as never);

    expect(poseService.getPoseSessionById).toHaveBeenCalledWith(
      'user-1',
      'pose-1',
    );
  });

  it('finalizes a pose session through the service', async () => {
    poseService.finalizePoseSessionById.mockResolvedValue({ id: 'pose-1' });
    const finalizePayload: FinalizePoseSessionDTO = {
      ended_reason: 'manual_stop' as const,
      final_rep_count: 0,
      raw_angle_data: [],
    };

    await controller.finalizeSession(
      'pose-1',
      { sub: 'user-1' } as never,
      finalizePayload,
    );

    expect(poseService.finalizePoseSessionById).toHaveBeenCalledWith(
      'user-1',
      'pose-1',
      finalizePayload,
    );
  });

  it('lists pose profiles through the service', async () => {
    poseService.listPoseProfiles.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.listProfiles({
      page: 1,
      limit: 20,
      canonical_name: 'squat',
    });

    expect(poseService.listPoseProfiles).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      canonical_name: 'squat',
    });
  });
});

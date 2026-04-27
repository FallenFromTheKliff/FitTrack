import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GamificationAdminController } from './gamification-admin.controller';

function getGuardMetadata(): unknown[] | undefined {
  return Reflect.getMetadata(GUARDS_METADATA, GamificationAdminController) as
    | unknown[]
    | undefined;
}

function getRolesMetadata(): unknown[] | undefined {
  return Reflect.getMetadata(ROLES_KEY, GamificationAdminController) as
    | unknown[]
    | undefined;
}

describe('GamificationAdminController', () => {
  const gamificationService = {
    getAdminOverview: jest.fn(),
    adminUpdateSeasonStatus: jest.fn(),
    adminUpdateCreatorState: jest.fn(),
    adminVoidProgressionGrant: jest.fn(),
    adminRestoreProgressionGrant: jest.fn(),
    adminApplyRankingOverride: jest.fn(),
    adminCreateIntegrityCase: jest.fn(),
    adminResolveIntegrityCase: jest.fn(),
  };

  let controller: GamificationAdminController;

  beforeEach(() => {
    controller = new GamificationAdminController(gamificationService as never);
    jest.clearAllMocks();
  });

  it('protects admin gamification routes with JWT auth and admin role checks', () => {
    expect(getRolesMetadata()).toEqual([UserRole.admin]);
    expect(getGuardMetadata()).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('loads the admin gamification overview through the service', async () => {
    gamificationService.getAdminOverview.mockResolvedValue({
      generated_at: '2026-04-24T00:00:00.000Z',
    });

    await controller.getOverview();

    expect(gamificationService.getAdminOverview).toHaveBeenCalledWith();
  });

  it('updates a season status through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminUpdateSeasonStatus.mockResolvedValue({
      season_id: 'season-1',
    });

    await controller.updateSeasonStatus('season-1', user, {
      status: 'closed',
      rationale: 'Season ended after review.',
    });

    expect(gamificationService.adminUpdateSeasonStatus).toHaveBeenCalledWith(
      'admin-1',
      'season-1',
      {
        status: 'closed',
        rationale: 'Season ended after review.',
      },
    );
  });

  it('updates creator state through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminUpdateCreatorState.mockResolvedValue({
      user_id: 'member-1',
    });

    await controller.updateCreatorState('member-1', user, {
      state: 'approved',
      rationale: 'Creator submissions look strong.',
      admin_notes: 'Monitor next two submissions.',
    });

    expect(gamificationService.adminUpdateCreatorState).toHaveBeenCalledWith(
      'admin-1',
      'member-1',
      {
        state: 'approved',
        rationale: 'Creator submissions look strong.',
        admin_notes: 'Monitor next two submissions.',
      },
    );
  });

  it('voids a progression grant through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminVoidProgressionGrant.mockResolvedValue({
      grant_id: 'grant-1',
    });

    await controller.voidProgressionGrant('grant-1', user, {
      rationale: 'Manual moderation review.',
    });

    expect(gamificationService.adminVoidProgressionGrant).toHaveBeenCalledWith(
      'admin-1',
      'grant-1',
      { rationale: 'Manual moderation review.' },
    );
  });

  it('restores a progression grant through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminRestoreProgressionGrant.mockResolvedValue({
      grant_id: 'grant-1',
    });

    await controller.restoreProgressionGrant('grant-1', user, {
      rationale: 'Evidence validated on second review.',
    });

    expect(
      gamificationService.adminRestoreProgressionGrant,
    ).toHaveBeenCalledWith('admin-1', 'grant-1', {
      rationale: 'Evidence validated on second review.',
    });
  });

  it('applies a ranking override through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminApplyRankingOverride.mockResolvedValue({
      user_id: 'member-1',
    });

    await controller.applyRankingOverride('member-1', user, {
      governance_status: 'hidden_by_admin',
      rationale: 'Hold ranking visibility pending review.',
    });

    expect(gamificationService.adminApplyRankingOverride).toHaveBeenCalledWith(
      'admin-1',
      'member-1',
      {
        governance_status: 'hidden_by_admin',
        rationale: 'Hold ranking visibility pending review.',
      },
    );
  });

  it('creates an integrity case through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminCreateIntegrityCase.mockResolvedValue({
      case_id: 'case-1',
    });

    await controller.createIntegrityCase(user, {
      user_id: 'member-1',
      event_type: 'rep_pattern_anomaly',
      risk_level: 'medium',
      summary: 'Manual review requested.',
    });

    expect(gamificationService.adminCreateIntegrityCase).toHaveBeenCalledWith(
      'admin-1',
      {
        user_id: 'member-1',
        event_type: 'rep_pattern_anomaly',
        risk_level: 'medium',
        summary: 'Manual review requested.',
      },
    );
  });

  it('resolves an integrity case through the service', async () => {
    const user = { sub: 'admin-1' } as JwtPayload;
    gamificationService.adminResolveIntegrityCase.mockResolvedValue({
      case_id: 'case-1',
    });

    await controller.resolveIntegrityCase('case-1', user, {
      status: 'resolved_invalid',
      rationale: 'Source remained invalid after review.',
    });

    expect(gamificationService.adminResolveIntegrityCase).toHaveBeenCalledWith(
      'admin-1',
      'case-1',
      {
        status: 'resolved_invalid',
        rationale: 'Source remained invalid after review.',
      },
    );
  });
});

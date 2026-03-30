import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RelationshipController } from './relationship.controller';

function getGuardMetadata(
  methodName:
    | 'requestRelationship'
    | 'getMyRelationships'
    | 'getMyClients'
    | 'updateRelationship'
    | 'submitReview',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    RelationshipController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'getMyClients' | 'updateRelationship',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    RelationshipController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('RelationshipController', () => {
  const relationshipService = {
    requestRelationship: jest.fn(),
    getMyRelationships: jest.fn(),
    getMyClients: jest.fn(),
    updateRelationship: jest.fn(),
    submitReview: jest.fn(),
  };

  let controller: RelationshipController;

  beforeEach(() => {
    controller = new RelationshipController(relationshipService as never);
    jest.clearAllMocks();
  });

  it('creates relationship requests for authenticated users', async () => {
    relationshipService.requestRelationship.mockResolvedValue({ id: 'rel-1' });

    await controller.requestRelationship({ sub: 'member-1' } as never, {
      coach_id: 'coach-1',
      notes: 'Need accountability and programming help.',
    });

    expect(relationshipService.requestRelationship).toHaveBeenCalledWith(
      'member-1',
      {
        coach_id: 'coach-1',
        notes: 'Need accountability and programming help.',
      },
    );
    expect(getGuardMetadata('requestRelationship')).toEqual([JwtAuthGuard]);
  });

  it('loads the authenticated members relationships through JWT auth', async () => {
    relationshipService.getMyRelationships.mockResolvedValue([]);

    await controller.getMyRelationships({ sub: 'member-1' } as never);

    expect(relationshipService.getMyRelationships).toHaveBeenCalledWith(
      'member-1',
    );
    expect(getGuardMetadata('getMyRelationships')).toEqual([JwtAuthGuard]);
  });

  it('locks coach client list reads to coach accounts', async () => {
    relationshipService.getMyClients.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getMyClients({ sub: 'coach-user-1' } as never, {
      page: 1,
      limit: 20,
    });

    expect(relationshipService.getMyClients).toHaveBeenCalledWith(
      'coach-user-1',
      { page: 1, limit: 20 },
    );
    expect(getGuardMetadata('getMyClients')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('getMyClients')).toEqual([UserRole.coach]);
  });

  it('locks relationship updates to the owning coach role', async () => {
    relationshipService.updateRelationship.mockResolvedValue({ id: 'rel-1' });

    await controller.updateRelationship(
      'rel-1',
      { sub: 'coach-user-1' } as never,
      { status: 'active' },
    );

    expect(relationshipService.updateRelationship).toHaveBeenCalledWith(
      'coach-user-1',
      'rel-1',
      { status: 'active' },
    );
    expect(getGuardMetadata('updateRelationship')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('updateRelationship')).toEqual([UserRole.coach]);
  });

  it('submits reviews through the service for authenticated users', async () => {
    relationshipService.submitReview.mockResolvedValue({ id: 'review-1' });

    await controller.submitReview('coach-1', { sub: 'member-1' } as never, {
      appointment_id: 'appt-1',
      rating: 5,
      comment: 'Great session.',
    });

    expect(relationshipService.submitReview).toHaveBeenCalledWith(
      'member-1',
      'coach-1',
      {
        appointment_id: 'appt-1',
        rating: 5,
        comment: 'Great session.',
      },
    );
    expect(getGuardMetadata('submitReview')).toEqual([JwtAuthGuard]);
  });
});

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditController } from './audit.controller';

function getGuardMetadata(
  methodName: 'getAuditLogs' | 'getAuditLogById',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    AuditController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName: 'getAuditLogs' | 'getAuditLogById',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    AuditController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('AuditController', () => {
  const auditService = {
    getAuditLogs: jest.fn(),
    getAuditLogById: jest.fn(),
  };

  let controller: AuditController;

  beforeEach(() => {
    controller = new AuditController(auditService as never);
    jest.clearAllMocks();
  });

  it('lists audit logs through the service', async () => {
    auditService.getAuditLogs.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getAuditLogs({ page: 1, limit: 20 } as never);

    expect(auditService.getAuditLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('gets one audit log by id through the service', async () => {
    auditService.getAuditLogById.mockResolvedValue({ id: 'audit-1' });

    await controller.getAuditLogById('audit-1');

    expect(auditService.getAuditLogById).toHaveBeenCalledWith('audit-1');
  });

  it.each(['getAuditLogs', 'getAuditLogById'] as const)(
    'locks %s to admin users',
    (methodName) => {
      expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
      expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
    },
  );
});

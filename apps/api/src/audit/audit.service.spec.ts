import { Logger } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import type { AuditFilterOptions } from './audit.service';
import { AuditService } from './audit.service';

function createAuditLogRecord(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'audit-1',
    user_id: 'user-1',
    action: 'USER_STATUS_CHANGED',
    entity: 'User',
    entity_id: 'target-user-1',
    before: { status: 'active' },
    after: { status: 'suspended' },
    ip_address: '127.0.0.1',
    created_at: new Date('2026-03-28T03:00:00.000Z'),
    user: {
      id: 'user-1',
      role: UserRole.admin,
      status: UserStatus.active,
      qr_code_token: 'secret-token',
      profile: {
        first_name: 'Maria',
        last_name: 'Santos',
      },
    },
    ...overrides,
  };
}

describe('AuditService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  let service: AuditService;

  beforeEach(() => {
    service = new AuditService(prisma as never);
    jest.clearAllMocks();
  });

  it('persists audit events as append-only audit log rows', async () => {
    prisma.auditLog.create.mockResolvedValue(createAuditLogRecord());

    await expect(
      service.handleAuditEvent({
        userId: 'admin-1',
        action: 'COACH_COMMISSION_CHANGED',
        entity: 'CoachProfile',
        entityId: 'coach-1',
        before: { gym_commission_pct: '20' },
        after: { gym_commission_pct: '25' },
      }),
    ).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        user_id: 'admin-1',
        action: 'COACH_COMMISSION_CHANGED',
        entity: 'CoachProfile',
        entity_id: 'coach-1',
        before: { gym_commission_pct: '20' },
        after: { gym_commission_pct: '25' },
        ip_address: null,
      },
    });
  });

  it('logs and swallows audit persistence failures', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    prisma.auditLog.create.mockRejectedValue(new Error('db unavailable'));

    await expect(
      service.handleAuditEvent({
        userId: null,
        action: 'USER_STATUS_CHANGED',
        entity: 'User',
        entityId: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to write audit log [USER_STATUS_CHANGED] on User:user-1',
      'Error: db unavailable',
    );

    loggerError.mockRestore();
  });

  it('maps paginated audit logs into a safe response shape', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([createAuditLogRecord()]);

    await expect(
      service.getAuditLogs({
        page: 1,
        limit: 20,
        action: 'USER_STATUS_CHANGED',
      } satisfies AuditFilterOptions),
    ).resolves.toEqual({
      data: [
        {
          id: 'audit-1',
          user_id: 'user-1',
          actor: {
            id: 'user-1',
            role: UserRole.admin,
            status: UserStatus.active,
            profile: {
              first_name: 'Maria',
              last_name: 'Santos',
            },
          },
          action: 'USER_STATUS_CHANGED',
          entity: 'User',
          entity_id: 'target-user-1',
          before: { status: 'active' },
          after: { status: 'suspended' },
          ip_address: '127.0.0.1',
          created_at: '2026-03-28T03:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { user: { include: { profile: true } } },
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 20,
        where: { action: 'USER_STATUS_CHANGED' },
      }),
    );
  });

  it('maps a single audit log without exposing raw user fields', async () => {
    prisma.auditLog.findUnique.mockResolvedValue(
      createAuditLogRecord({
        user_id: null,
        user: null,
        before: null,
        after: null,
        ip_address: null,
      }),
    );

    await expect(service.getAuditLogById('audit-1')).resolves.toEqual({
      id: 'audit-1',
      user_id: null,
      actor: null,
      action: 'USER_STATUS_CHANGED',
      entity: 'User',
      entity_id: 'target-user-1',
      before: null,
      after: null,
      ip_address: null,
      created_at: '2026-03-28T03:00:00.000Z',
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionRequestStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from 'prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  const prisma = {
    accountDeletionRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('approves a pending deletion request using the lowercase status contract', async () => {
    prisma.accountDeletionRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
      userId: 'user-1',
      user: {
        auth_identities: [
          {
            provider: 'email',
            identifier: 'member@example.com',
            verified_at: new Date(),
          },
        ],
      },
    });
    prisma.accountDeletionRequest.update.mockResolvedValue(undefined);
    prisma.user.update.mockResolvedValue(undefined);

    await expect(
      service.approveDeletionRequest('request-1', 'admin-1', 'Approved'),
    ).resolves.toEqual({
      message: 'User account deleted successfully',
      email: 'member@example.com',
    });

    expect(prisma.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: AccountDeletionRequestStatus.approved,
        reviewedBy: 'admin-1',
        reviewNotes: 'Approved',
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects a pending deletion request using the lowercase status contract', async () => {
    prisma.accountDeletionRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      status: AccountDeletionRequestStatus.pending,
    });
    prisma.accountDeletionRequest.update.mockResolvedValue(undefined);

    await expect(
      service.rejectDeletionRequest('request-1', 'admin-1'),
    ).resolves.toEqual({
      message: 'Deletion request rejected',
    });

    expect(prisma.accountDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: expect.objectContaining({
        status: AccountDeletionRequestStatus.rejected,
        reviewedBy: 'admin-1',
        reviewNotes: 'Request rejected',
      }),
    });
  });

  it('maps deletion-request list users from current identities and profile fields', async () => {
    prisma.accountDeletionRequest.findMany.mockResolvedValue([
      {
        id: 'request-1',
        userId: 'user-1',
        status: AccountDeletionRequestStatus.pending,
        reason: 'Need to leave',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: new Date('2026-03-31T01:00:00.000Z'),
        updatedAt: new Date('2026-03-31T01:00:00.000Z'),
        user: {
          id: 'user-1',
          role: 'member',
          deletedAt: null,
          created_at: new Date('2026-03-30T01:00:00.000Z'),
          updated_at: new Date('2026-03-31T01:00:00.000Z'),
          email_verified_at: new Date('2026-03-30T02:00:00.000Z'),
          phone_verified_at: null,
          auth_identities: [
            {
              provider: 'email',
              identifier: 'member@example.com',
              verified_at: new Date('2026-03-30T02:00:00.000Z'),
            },
            {
              provider: 'phone',
              identifier: '+639171234567',
              verified_at: null,
            },
          ],
          profile: {
            first_name: 'Member',
            last_name: 'Deletion',
            date_of_birth: null,
            gender: null,
            weight_kg: null,
            height_cm: null,
            phone: null,
          },
        },
      },
    ]);

    await expect(service.getAllDeletionRequests()).resolves.toEqual({
      total: 1,
      requests: [
        expect.objectContaining({
          id: 'request-1',
          status: AccountDeletionRequestStatus.pending,
          user: expect.objectContaining({
            id: 'user-1',
            email: 'member@example.com',
            phone_no: '+639171234567',
            role: { id: 0, name: 'USER' },
            emailVerified: true,
            phoneVerified: false,
            profile: expect.objectContaining({
              firstName: 'Member',
              lastName: 'Deletion',
            }),
          }),
        }),
      ],
    });
  });
});

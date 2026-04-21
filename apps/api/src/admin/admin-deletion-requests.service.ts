import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

function getIdentityIdentifier(
  identities: Array<{
    provider: AuthProvider;
    identifier: string;
    verified_at: Date | null;
  }>,
  provider: AuthProvider,
) {
  return (
    identities.find((identity) => identity.provider === provider)?.identifier ??
    null
  );
}

function toFrontendRole(role: UserRole) {
  switch (role) {
    case UserRole.admin:
      return 'ADMIN' as const;
    case UserRole.staff:
      return 'STAFF' as const;
    case UserRole.coach:
      return 'COACH' as const;
    case UserRole.member:
    default:
      return 'USER' as const;
  }
}

@Injectable()
export class AdminDeletionRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(status?: string) {
    const where = status
      ? {
          status: status.toLowerCase() as AccountDeletionRequestStatus,
        }
      : {};

    const requests = await this.prisma.accountDeletionRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            role: true,
            deletedAt: true,
            created_at: true,
            updated_at: true,
            email_verified_at: true,
            phone_verified_at: true,
            auth_identities: {
              select: {
                provider: true,
                identifier: true,
                verified_at: true,
              },
            },
            profile: {
              select: {
                first_name: true,
                last_name: true,
                date_of_birth: true,
                gender: true,
                weight_kg: true,
                height_cm: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      total: requests.length,
      requests: requests.map((request) => {
        const email =
          getIdentityIdentifier(request.user.auth_identities, AuthProvider.email) ??
          '';
        const phone = request.user.profile?.phone ?? null;

        return {
          ...request,
          user: {
            id: request.user.id,
            email,
            phone_no: phone,
            role: {
              id: 0,
              name: toFrontendRole(request.user.role),
            },
            emailVerified:
              request.user.email_verified_at !== null ||
              request.user.auth_identities.some(
                (identity) =>
                  identity.provider === AuthProvider.email &&
                  identity.verified_at !== null,
              ),
            phoneVerified: false,
            deletedAt: request.user.deletedAt?.toISOString() ?? null,
            createdAt: request.user.created_at.toISOString(),
            updatedAt: request.user.updated_at.toISOString(),
            profile: request.user.profile
              ? {
                  firstName: request.user.profile.first_name,
                  lastName: request.user.profile.last_name,
                  dateOfBirth:
                    request.user.profile.date_of_birth?.toISOString() ?? null,
                  gender: request.user.profile.gender ?? null,
                  currentWeightKg:
                    request.user.profile.weight_kg === null
                      ? null
                      : Number(request.user.profile.weight_kg),
                  heightCm:
                    request.user.profile.height_cm === null
                      ? null
                      : Number(request.user.profile.height_cm),
                }
              : null,
          },
        };
      }),
    };
  }

  async approve(
    requestId: string,
    reviewedBy: string,
    reviewNotes?: string,
  ) {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: {
            id: true,
            auth_identities: {
              select: {
                provider: true,
                identifier: true,
                verified_at: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    if (request.status !== AccountDeletionRequestStatus.pending) {
      throw new BadRequestException('Request already processed');
    }

    await this.prisma.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: AccountDeletionRequestStatus.approved,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    await this.prisma.user.update({
      where: { id: request.userId },
      data: { deletedAt: new Date() },
    });

    return {
      message: 'User account deleted successfully',
      email: getIdentityIdentifier(
        request.user.auth_identities,
        AuthProvider.email,
      ),
    };
  }

  async reject(
    requestId: string,
    reviewedBy: string,
    reviewNotes?: string,
  ) {
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    if (request.status !== AccountDeletionRequestStatus.pending) {
      throw new BadRequestException('Request already processed');
    }

    await this.prisma.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: AccountDeletionRequestStatus.rejected,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || 'Request rejected',
      },
    });

    return {
      message: 'Deletion request rejected',
    };
  }
}

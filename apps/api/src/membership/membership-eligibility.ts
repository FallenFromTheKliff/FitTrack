import {
  AccountDeletionRequestStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';

/**
 * Shared guard for paid Membership Card and Gym Membership purchases.
 * Keeping this inside the caller's transaction makes the preflight and the
 * PayMongo completion path enforce the same account contract.
 */
export async function assertMembershipPurchaseEligible(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const member = await tx.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      deletedAt: true,
      email_verified_at: true,
      phone_verified_at: true,
    },
  });

  if (
    !member ||
    member.deletedAt ||
    member.role !== UserRole.member ||
    member.status !== UserStatus.active ||
    (!member.email_verified_at && !member.phone_verified_at)
  ) {
    throw new ConflictException({
      type: 'CONFLICT',
      title: 'Member Not Eligible',
      status: 409,
      detail:
        'Only active, verified MEMBER accounts can receive membership purchases.',
    });
  }

  const pendingTermination = await tx.accountDeletionRequest.findFirst({
    where: {
      userId,
      status: AccountDeletionRequestStatus.pending,
    },
    select: { id: true },
  });
  if (pendingTermination) {
    throw new ConflictException({
      type: 'CONFLICT',
      title: 'Member Not Eligible',
      status: 409,
      detail: 'Members pending termination cannot receive memberships.',
    });
  }
}

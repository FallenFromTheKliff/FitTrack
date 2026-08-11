import { randomBytes } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import {
  MembershipCard,
  MembershipCardSource,
  MembershipCardStatus,
  Payment,
  PaymentProvider,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';

type MembershipCardOwner = {
  deletedAt: Date | null;
  id: string;
  role: UserRole;
};

type MembershipCardPurchaseRecord = {
  membershipCard: MembershipCard;
  payment: Payment;
};

type MembershipCardWithUserProfile = MembershipCard & {
  user: {
    profile: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  };
};

const DEFAULT_MEMBERSHIP_CARD_PRICE = new Prisma.Decimal(400);
const MEMBERSHIP_CARD_PAYABLE_TYPE =
  'membership_card' as unknown as Payment['payable_type'];

@Injectable()
export class MembershipCardRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findMembershipOwnerByIdOrThrow(userId: string): Promise<MembershipCardOwner> {
    return this.findByIdOrThrow<MembershipCardOwner>(
      this.prisma.user,
      userId,
      'User',
      undefined,
      { deletedAt: true, id: true, role: true },
    );
  }

  findMembershipCardByUserId(userId: string): Promise<MembershipCard | null> {
    return this.findOne<MembershipCard>(this.prisma.membershipCard, {
      user_id: userId,
    });
  }

  findMembershipCardByIdOrThrow(id: string): Promise<MembershipCard> {
    return this.findByIdOrThrow<MembershipCard>(
      this.prisma.membershipCard,
      id,
      'MembershipCard',
    );
  }

  findMembershipCardWithUserProfileByIdOrThrow(
    id: string,
  ): Promise<MembershipCardWithUserProfile> {
    return this.findByIdOrThrow<MembershipCardWithUserProfile>(
      this.prisma.membershipCard,
      id,
      'MembershipCard',
      {
        user: {
          select: {
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    );
  }

  async createOrRefreshPendingPurchase(input: {
    idempotencyKey: string;
    provider: PaymentProvider;
    source: MembershipCardSource;
    userId: string;
  }): Promise<MembershipCardPurchaseRecord> {
    try {
      return await this.transaction(async (tx) => {
        const catalogSettings = await tx.membershipCatalogSettings.findFirst({
          select: { membership_card_price: true },
        });
        const membershipCardPrice =
          catalogSettings?.membership_card_price ?? DEFAULT_MEMBERSHIP_CARD_PRICE;
        const existingCard = await tx.membershipCard.findUnique({
          where: { user_id: input.userId },
        });

        if (existingCard?.status === MembershipCardStatus.active) {
          throw this.buildActiveCardConflict();
        }

        const purchasedAt = new Date();
        const membershipCard = existingCard
          ? await tx.membershipCard.update({
              where: { user_id: input.userId },
              data: {
                activated_at: null,
                price: membershipCardPrice,
                purchased_at: purchasedAt,
                revoke_reason: null,
                revoked_at: null,
                revoked_by: null,
                source: input.source,
                status: MembershipCardStatus.pending_verification,
                verified_at: null,
                verified_by: null,
              },
            })
          : await tx.membershipCard.create({
              data: {
                price: membershipCardPrice,
                purchased_at: purchasedAt,
                source: input.source,
                status: MembershipCardStatus.pending_verification,
                user: { connect: { id: input.userId } },
              },
            });

        const payment = await tx.payment.create({
          data: {
            amount: membershipCardPrice,
            idempotency_key: input.idempotencyKey,
            payable_id: membershipCard.id,
            payable_type: MEMBERSHIP_CARD_PAYABLE_TYPE,
            payment_stage: 'full',
            provider: input.provider,
            status:
              input.provider === PaymentProvider.cash
                ? 'awaiting_verification'
                : 'pending',
            user: { connect: { id: input.userId } },
          },
        });

        return { membershipCard, payment };
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        !this.isDuplicateMembershipCardIndexError(error)
      ) {
        throw error;
      }

      throw this.buildActiveCardConflict();
    }
  }

  async activateMembershipCard(
    id: string,
    input: { activatedAt: Date; verifiedAt: Date; verifiedBy?: string | null },
  ): Promise<MembershipCard | null> {
    return this.transaction(async (tx) => {
      const transition = await tx.membershipCard.updateMany({
        where: {
          id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: input.activatedAt,
          revoke_reason: null,
          revoked_at: null,
          revoked_by: null,
          status: MembershipCardStatus.active,
          verified_at: input.verifiedAt,
          verified_by: input.verifiedBy ?? null,
        },
      });

      if (transition.count === 0) {
        return null;
      }

      const membershipCard = await tx.membershipCard.findUnique({
        where: { id },
      });

      if (!membershipCard) {
        return null;
      }

      const owner = await tx.user.findUnique({
        where: { id: membershipCard.user_id },
        select: {
          id: true,
          qr_code_token: true,
          status: true,
        },
      });

      if (
        owner &&
        (owner.status === UserStatus.pending || !owner.qr_code_token)
      ) {
        await tx.user.update({
          where: { id: owner.id },
          data: {
            ...(owner.status === UserStatus.pending
              ? { status: UserStatus.active }
              : {}),
            ...(!owner.qr_code_token
              ? { qr_code_token: randomBytes(32).toString('hex') }
              : {}),
          },
        });
      }

      return membershipCard;
    });
  }

  async revokeMembershipCard(
    id: string,
    input: { reason: string | null; revokedAt: Date },
  ): Promise<MembershipCard | null> {
    return this.transaction(async (tx) => {
      const transition = await tx.membershipCard.updateMany({
        where: {
          id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: null,
          revoke_reason: input.reason,
          revoked_at: input.revokedAt,
          status: MembershipCardStatus.revoked,
        },
      });

      if (transition.count === 0) {
        return null;
      }

      return tx.membershipCard.findUnique({ where: { id } });
    });
  }

  private buildActiveCardConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Membership Card Already Active',
      status: 409,
      detail:
        'This account already has an active membership card. Load a plan on top of it instead of starting another card purchase.',
    });
  }

  private isDuplicateMembershipCardIndexError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.message).includes('membership_cards_user_id_key')
    );
  }
}

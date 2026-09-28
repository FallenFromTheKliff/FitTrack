import {
  AccountDeletionRequestStatus,
  MembershipCardStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { MembershipCardRepository } from './card.repository';

describe('MembershipCardRepository', () => {
  it('checks active card access against the current verified member account', async () => {
    const membershipCard = { count: jest.fn() };
    const repository = new MembershipCardRepository({
      membershipCard,
    } as never);
    membershipCard.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    await expect(
      repository.hasActiveMembershipCardAccess('member-1'),
    ).resolves.toBe(true);
    await expect(
      repository.hasActiveMembershipCardAccess('member-1'),
    ).resolves.toBe(false);

    const expectedWhere = {
      status: MembershipCardStatus.active,
      user_id: 'member-1',
      user: {
        is: {
          role: UserRole.member,
          status: UserStatus.active,
          deletedAt: null,
          OR: [
            { email_verified_at: { not: null } },
            { phone_verified_at: { not: null } },
          ],
          deletion_requests: {
            none: { status: AccountDeletionRequestStatus.pending },
          },
        },
      },
    };

    expect(membershipCard.count).toHaveBeenNthCalledWith(1, {
      where: expectedWhere,
    });
    expect(membershipCard.count).toHaveBeenNthCalledWith(2, {
      where: expectedWhere,
    });
  });
});

import { Injectable } from '@nestjs/common';
import { RetailProduct, UserRole, UserStatus } from '@prisma/client';

import { BaseRepository } from '../common/base-repository/base-repository';
import { PrismaService } from '../prisma/prisma.service';

export type InventoryAdminAlertRecipient = {
  display_name: string;
  email: string | null;
  user_id: string;
};

type AlertRecipientRecord = {
  auth_identities: { identifier: string }[];
  id: string;
  profile: {
    first_name: string;
    last_name: string;
  } | null;
};

@Injectable()
export class InventoryLifecycleRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findProductsByIds(ids: string[]): Promise<RetailProduct[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.retailProduct.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async markLowStockAlertSentIfDue(
    productId: string,
    now: Date,
    cooldownCutoff: Date,
  ): Promise<boolean> {
    const result = await this.prisma.retailProduct.updateMany({
      where: {
        id: productId,
        OR: [
          { last_low_stock_alert_at: null },
          { last_low_stock_alert_at: { lt: cooldownCutoff } },
        ],
      },
      data: {
        last_low_stock_alert_at: now,
      },
    });

    return result.count === 1;
  }

  async listAdminAlertRecipients(): Promise<InventoryAdminAlertRecipient[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.admin,
        status: UserStatus.active,
        notification_prefs: {
          is: {
            system_email: true,
          },
        },
      },
      select: {
        id: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        auth_identities: {
          where: {
            provider: {
              in: ['email', 'google'],
            },
          },
          orderBy: {
            created_at: 'asc',
          },
          select: {
            identifier: true,
          },
          take: 1,
        },
      },
    });

    return users.map((user) => this.toAlertRecipient(user));
  }

  private toAlertRecipient(
    user: AlertRecipientRecord,
  ): InventoryAdminAlertRecipient {
    const firstName = user.profile?.first_name ?? 'Admin';
    const lastName = user.profile?.last_name ?? '';

    return {
      user_id: user.id,
      display_name: `${firstName} ${lastName}`.trim(),
      email: user.auth_identities[0]?.identifier ?? null,
    };
  }
}

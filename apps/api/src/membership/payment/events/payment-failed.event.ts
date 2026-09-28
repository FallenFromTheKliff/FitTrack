import { PayableType } from '@prisma/client';

export const PAYMENT_FAILED_EVENT = 'payment.failed';

export interface PaymentFailedEvent {
  paymentId: string;
  userId: string;
  payableType: PayableType;
  payableId: string;
  amount: string;
  reason: string | null;
  failedAt: string;
}

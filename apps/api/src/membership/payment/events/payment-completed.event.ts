import { PayableType } from '@prisma/client';

export const PAYMENT_COMPLETED_EVENT = 'payment.completed';

export interface PaymentCompletedEvent {
  paymentId: string;
  userId: string;
  payableType: PayableType;
  payableId: string;
  amount: string;
}

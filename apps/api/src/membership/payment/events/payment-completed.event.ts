import { PayableType } from '@prisma/client';

export const PAYMENT_COMPLETED_EVENT = 'payment.completed';

export interface PaymentCompletedEvent {
  paymentId: string;
  userId: string;
  payableType: PayableType;
  payableId: string;
  amount: string;
  verifiedBy?: string | null;
  /**
   * Present only for a PayMongo membership-card webhook after the payment
   * transition was committed atomically. The value indicates whether the card
   * row changed in that transaction; the card listener may notify, but must
   * not perform an entitlement write.
   */
  membershipCardActivationCommitted?: boolean;
}

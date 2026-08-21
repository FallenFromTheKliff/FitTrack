export const BOOKING_CANCELLED_EVENT = 'booking.cancelled';

export interface BookingCancelledEvent {
  bookingId: string;
  userId: string;
  amenityId: string;
  cancelledAt: string;
}

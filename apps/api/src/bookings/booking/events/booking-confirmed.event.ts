export const BOOKING_CONFIRMED_EVENT = 'booking.confirmed';

export interface BookingConfirmedEvent {
  bookingId: string;
  userId: string;
  amenityId: string;
  startsAt: string;
  endsAt: string;
}

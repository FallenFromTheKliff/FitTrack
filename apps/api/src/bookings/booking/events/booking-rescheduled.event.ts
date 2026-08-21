export const BOOKING_RESCHEDULED_EVENT = 'booking.rescheduled';

export interface BookingRescheduledEvent {
  amenityId: string;
  bookingId: string;
  startsAt: string;
  userId: string;
}

export const APPOINTMENT_CANCELLED_EVENT = 'coaching.appointment.cancelled';

export interface AppointmentCancelledEvent {
  appointmentId: string;
  userId: string;
  coachId: string;
  cancelledAt: string;
}

export const APPOINTMENT_CONFIRMED_EVENT = 'coaching.appointment.confirmed';

export interface AppointmentConfirmedEvent {
  appointmentId: string;
  userId: string;
  coachId: string;
  scheduledAt: string;
  durationMinutes: number;
}

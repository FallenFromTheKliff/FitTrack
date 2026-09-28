export const APPOINTMENT_COMPLETED_EVENT = 'coaching.appointment.completed';

export interface AppointmentCompletedEvent {
  appointmentId: string;
  userId: string;
  coachId: string;
  completedAt: string;
}

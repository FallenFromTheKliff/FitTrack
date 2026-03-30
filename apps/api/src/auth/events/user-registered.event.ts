import { UserRole } from '@prisma/client';

export const USER_REGISTERED_EVENT = 'auth.user-registered';

export interface UserRegisteredEvent {
  userId: string;
  role: UserRole;
  source: 'email_verification' | 'google_login' | 'admin_create';
  registeredAt: string;
}

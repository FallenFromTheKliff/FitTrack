import type { BookingStatus } from "./base";
import type { MemberProfile } from "./member";

export interface Booking {
  id: string;
  memberId?: string;
  resourceId?: string;
  resourceName: string;
  resourceType: "venue" | "amenity" | "trainer";
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  status: BookingStatus;
  price: number;
  trainerId?: string;
  trainerName?: string;
}

export interface CreateBookingDTO {
  resourceName: string;
  resourceType: Booking["resourceType"];
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  price: number;
  trainerId?: string;
  trainerName?: string;
}

export interface Trainer {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  pricePerSession: number;
  avatarInitials: string;
}

export interface CoachAvailabilityRecord {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface CoachUserSummary {
  id: string;
  email?: string;
  phone_no?: string | null;
  createdAt?: string;
  profile?: MemberProfile | null;
}

export interface CoachProfileRecord {
  id: string;
  bio?: string | null;
  specialties?: string[];
  certifications?: string[];
  yearsExperience?: number | null;
  hourlyRate?: number | null;
  isActive?: boolean;
  availability?: CoachAvailabilityRecord[];
  user?: CoachUserSummary | null;
}
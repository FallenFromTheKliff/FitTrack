import type { BookingStatus } from "./base";
import type { MemberProfile } from "./member";

export interface Booking {
  amountDueNow?: number;
  id: string;
  memberId?: string;
  nextPaymentDate?: string;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number;
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
  totalAmount?: number;
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
  averageRating?: number | null;
  bio?: string | null;
  displayName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  specialties?: string[];
  certifications?: string[];
  yearsExperience?: number | null;
  hourlyRate?: number | null;
  monthlyRate?: number | null;
  monthlySessionCount?: number;
  monthlySessionDurationMinutes?: number;
  monthlyOfferDescription?: string | null;
  monthlyOfferActive?: boolean;
  ratingCount?: number;
  recentReviews?: CoachPublicReviewRecord[];
  scheduleType?: "full_time" | "part_time";
  isActive?: boolean;
  availability?: CoachAvailabilityRecord[];
  bookedDates?: string[];
  user?: CoachUserSummary | null;
}

export interface CoachPublicReviewRecord {
  id: string;
  rating: number;
  comment?: string | null;
  reviewerName: string;
  createdAt: string;
}

import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { LOGIN_BACKGROUND_IMAGE_URL } from "@/data/auth/auth";

export type LandingSection = "home" | "services" | "facilities" | "staff" | "about" | "contact";

export type PublicFeature = {
  copy: string;
  icon: LucideIcon;
  title: string;
};

export type HeroSection = {
  context: string;
  copy: string;
  eyebrow: string;
  secondaryLabel: string;
  secondaryTarget: LandingSection;
  title: string;
};

export type ServicePlan = {
  copy: string;
  label: string;
  points: string[];
  price: string;
  title: string;
};

export type FacilityShowcase = {
  copy: string;
  images: string[];
  meta: string;
  title: string;
};

export type StaffProfile = {
  contact: string;
  hierarchy: string;
  name: string;
  role: string;
  specialties: string;
};

export type ContactChannel = {
  href: string;
  label: string;
  value: string;
};

export type HomePreview = PublicFeature & {
  image: string;
  stat: string;
  target: Exclude<LandingSection, "home">;
};

export const PORTAL_CTA_LABEL = "Sign in";

export const NAV_ITEMS: Array<{ label: string; value: LandingSection }> = [
  { label: "Home", value: "home" },
  { label: "Services", value: "services" },
  { label: "Facilities", value: "facilities" },
  { label: "Staff", value: "staff" },
  { label: "About", value: "about" },
  { label: "Contact", value: "contact" },
];

export const LANDING_BACKGROUND_IMAGES: Record<LandingSection, string> = {
  home: LOGIN_BACKGROUND_IMAGE_URL,
  services: "url(https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80)",
  facilities: "url(https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1920&q=80)",
  staff: "url(https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=1920&q=80)",
  about: "url(https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80)",
  contact: "url(https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1920&q=80)",
};

export const HERO_CONTENT: Record<LandingSection, HeroSection> = {
  home: {
    eyebrow: "Train, book, and get moving",
    title: "FitTrack",
    copy: "Workouts, coaches, rooms, and passes before you walk in.",
    context: "Start with the workout.",
    secondaryLabel: "Explore Services",
    secondaryTarget: "services",
  },
  services: {
    eyebrow: "Services",
    title: "Pick what fits today",
    copy: "Drop in for a lift, line up a coach, reserve a court, or ask what membership makes sense for your week.",
    context: "Clear options before you talk to the desk.",
    secondaryLabel: "See Facilities",
    secondaryTarget: "facilities",
  },
  facilities: {
    eyebrow: "Facilities",
    title: "Find the room that matches your workout",
    copy: "Look around before you go: heavy sets, court runs, boxing rounds, yoga, and cooldown work.",
    context: "Pick the kind of session you feel like doing today.",
    secondaryLabel: "Meet Staff",
    secondaryTarget: "staff",
  },
  staff: {
    eyebrow: "Staff",
    title: "Meet the people who keep the visit moving",
    copy: "See who to ask when the card needs loading, the court needs booking, or the workout needs a coach in the corner.",
    context: "Desk first, coach next, workout after.",
    secondaryLabel: "About FitTrack",
    secondaryTarget: "about",
  },
  about: {
    eyebrow: "About",
    title: "Made for regular gym days",
    copy: "FitTrack keeps SertFit simple to explore, easy to join, and easier to come back to.",
    context: "See the gym, choose the workout, then keep the habit going.",
    secondaryLabel: "Contact",
    secondaryTarget: "contact",
  },
  contact: {
    eyebrow: "Contact",
    title: "Talk to the gym",
    copy: "Questions about memberships, coaching, bookings, or your first visit? Use the channel that feels easiest.",
    context: "A quick message is enough to get pointed the right way.",
    secondaryLabel: "Back Home",
    secondaryTarget: "home",
  },
};

export const HOME_HIGHLIGHTS: PublicFeature[] = [
  {
    icon: QrCode,
    title: "Get in quicker",
    copy: "Card setup, QR entry, and membership questions stay easy to understand before your workout.",
  },
  {
    icon: CalendarDays,
    title: "Plan the visit",
    copy: "Reserve the court, ask about a coach, or check which room fits the session you want.",
  },
  {
    icon: HeartPulse,
    title: "Keep training",
    copy: "Coaching, progress, food habits, and workout history stay close to the way you train.",
  },
];

export const HOME_SECTION_PREVIEWS: HomePreview[] = [
  {
    icon: QrCode,
    image: LANDING_BACKGROUND_IMAGES.services,
    stat: "Passes + coaching",
    target: "services",
    title: "Services",
    copy: "Compare day passes, membership loads, coach sessions, room bookings, and gym offers before choosing.",
  },
  {
    icon: Dumbbell,
    image: LANDING_BACKGROUND_IMAGES.facilities,
    stat: "Rooms + training",
    target: "facilities",
    title: "Facilities",
    copy: "Preview the court, ring, strength floor, yoga room, and recovery corner before you go.",
  },
  {
    icon: Users,
    image: LANDING_BACKGROUND_IMAGES.staff,
    stat: "Desk + coaches",
    target: "staff",
    title: "Staff",
    copy: "Meet the front desk and coaching team behind bookings, training help, and safer sessions.",
  },
  {
    icon: ShieldCheck,
    image: LANDING_BACKGROUND_IMAGES.about,
    stat: "Gym story",
    target: "about",
    title: "About",
    copy: "Learn what SertFit is like, who it is for, and how a normal gym day comes together.",
  },
  {
    icon: MessageCircle,
    image: LANDING_BACKGROUND_IMAGES.contact,
    stat: "Ask the gym",
    target: "contact",
    title: "Contact",
    copy: "Find email, phone, social channels, and the practical next step for membership or booking help.",
  },
];

export const SERVICE_FEATURES: PublicFeature[] = [
  {
    icon: QrCode,
    title: "Membership loads",
    copy: "One-time card setup plus daily, weekly, monthly, and yearly membership options.",
  },
  {
    icon: CalendarDays,
    title: "Court and room booking",
    copy: "Reserve the court, boxing ring, yoga room, or other workout area before your visit.",
  },
  {
    icon: Users,
    title: "Coach sessions",
    copy: "Coach rates, available slots, and session status stay clear before booking.",
  },
  {
    icon: Bot,
    title: "Ask the gym",
    copy: "Get simple answers about memberships, workouts, coaches, and bookings.",
  },
  {
    icon: CheckCircle2,
    title: "Promos and offers",
    copy: "Starter memberships, coaching bundles, and seasonal gym promos stay easy to understand.",
  },
];

export const SERVICE_PLANS: ServicePlan[] = [
  {
    label: "Membership",
    title: "Membership fees and reloads",
    price: "Daily / weekly / monthly / yearly",
    copy: "For visitors and returning members who want a simple way to start training again.",
    points: ["Card activation", "QR check-ins", "Profile and status help", "Plan comparison before checkout"],
  },
  {
    label: "Coaching",
    title: "Guided training",
    price: "Coach-specific rates",
    copy: "Ask for strength, mobility, boxing, or recovery guidance with clear coach rates.",
    points: ["Coach availability", "Session requests", "Cash desk help", "Strength, mobility, boxing, and recovery guidance"],
  },
  {
    label: "Bookings",
    title: "Room and court booking",
    price: "By amenity and time",
    copy: "Reserve the area that fits the workout instead of guessing when you arrive.",
    points: ["Basketball court", "Boxing ring", "Yoga room", "Recovery corner"],
  },
  {
    label: "Offers",
    title: "Gym promotions",
    price: "Seasonal bundles",
    copy: "Starter memberships, coaching bundles, and event-ready offers are easy to understand before checkout.",
    points: ["Starter monthly membership", "Coach bundle previews", "Promo details", "Desk-assisted checkout"],
  },
];

export const FACILITY_SHOWCASE: FacilityShowcase[] = [
  {
    title: "Strength Floor",
    copy: "Racks, plates, cable work, and room to build a strength rhythm that feels serious without feeling confusing.",
    meta: "Training core",
    images: ["url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80)"],
  },
  {
    title: "Basketball Court",
    copy: "A clear court view for runs, skill work, small-group conditioning, and sessions that need room.",
    meta: "Reservable amenity",
    images: ["url(https://images.unsplash.com/photo-1546519638-68e109498ffc?w=900&q=80)"],
  },
  {
    title: "Boxing Ring",
    copy: "Rounds, mitt work, footwork, and conditioning blocks for members who want a coach-led push.",
    meta: "Coach-ready area",
    images: ["url(https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=900&q=80)"],
  },
  {
    title: "Yoga Room",
    copy: "A quieter room for mobility, stretching, breathing work, and low-impact sessions between heavier training days.",
    meta: "Recovery room",
    images: ["url(https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&q=80)"],
  },
  {
    title: "Recovery Corner",
    copy: "Cooldown work, mobility help, and low-intensity coaching for members keeping the next workout in mind.",
    meta: "Cooldown zone",
    images: ["url(https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80)"],
  },
];

export const STAFF_DIRECTORY: StaffProfile[] = [
  {
    name: "Front Desk Team",
    role: "Membership, check-in, and account help",
    hierarchy: "First point of contact",
    specialties: "Card activation, membership loads, booking help, account checks, payment guidance",
    contact: "contact@sertfit.com",
  },
  {
    name: "Coach Ridge",
    role: "Strength and conditioning coach",
    hierarchy: "Coaching team",
    specialties: "Strength onboarding, form checks, member progression, conditioning blocks, gym-floor confidence",
    contact: "Book with a member account or ask the front desk",
  },
  {
    name: "Coach Ivy",
    role: "Mobility and recovery coach",
    hierarchy: "Coaching team",
    specialties: "Yoga flow, recovery sessions, breathing work, low-impact mobility, beginner-friendly resets",
    contact: "Book with a member account or ask the front desk",
  },
  {
    name: "Coach Marco",
    role: "Boxing and performance coach",
    hierarchy: "Coaching team",
    specialties: "Mitt work, boxing fundamentals, footwork, conditioning intervals, session readiness",
    contact: "Ask the front desk for availability",
  },
];

export const ABOUT_STEPS = [
  {
    label: "1",
    title: "Discover",
    copy: "Visitors can see the workouts, coaches, rooms, and membership choices before walking in.",
  },
  {
    label: "2",
    title: "Pick a pass",
    copy: "Card setup, QR check-ins, and membership status stay easy to ask about at the desk.",
  },
  {
    label: "3",
    title: "Choose the room",
    copy: "Courts, rooms, and coach sessions are shown around the workout you want to do.",
  },
  {
    label: "4",
    title: "Train with a plan",
    copy: "Workouts, food habits, coaching, and progress stay close once the visit starts.",
  },
  {
    label: "5",
    title: "Keep coming back",
    copy: "The same simple rhythm can grow with new workouts, new offers, and a wider gym community.",
  },
];

export const CONTACT_CHANNELS: ContactChannel[] = [
  { label: "Email", value: "contact@sertfit.com", href: "mailto:contact@sertfit.com" },
  { label: "Phone", value: "+63 928 123 4567", href: "tel:+639281234567" },
  { label: "Facebook", value: "SertFit Gym", href: "https://www.facebook.com/sertfitgym" },
  { label: "Instagram", value: "@sertfitgym", href: "https://www.instagram.com/sertfitgym/" },
];

export const CONTACT_HELP_ITEMS: PublicFeature[] = [
  {
    icon: MessageCircle,
    title: "Membership questions",
    copy: "Ask about card setup, membership loads, payments, entry rules, or which option makes sense for the week you want to train. The desk can keep it practical and point you to the next step.",
  },
  {
    icon: CalendarDays,
    title: "Booking questions",
    copy: "Need a court, room, coach session, or a better time to visit? Send the question with the workout in mind and staff can help you find the cleanest opening.",
  },
  {
    icon: ShieldCheck,
    title: "First-visit questions",
    copy: "New visitors can ask about what to bring, where to start, and who to talk to first. A simple message is enough to make the first trip feel less like guesswork.",
  },
];

export const WHY_FITTRACK_ITEMS: PublicFeature[] = [
  {
    icon: CheckCircle2,
    title: "See the gym first",
    copy: "The first view shows the workout experience before asking anyone to sign in.",
  },
  {
    icon: Dumbbell,
    title: "Training comes first",
    copy: "Passes, rooms, and coaching stay connected to real workouts.",
  },
  {
    icon: Users,
    title: "People feel reachable",
    copy: "Staff and coaches appear as real people who help members get started and keep training.",
  },
];

"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  LogIn,
  MapPinned,
  Menu,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { LOGIN_BACKGROUND_IMAGE_URL } from "@/data/auth/auth";
import { useSectionTransition } from "@/hooks/animations/useSectionTransition";

type LandingSection = "home" | "services" | "facilities" | "staff" | "about" | "contact";

type PublicFeature = {
  copy: string;
  icon: LucideIcon;
  title: string;
};

type HeroSection = {
  copy: string;
  ctaLabel: string;
  eyebrow: string;
  metrics: Array<{ label: string; value: string }>;
  secondaryLabel: string;
  secondaryTarget: LandingSection;
  title: string;
};

const NAV_ITEMS: Array<{ label: string; value: LandingSection }> = [
  { label: "Home", value: "home" },
  { label: "Services", value: "services" },
  { label: "Facilities", value: "facilities" },
  { label: "Staff", value: "staff" },
  { label: "About", value: "about" },
  { label: "Contact", value: "contact" },
];

const LANDING_BACKGROUND_IMAGES: Record<LandingSection, string> = {
  home: LOGIN_BACKGROUND_IMAGE_URL,
  services: "url(https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80)",
  facilities: "url(https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1920&q=80)",
  staff: "url(https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=1920&q=80)",
  about: "url(https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&q=80)",
  contact: "url(https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1920&q=80)",
};

const SERVICE_FEATURES: PublicFeature[] = [
  {
    icon: QrCode,
    title: "Member Access",
    copy: "Membership status, attendance QR access, and profile details stay available from the member app.",
  },
  {
    icon: CalendarDays,
    title: "Reservations",
    copy: "Members can browse facilities, reserve eligible spaces, and track booking status in one place.",
  },
  {
    icon: HeartPulse,
    title: "Workout Progress",
    copy: "Workout history, exercise review, mastery progress, and daily training context help members stay consistent.",
  },
  {
    icon: Bot,
    title: "Gym Chat Support",
    copy: "FitTrack helps answer gym, membership, nutrition, workout, and booking questions using member-safe context.",
  },
];

const FACILITY_FEATURES: PublicFeature[] = [
  {
    icon: MapPinned,
    title: "Training Spaces",
    copy: "Gym floor areas, reservable courts, and activity spaces are presented around real member use.",
  },
  {
    icon: Dumbbell,
    title: "Equipment Readiness",
    copy: "Members can understand what each training space supports before they arrive.",
  },
  {
    icon: CalendarDays,
    title: "Coaching Slots",
    copy: "Coach availability and appointment flows support guided sessions without crowding the member journey.",
  },
];

const STAFF_FEATURES: PublicFeature[] = [
  {
    icon: Users,
    title: "Front Desk Help",
    copy: "Staff assist with membership questions, attendance concerns, reservations, and account support.",
  },
  {
    icon: ShieldCheck,
    title: "Safe Operations",
    copy: "The public experience keeps the focus on member help, coaching, access, and facility guidance.",
  },
  {
    icon: MessageCircle,
    title: "Guided Handoffs",
    copy: "Questions about coaching, facility use, and member access can be routed to the right gym team member.",
  },
];

const MEMBER_SNAPSHOT_ITEMS: Record<LandingSection, PublicFeature[]> = {
  home: [
    { icon: QrCode, title: "QR access", copy: "Member entry starts from a clear account status and scan-ready access." },
    { icon: CalendarDays, title: "Booking path", copy: "Reservations and coaching appointments stay easy to find from the member journey." },
    { icon: HeartPulse, title: "Training context", copy: "Workout progress, exercise history, and daily consistency remain visible to members." },
  ],
  services: [
    { icon: QrCode, title: "Access service", copy: "Members can understand how entry, account readiness, and profile support fit together." },
    { icon: CalendarDays, title: "Reservation service", copy: "Facility and coaching bookings are framed as member actions, not internal operations." },
    { icon: Bot, title: "Support service", copy: "Gym-safe answers help with memberships, workouts, nutrition, and booking questions." },
  ],
  facilities: [
    { icon: MapPinned, title: "Spaces", copy: "Training areas are introduced around how members use them during a visit." },
    { icon: Dumbbell, title: "Equipment", copy: "Equipment context helps members choose the right space before they arrive." },
    { icon: CalendarDays, title: "Reservations", copy: "Reservable areas stay tied to the member booking path." },
  ],
  staff: [
    { icon: Users, title: "Front desk", copy: "Staff support account setup, member access, and reservation concerns." },
    { icon: ShieldCheck, title: "Operational care", copy: "The public page keeps staff help visible without exposing internal dashboards." },
    { icon: MessageCircle, title: "Handoffs", copy: "Members know where to route coaching, facility, and access questions." },
  ],
  about: [
    { icon: ShieldCheck, title: "Public-safe", copy: "The story stays member-oriented and avoids private staff workflows." },
    { icon: HeartPulse, title: "Daily gym use", copy: "FitTrack centers access, workouts, guidance, reservations, and support." },
    { icon: Dumbbell, title: "Connected fitness", copy: "Member and staff interactions are represented as one gym experience." },
  ],
  contact: [
    { icon: MessageCircle, title: "Membership help", copy: "Members can reach the gym team for account, status, and access questions." },
    { icon: CalendarDays, title: "Booking help", copy: "Reservation and appointment concerns stay routed to staff support." },
    { icon: Users, title: "Team handoff", copy: "Staff can guide new members into the FitTrack experience." },
  ],
};

const MEMBER_SNAPSHOT_COPY: Record<LandingSection, { eyebrow: string; title: string; copy: string }> = {
  home: {
    eyebrow: "Member Snapshot",
    title: "What members see first",
    copy: "The public story is anchored on the member journey: account access, reservations, workouts, and support without showing internal tools.",
  },
  services: {
    eyebrow: "Member Snapshot",
    title: "Services are grouped around real gym actions",
    copy: "Each service reads as something a member can understand and request, rather than a staff-side operating module.",
  },
  facilities: {
    eyebrow: "Member Snapshot",
    title: "Facility context supports planning a visit",
    copy: "Members get the shape of the spaces and booking path without exposing layout management or administrative controls.",
  },
  staff: {
    eyebrow: "Member Snapshot",
    title: "Staff remain visible as helpers",
    copy: "The staff page explains assistance, coaching handoffs, and support without turning into an employee directory or dashboard.",
  },
  about: {
    eyebrow: "Member Snapshot",
    title: "FitTrack is presented as a connected gym experience",
    copy: "The about page keeps the product story member-safe while still explaining why access, reservations, training, and support belong together.",
  },
  contact: {
    eyebrow: "Member Snapshot",
    title: "Contact paths stay practical",
    copy: "The contact page points members toward the right type of help for access, bookings, and account questions.",
  },
};

const HERO_CONTENT: Record<LandingSection, HeroSection> = {
  home: {
    eyebrow: "Gym member experience platform",
    title: "FitTrack",
    copy:
      "Memberships, reservations, coaching, workouts, nutrition context, and support in one connected gym experience.",
    ctaLabel: "Member / Team Login",
    secondaryLabel: "View Services",
    secondaryTarget: "services",
    metrics: [
      { label: "Access", value: "QR" },
      { label: "Bookings", value: "Live" },
      { label: "Coaching", value: "Ready" },
    ],
  },
  services: {
    eyebrow: "Services",
    title: "Services members actually use",
    copy:
      "FitTrack keeps the public promise concise: access, reservations, workout progress, and member-safe support.",
    ctaLabel: "Open Portal",
    secondaryLabel: "See Facilities",
    secondaryTarget: "facilities",
    metrics: [
      { label: "Member app", value: "1" },
      { label: "Core flows", value: "4" },
      { label: "Support", value: "AI" },
    ],
  },
  facilities: {
    eyebrow: "Facilities",
    title: "Spaces, equipment, and reservations",
    copy:
      "Members see the spaces they can use, the activities each area supports, and the booking path that fits their visit.",
    ctaLabel: "Log In",
    secondaryLabel: "Meet Staff",
    secondaryTarget: "staff",
    metrics: [
      { label: "Floors", value: "3" },
      { label: "Spaces", value: "Mapped" },
      { label: "Booking", value: "Guided" },
    ],
  },
  staff: {
    eyebrow: "Staff",
    title: "A better handoff between members and the gym team",
    copy:
      "Front desk and coaching teams stay close to member needs without turning the public page into an internal dashboard.",
    ctaLabel: "Log In",
    secondaryLabel: "About FitTrack",
    secondaryTarget: "about",
    metrics: [
      { label: "Front desk", value: "Help" },
      { label: "Coaches", value: "Slots" },
      { label: "Ops", value: "Clear" },
    ],
  },
  about: {
    eyebrow: "About",
    title: "FitTrack connects the public gym journey",
    copy:
      "The platform is built around the daily gym relationship: access, guidance, reservations, workouts, and answers.",
    ctaLabel: "Open Portal",
    secondaryLabel: "Contact",
    secondaryTarget: "contact",
    metrics: [
      { label: "Context", value: "Gym" },
      { label: "Audience", value: "Members" },
      { label: "Ops", value: "Hidden" },
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Questions about FitTrack access?",
    copy:
      "Use the portal if you already have an account. For memberships, bookings, and facility support, contact your gym team.",
    ctaLabel: "Log In",
    secondaryLabel: "Back Home",
    secondaryTarget: "home",
    metrics: [
      { label: "Membership", value: "Help" },
      { label: "Bookings", value: "Help" },
      { label: "Support", value: "Staff" },
    ],
  },
};

export default function FitTrackLandingPage() {
  const { colors, onBrandTextColor } = useTheme();
  const [activeSection, setActiveSection] = useState<LandingSection>("home");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { renderedValue: renderedSection, style: sectionTransitionStyle } =
    useSectionTransition(activeSection, { duration: 920, fromY: 0 });
  const hero = HERO_CONTENT[renderedSection];
  const heroBackgroundImage = `linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.72) 48%, rgba(0,0,0,0.48) 100%), ${LANDING_BACKGROUND_IMAGES[renderedSection]}`;
  const sectionStyle = useMemo<CSSProperties>(
    () => ({
      borderTop: `1px solid ${colors.border}`,
      backgroundColor: colors.surface,
      minHeight: 360,
      padding: "34px clamp(18px, 5vw, 72px)",
    }),
    [colors.border, colors.surface],
  );

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileSidebarOpen]);

  const handleSectionSelect = (section: LandingSection) => {
    setActiveSection(section);
    setIsMobileSidebarOpen(false);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: colors.base,
        color: colors.textPrimary,
      }}
    >
      <section
        style={{
          minHeight: "82vh",
          position: "relative",
          overflow: "hidden",
          display: "grid",
          alignItems: "end",
          backgroundImage: heroBackgroundImage,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <header
          className="landing-header"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.30)",
            borderBottom: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            gap: 16,
            justifyContent: "space-between",
            padding: "18px clamp(18px, 5vw, 72px)",
            backdropFilter: "blur(14px)",
          }}
        >
          <button
            type="button"
            onClick={() => handleSectionSelect("home")}
            style={{
              alignItems: "center",
              background: "transparent",
              border: 0,
              color: "#fff",
              cursor: "pointer",
              display: "inline-flex",
              gap: 10,
              padding: 0,
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                backgroundColor: colors.brand,
              }}
            >
              <Dumbbell size={20} color={onBrandTextColor} />
            </span>
            <span style={{ fontSize: 23, fontWeight: 900 }}>FitTrack</span>
          </button>

          <nav
            className="landing-desktop-nav"
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "flex-end",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSectionSelect(item.value)}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid transparent",
                    borderRadius: 8,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.72)",
                    cursor: "pointer",
                    textShadow: isActive ? `0 0 16px ${colors.brand}` : "none",
                    fontSize: 13,
                    fontWeight: 850,
                    padding: "8px 10px",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
            <Link
              href="/login"
              style={{
                backgroundColor: colors.brand,
                borderRadius: 8,
                color: onBrandTextColor,
                fontSize: 13,
                fontWeight: 900,
                padding: "10px 14px",
                textDecoration: "none",
              }}
            >
              Log In
            </Link>
          </nav>
          <button
            type="button"
            className="landing-mobile-menu-button"
            aria-label="Open landing navigation"
            aria-expanded={isMobileSidebarOpen}
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              display: "none",
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <Menu size={21} strokeWidth={2.25} />
          </button>
        </header>
        <div
          className="landing-mobile-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setIsMobileSidebarOpen(false)}
          style={{
            backgroundColor: "rgba(0,0,0,0.62)",
            inset: 0,
            opacity: isMobileSidebarOpen ? 1 : 0,
            pointerEvents: isMobileSidebarOpen ? "auto" : "none",
            position: "fixed",
            transition: "opacity 200ms ease",
            zIndex: 55,
          }}
        />
        <aside
          className="landing-mobile-sidebar"
          aria-label="Landing navigation"
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRight: `1px solid ${colors.border}`,
            bottom: 0,
            color: colors.textPrimary,
            display: "flex",
            flexDirection: "column",
            left: 0,
            padding: "14px 16px 18px",
            position: "fixed",
            top: 0,
            transform: isMobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 240ms ease",
            width: "min(84vw, 320px)",
            zIndex: 60,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 10,
              minHeight: 56,
              paddingBottom: 14,
            }}
          >
            <span
              style={{
                alignItems: "center",
                backgroundColor: colors.brand,
                borderRadius: 10,
                display: "inline-flex",
                height: 42,
                justifyContent: "center",
                width: 42,
              }}
            >
              <Dumbbell size={22} color={onBrandTextColor} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <FitText style={{ color: colors.textPrimary, display: "block", fontSize: 22, fontWeight: 900 }}>
                FitTrack
              </FitText>
              <FitText as="p" style={{ color: colors.textMuted, display: "block", fontSize: 12, margin: "1px 0 0" }}>
                Public Site
              </FitText>
            </div>
            <button
              type="button"
              aria-label="Close landing navigation"
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{
                alignItems: "center",
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                cursor: "pointer",
                display: "inline-flex",
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>
          <div style={{ backgroundColor: colors.border, height: 1, marginBottom: 12 }} />
          <nav
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
              padding: "2px 0 12px",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSectionSelect(item.value)}
                  style={{
                    alignItems: "center",
                    backgroundColor: isActive ? colors.brand : "transparent",
                    border: 0,
                    borderRadius: 12,
                    color: isActive ? onBrandTextColor : colors.textSecondary,
                    cursor: "pointer",
                    display: "flex",
                    fontSize: 16,
                    fontWeight: isActive ? 800 : 650,
                    justifyContent: "space-between",
                    minHeight: 46,
                    padding: "0 12px",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  {item.label}
                  {isActive ? <ChevronRight size={18} strokeWidth={2.3} /> : null}
                </button>
              );
            })}
          </nav>
          <div style={{ backgroundColor: colors.border, height: 1, marginBottom: 12 }} />
          <Link
            href="/login"
            onClick={() => setIsMobileSidebarOpen(false)}
            style={{
              alignItems: "center",
              backgroundColor: colors.brand,
              borderRadius: 12,
              color: onBrandTextColor,
              display: "flex",
              fontSize: 16,
              fontWeight: 900,
              gap: 10,
              justifyContent: "center",
              minHeight: 48,
              textDecoration: "none",
            }}
          >
            <LogIn size={18} strokeWidth={2.25} />
            Log In
          </Link>
        </aside>

        <div
          style={{
            width: "min(1040px, calc(100% - 40px))",
            margin: "0 auto",
            padding: "116px 0 70px",
            position: "relative",
            zIndex: 1,
            ...sectionTransitionStyle,
          }}
        >
          <FitText
            as="p"
            style={{
              color: colors.brand,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {hero.eyebrow}
          </FitText>
          <FitText
            as="h1"
            style={{
              color: "#fff",
              fontSize: "clamp(44px, 7vw, 86px)",
              fontWeight: 950,
              lineHeight: 0.98,
              margin: 0,
              maxWidth: 820,
            }}
          >
            {hero.title}
          </FitText>
          <FitText
            as="p"
            style={{
              color: "rgba(255,255,255,0.76)",
              fontSize: 18,
              lineHeight: 1.58,
              marginTop: 18,
              maxWidth: 650,
            }}
          >
            {hero.copy}
          </FitText>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 24,
              width: "100%",
              maxWidth: 430,
            }}
          >
            {hero.metrics.map((metric) => (
              <div
                key={`${renderedSection}-${metric.label}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  padding: "10px 12px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <FitText
                  style={{
                    color: "rgba(255,255,255,0.56)",
                    display: "block",
                    fontSize: 11,
                    fontWeight: 850,
                    textTransform: "uppercase",
                  }}
                >
                  {metric.label}
                </FitText>
                <FitText
                  style={{
                    color: "#fff",
                    display: "block",
                    fontSize: 18,
                    fontWeight: 950,
                    marginTop: 3,
                  }}
                >
                  {metric.value}
                </FitText>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
            <Link
              href="/login"
              style={{
                alignItems: "center",
                backgroundColor: colors.brand,
                borderRadius: 8,
                color: onBrandTextColor,
                display: "inline-flex",
                fontWeight: 900,
                gap: 8,
                minHeight: 44,
                padding: "0 18px",
                textDecoration: "none",
              }}
            >
              {hero.ctaLabel} <ChevronRight size={17} />
            </Link>
            <button
              type="button"
              onClick={() => handleSectionSelect(hero.secondaryTarget)}
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.24)",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer",
                display: "inline-flex",
                fontWeight: 900,
                minHeight: 44,
                padding: "0 18px",
              }}
            >
              {hero.secondaryLabel}
            </button>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: "grid", gap: 18, ...sectionTransitionStyle }}>
          {renderedSection === "home" ? (
            <LandingPanel
              eyebrow="Home"
              title="A clearer way to move through the gym"
              copy="FitTrack presents the member-facing journey first: access your account, book the spaces you need, get coaching help, track workouts, and ask support questions without exposing internal operations."
              features={[
                { icon: CheckCircle2, title: "Membership-aware", copy: "Member access and QR readiness are tied to the account experience." },
                { icon: CalendarDays, title: "Booking-ready", copy: "Reservations and coaching appointments stay visible from the member side." },
                { icon: Dumbbell, title: "Training-centered", copy: "Workouts, exercise progress, and fitness context keep the app focused on gym use." },
              ]}
            />
          ) : null}
          {renderedSection === "services" ? (
            <LandingPanel
              eyebrow="Services"
              title="Services members actually use"
              copy="The public page focuses on FitTrack services that can be safely shown to anyone evaluating the gym experience."
              features={SERVICE_FEATURES}
            />
          ) : null}
          {renderedSection === "facilities" ? (
            <LandingPanel
              eyebrow="Facilities"
              title="Spaces, equipment, and reservations"
              copy="FitTrack keeps facility context understandable for members: what spaces are available, how reservations fit into the visit, and where to get help."
              features={FACILITY_FEATURES}
            />
          ) : null}
          {renderedSection === "staff" ? (
            <LandingPanel
              eyebrow="About Staff"
              title="The gym team stays part of the experience"
              copy="FitTrack supports the people who help members check in, reserve spaces, start coaching sessions, and resolve account questions."
              features={STAFF_FEATURES}
            />
          ) : null}
          {renderedSection === "about" ? (
            <LandingPanel
              eyebrow="About Us"
              title="FitTrack connects the public gym journey"
              copy="The platform is built around the daily gym relationship: members need access, guidance, reservations, workouts, and answers; staff need a structured way to keep those experiences reliable."
              features={[
                { icon: ShieldCheck, title: "Public-safe by design", copy: "The landing page avoids internal dashboards, private counts, and role-specific operating details." },
                { icon: HeartPulse, title: "Member-first context", copy: "Public messaging follows the mobile member journey instead of internal management screens." },
                { icon: Dumbbell, title: "Gym-specific", copy: "Every section is grounded in FitTrack's membership, coaching, facility, and workout flows." },
              ]}
            />
          ) : null}
          {renderedSection === "contact" ? (
            <LandingPanel
              eyebrow="Contact Us"
              title="Questions about FitTrack access?"
              copy="Use the portal login if you already have an account. For memberships, coaching, bookings, and facility support, contact the gym team through the channels provided by your branch."
              features={[
                { icon: MessageCircle, title: "Membership help", copy: "Ask staff about membership status, attendance access, and account setup." },
                { icon: CalendarDays, title: "Booking help", copy: "Get support for facility reservations and coaching appointment concerns." },
                { icon: Users, title: "Staff assistance", copy: "The gym team can guide new members through the FitTrack member experience." },
              ]}
            />
          ) : null}
          <LandingSnapshotSection section={renderedSection} />
        </div>
      </section>

      <footer
        style={{
          alignItems: "center",
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          padding: "22px clamp(18px, 5vw, 72px)",
        }}
      >
        <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
          FitTrack presents member-facing gym services without exposing internal
          operational details.
        </FitText>
        <Link
          href="/login"
          style={{
            color: colors.brand,
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Open Portal
        </Link>
      </footer>

      <style>{`
        @media (max-width: 860px) {
          .landing-header {
            align-items: center !important;
            flex-direction: row !important;
            min-height: 74px !important;
          }

          .landing-desktop-nav {
            display: none !important;
          }

          .landing-mobile-menu-button {
            display: inline-flex !important;
            flex-shrink: 0;
          }

          .landing-feature-grid {
            grid-template-columns: 1fr !important;
          }

          .landing-snapshot-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function LandingSnapshotSection({ section }: { section: LandingSection }) {
  const { colors } = useTheme();
  const content = MEMBER_SNAPSHOT_COPY[section];
  const visibleItems = MEMBER_SNAPSHOT_ITEMS[section];

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        backgroundColor: colors.surfaceRaised,
        display: "grid",
        gap: 16,
        padding: 18,
      }}
    >
      <div style={{ maxWidth: 820 }}>
        <FitText
          as="p"
          style={{
            color: colors.brand,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {content.eyebrow}
        </FitText>
        <FitText
          as="h3"
          style={{
            color: colors.textPrimary,
            fontSize: "clamp(24px, 3vw, 36px)",
            fontWeight: 950,
            lineHeight: 1.05,
            margin: "8px 0 0",
          }}
        >
          {content.title}
        </FitText>
        <FitText
          as="p"
          style={{
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 1.6,
            marginTop: 10,
            maxWidth: 720,
          }}
        >
          {content.copy}
        </FitText>
      </div>
      <div
        className="landing-snapshot-grid"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {visibleItems.map((item) => (
          <article
            key={`${section}-${item.title}`}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              backgroundColor: colors.surface,
              display: "grid",
              gap: 10,
              minHeight: 138,
              padding: 16,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: `${colors.brand}22`,
                display: "grid",
                placeItems: "center",
                marginBottom: 2,
              }}
            >
              <item.icon size={17} color={colors.brand} />
            </span>
            <FitText style={{ display: "block", fontSize: 16, fontWeight: 900 }}>
              {item.title}
            </FitText>
            <FitText style={{ color: colors.textSecondary, display: "block", fontSize: 13, lineHeight: 1.55 }}>
              {item.copy}
            </FitText>
          </article>
        ))}
      </div>
    </div>
  );
}

function LandingPanel({
  copy,
  eyebrow,
  features,
  title,
}: {
  copy: string;
  eyebrow: string;
  features: PublicFeature[];
  title: string;
}) {
  const { colors } = useTheme();

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ maxWidth: 860 }}>
        <FitText
          as="p"
          style={{
            color: colors.brand,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </FitText>
        <FitText
          as="h2"
          style={{
            fontSize: "clamp(30px, 4vw, 52px)",
            fontWeight: 950,
            lineHeight: 1.02,
            margin: "8px 0 0",
          }}
        >
          {title}
        </FitText>
        <FitText
          as="p"
          style={{
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 1.62,
            marginTop: 12,
            maxWidth: 760,
          }}
        >
          {copy}
        </FitText>
      </div>
      <div
        className="landing-feature-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {features.map((feature) => (
          <article
            key={feature.title}
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              display: "grid",
              gap: 12,
              minHeight: 180,
              padding: 18,
            }}
          >
            <feature.icon size={23} color={colors.brand} />
            <FitText style={{ fontSize: 18, fontWeight: 900 }}>
              {feature.title}
            </FitText>
            <FitText style={{ color: colors.textSecondary, fontSize: 13.5, lineHeight: 1.55 }}>
              {feature.copy}
            </FitText>
          </article>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, LogIn, Menu, X } from "lucide-react";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { useSectionTransition } from "@/hooks/animations/useSectionTransition";
import type { ThemeColors } from "@fittrack/ui/tokens";

import {
  ABOUT_STEPS,
  CONTACT_CHANNELS,
  CONTACT_HELP_ITEMS,
  FACILITY_SHOWCASE,
  HERO_CONTENT,
  HOME_HIGHLIGHTS,
  HOME_SECTION_PREVIEWS,
  LANDING_BACKGROUND_IMAGES,
  NAV_ITEMS,
  PORTAL_CTA_LABEL,
  SERVICE_FEATURES,
  SERVICE_PLANS,
  STAFF_DIRECTORY,
  WHY_FITTRACK_ITEMS,
  type LandingSection,
  type PublicFeature,
} from "./helpers";

type LandingContentVariant = "intro" | "media" | "detail" | "accent" | "final";
type CarouselSlide = {
  copy: string;
  image?: string;
  label: string;
  mode: "collage" | "single";
};

function mixColor(foreground: string, foregroundWeight: number, background: string) {
  return `color-mix(in srgb, ${foreground} ${foregroundWeight}%, ${background})`;
}

function getLandingSectionBackground(colors: ThemeColors, variant: LandingContentVariant) {
  switch (variant) {
    case "media":
      return colors.surfaceRaised;
    case "detail":
      return colors.surface;
    case "accent":
      return mixColor(colors.brand, 9, colors.surface);
    case "final":
      return colors.base;
    case "intro":
    default:
      return colors.surface;
  }
}

function getLandingSectionPadding(variant: LandingContentVariant, compact: boolean) {
  if (variant === "media") {
    return 0;
  }

  if (variant === "final") {
    return compact ? "clamp(42px, 6vw, 84px) 0" : "clamp(56px, 7vw, 104px) 0";
  }

  if (variant === "detail" || variant === "accent") {
    return compact ? "clamp(40px, 6vw, 76px) 0" : "clamp(52px, 7vw, 96px) 0";
  }

  return compact ? "clamp(38px, 5vw, 72px) 0" : "clamp(50px, 7vw, 92px) 0";
}

function getLandingSectionMinHeight(variant: LandingContentVariant, compact: boolean) {
  if (variant === "media") return "clamp(500px, 64vh, 700px)";
  if (variant === "detail" || variant === "accent") return compact ? "clamp(300px, 38vh, 480px)" : "clamp(360px, 46vh, 620px)";
  if (variant === "final") return compact ? "clamp(280px, 34vh, 460px)" : "clamp(340px, 42vh, 560px)";
  return compact ? "clamp(280px, 36vh, 460px)" : "clamp(340px, 44vh, 560px)";
}

function getLandingSectionWidth(variant: LandingContentVariant) {
  if (variant === "media") return "100%";
  return "calc(100% - clamp(32px, 5vw, 96px))";
}

function getLandingSectionMaxWidth(variant: LandingContentVariant) {
  if (variant === "media") return undefined;
  return 1760;
}

function getHeroSectionBackground(colors: ThemeColors, section: LandingSection) {
  switch (section) {
    case "services":
      return mixColor(colors.brand, 16, "#050505");
    case "facilities":
      return mixColor(colors.brand, 6, "white");
    case "staff":
      return mixColor(colors.brand, 9, "#070707");
    case "about":
      return mixColor(colors.brand, 8, "white");
    case "contact":
      return mixColor(colors.brand, 13, "#050505");
    case "home":
    default:
      return colors.base;
  }
}

function isDarkHeroSection(section: LandingSection) {
  return section === "home" || section === "services" || section === "staff" || section === "contact";
}

function isLightHeroSection(section: LandingSection) {
  return section === "facilities" || section === "about";
}

function getHeroImageStyle(section: LandingSection): CSSProperties {
  const base: CSSProperties = {
    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.52)), ${LANDING_BACKGROUND_IMAGES[section]}`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    clipPath: "none",
    pointerEvents: "none",
    position: "absolute",
    top: 74,
    bottom: 0,
    zIndex: 0,
  };

  switch (section) {
    case "facilities":
      return { ...base, left: 0, width: "min(46vw, 720px)" };
    case "staff":
      return { ...base, left: 0, right: 0, opacity: 0.42, width: "100%" };
    case "about":
      return { ...base, right: 0, width: "min(54vw, 840px)" };
    case "contact":
      return { ...base, left: 0, width: "min(40vw, 640px)" };
    case "services":
    default:
      return { ...base, right: 0, width: "min(48vw, 760px)" };
  }
}

function getHeroContentLayout(section: LandingSection): CSSProperties {
  const base: CSSProperties = {
    margin: "0 auto",
    paddingBottom: 68,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 140,
    position: "relative",
    width: section === "home" ? "min(1060px, calc(100% - 40px))" : "min(1320px, calc(100% - 40px))",
    zIndex: 1,
  };

  switch (section) {
    case "home":
      return {
        ...base,
        alignSelf: "center",
        display: "grid",
        justifyItems: "center",
        paddingBottom: 78,
        paddingTop: 128,
        textAlign: "center",
      };
    case "facilities":
      return {
        ...base,
        alignSelf: "start",
        display: "grid",
        justifyItems: "end",
        paddingTop: "clamp(138px, 17vh, 190px)",
        textAlign: "right",
      };
    case "staff":
      return {
        ...base,
        alignSelf: "center",
        display: "grid",
        justifyItems: "center",
        paddingBottom: "clamp(72px, 10vh, 112px)",
        paddingTop: "clamp(126px, 14vh, 168px)",
        textAlign: "center",
      };
    case "about":
      return {
        ...base,
        alignSelf: "end",
        display: "grid",
        justifyItems: "start",
        paddingBottom: "clamp(72px, 12vh, 126px)",
        textAlign: "left",
      };
    case "contact":
      return {
        ...base,
        display: "grid",
        justifyItems: "end",
        textAlign: "right",
      };
    case "services":
    default:
      return {
        ...base,
        display: "grid",
        justifyItems: "start",
        textAlign: "left",
      };
  }
}

export default function LandingPage() {
  const { colors, onBrandTextColor } = useTheme();
  const [activeSection, setActiveSection] = useState<LandingSection>("home");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { renderedValue: renderedSection, style: sectionTransitionStyle } =
    useSectionTransition(activeSection, { duration: 620, fromY: 0 });
  const hero = HERO_CONTENT[renderedSection];
  const isHomeSection = renderedSection === "home";
  const heroBackgroundImage = isHomeSection
    ? `linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.72) 48%, rgba(0,0,0,0.48) 100%), ${LANDING_BACKGROUND_IMAGES.home}`
    : undefined;
  const heroBackgroundColor = getHeroSectionBackground(colors, renderedSection);
  const isDarkHero = isDarkHeroSection(renderedSection);
  const isLightHero = isLightHeroSection(renderedSection);
  const heroTextColor = isLightHero ? "#111111" : isDarkHero ? "#fff" : colors.textPrimary;
  const heroMutedColor = isLightHero ? "rgba(17,17,17,0.68)" : isDarkHero ? "rgba(255,255,255,0.74)" : colors.textSecondary;

  const pageStyle = useMemo<CSSProperties>(
    () => ({
      backgroundColor: colors.base,
      color: colors.textPrimary,
      minHeight: "100vh",
      overflowX: "hidden",
    }),
    [colors.base, colors.textPrimary],
  );

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileSidebarOpen]);

  const handleSectionSelect = (section: LandingSection) => {
    setActiveSection(section);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main style={pageStyle}>
      <section
        className={`landing-hero landing-hero-${renderedSection}`}
        style={{
          alignItems: isHomeSection ? "end" : "center",
          backgroundColor: heroBackgroundColor,
          backgroundImage: heroBackgroundImage,
          backgroundPosition: "center",
          backgroundSize: "cover",
          display: "grid",
          minHeight: isHomeSection ? "100vh" : "clamp(540px, 72vh, 760px)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <header
          className="landing-header"
          style={{
            alignItems: "center",
            backdropFilter: "blur(18px)",
            backgroundColor: "rgba(0,0,0,0.88)",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            boxSizing: "border-box",
            display: "flex",
            gap: 16,
            justifyContent: "space-between",
            left: 0,
            padding: "18px clamp(18px, 5vw, 72px)",
            position: "fixed",
            right: 0,
            top: 0,
            WebkitBackdropFilter: "blur(18px)",
            zIndex: 50,
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
                backgroundColor: colors.brand,
                borderRadius: 8,
                display: "grid",
                height: 38,
                placeItems: "center",
                width: 38,
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
                  className="landing-nav-button landing-hoverable"
                  onClick={() => handleSectionSelect(item.value)}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid transparent",
                    borderRadius: 8,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.72)",
                    cursor: "pointer",
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
              href="/member-login"
              className="landing-action-link landing-static-action"
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
              {PORTAL_CTA_LABEL}
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
        {!isHomeSection ? (
          <div
            className="landing-hero-image"
            role="img"
            aria-label={`${hero.eyebrow} preview`}
            style={getHeroImageStyle(renderedSection)}
          />
        ) : null}
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
                SertFit Gym
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
                  className={isActive ? "landing-mobile-nav-button" : "landing-mobile-nav-button landing-hoverable"}
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
            href="/member-login"
            className="landing-action-link landing-static-action"
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
            {PORTAL_CTA_LABEL}
          </Link>
        </aside>

        <div
          className={`landing-hero-copy landing-hero-copy-${renderedSection}`}
          style={{
            ...getHeroContentLayout(renderedSection),
            ...sectionTransitionStyle,
          }}
        >
          <FitText
            as="p"
            style={{
              color: colors.brand,
              fontSize: 13,
              fontWeight: isHomeSection ? 400 : 900,
              letterSpacing: 0,
              marginBottom: 14,
              textTransform: "uppercase",
            }}
          >
            {hero.eyebrow}
          </FitText>
          <FitText
            as="h1"
            className="landing-hero-title"
            style={{
              color: heroTextColor,
              fontSize: isHomeSection ? "clamp(70px, 12vw, 150px)" : "clamp(42px, 6.2vw, 78px)",
              fontWeight: 950,
              lineHeight: isHomeSection ? 0.9 : 1,
              margin: 0,
              maxWidth: isHomeSection ? 1040 : renderedSection === "staff" ? 940 : 720,
              overflowWrap: "anywhere",
            }}
          >
            {hero.title}
          </FitText>
          <FitText
            as="p"
            style={{
              color: heroMutedColor,
              fontSize: isHomeSection ? "clamp(18px, 2.1vw, 26px)" : 18,
              lineHeight: isHomeSection ? 1.42 : 1.58,
              margin: isHomeSection ? "22px auto 0" : "18px 0 0",
              maxWidth: isHomeSection ? 760 : 620,
            }}
          >
            {hero.copy}
          </FitText>
          <FitText
            as="p"
            className="landing-hero-context"
            style={{
              color: heroMutedColor,
              fontSize: isHomeSection ? 14.5 : 15.5,
              fontWeight: isHomeSection ? 400 : 650,
              lineHeight: 1.58,
              margin: isHomeSection ? "14px auto 0" : "16px 0 0",
              maxWidth: isHomeSection ? 420 : renderedSection === "staff" ? 780 : 600,
            }}
          >
            {hero.context}
          </FitText>
          {isHomeSection ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 34 }}>
              <Link
                href="/member-login"
                className="landing-action-link landing-static-action"
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
                REGISTER NOW! <ChevronRight size={17} />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <div style={sectionTransitionStyle}>
        <LandingSectionBody section={renderedSection} onSelect={handleSectionSelect} />
      </div>

      <footer
        style={{
          alignItems: "center",
          backgroundColor: mixColor("#000000", 24, colors.base),
          borderTop: `1px solid ${mixColor("#000000", 18, colors.border)}`,
          display: "grid",
          gap: 8,
          justifyItems: "center",
          padding: "34px clamp(18px, 5vw, 72px)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "grid", gap: 5, justifyItems: "center" }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 850 }}>
            Copyright 2026 FitTrack. All rights reserved.
          </FitText>
          <FitText style={{ color: colors.textSecondary, fontSize: 13 }}>
            Built for first visits, memberships, bookings, coaching, and better gym days.
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
            Authorized teams may use the{" "}
            <Link
              href="/login"
              className="landing-footer-link landing-hoverable"
              style={{
                color: colors.textMuted,
                fontWeight: 650,
                textDecoration: "underline",
                textDecorationColor: `${colors.textMuted}66`,
                textUnderlineOffset: 3,
              }}
            >
              team sign-in
            </Link>
            .
          </FitText>
        </div>
      </footer>

      <style>{`
        .landing-content-section,
        .landing-content-section *,
        .landing-hero-copy,
        .landing-hero-copy *,
        .landing-facility-band,
        .landing-facility-band *,
        .landing-home-carousel,
        .landing-home-carousel *,
        .landing-feature-grid,
        .landing-feature-grid * {
          box-sizing: border-box;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .landing-hero-title {
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .landing-hero-context {
          overflow-wrap: anywhere;
        }

        .landing-hoverable {
          transition: color 160ms ease;
        }

        .landing-hoverable:hover {
          color: ${colors.brand} !important;
          filter: none;
          opacity: 1;
          outline: 0;
        }

        .landing-hoverable:hover * {
          color: ${colors.brand} !important;
        }

        .landing-static-action,
        .landing-static-action:hover,
        .landing-static-action:focus-visible {
          filter: none !important;
          outline: 0 !important;
        }

        @keyframes landingCarouselFadeIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        .landing-home-carousel-image-layer {
          opacity: 1;
          transition: opacity 620ms ease;
          will-change: opacity;
        }

        .landing-home-carousel-image-layer.is-active {
          animation: landingCarouselFadeIn 620ms ease both;
        }

        .landing-home-carousel-image-layer.is-exiting {
          opacity: 0;
        }

        .landing-preview-row > span {
          overflow: hidden;
        }

        .landing-preview-action {
          justify-self: start;
        }

        .landing-preview-row:hover .landing-preview-action {
          background-color: ${colors.brand} !important;
          color: ${colors.onBrand} !important;
          filter: none !important;
        }

        @media (max-width: 1180px) {
          .landing-hero-copy {
            width: min(760px, calc(100% - 36px)) !important;
          }

          .landing-hero-copy-home .landing-hero-title {
            font-size: 104px !important;
            line-height: 0.92 !important;
          }

          .landing-home-carousel {
            grid-template-columns: minmax(260px, 0.56fr) minmax(0, 1.44fr) !important;
            min-height: clamp(500px, 66vh, 680px) !important;
          }

          .landing-staff-team-cards {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            max-width: 100% !important;
          }
        }

        @media (max-width: 1080px) {
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

          .landing-feature-grid,
          .landing-contact-grid,
          .landing-staff-grid {
            max-width: 100% !important;
            min-width: 0 !important;
            width: 100% !important;
          }

          .landing-contact-grid {
            grid-template-columns: 1fr !important;
          }

          .landing-home-summary-copy {
            min-height: auto !important;
            padding: clamp(28px, 6vw, 54px) clamp(18px, 4vw, 34px) !important;
          }

          .landing-home-carousel {
            grid-template-columns: minmax(224px, 0.54fr) minmax(0, 1.46fr) !important;
            min-height: clamp(480px, 66vh, 640px) !important;
          }

          .landing-home-carousel-stage {
            min-height: 100% !important;
          }

          .landing-preview-row,
          .landing-service-row,
          .landing-staff-row {
            grid-template-columns: minmax(220px, 0.86fr) minmax(0, 1.14fr) !important;
            width: 100% !important;
          }

          .landing-facility-row {
            grid-template-columns: minmax(230px, 0.92fr) minmax(0, 1.08fr) !important;
            width: 100% !important;
          }

          .landing-preview-row > span,
          .landing-facility-row > div,
          .landing-service-row > div,
          .landing-staff-row > div {
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .landing-hero-image {
            clip-path: none !important;
            left: 0 !important;
            opacity: 0.28 !important;
            right: 0 !important;
            width: 100% !important;
          }

          .landing-preview-copy {
            padding: clamp(22px, 5vw, 38px) clamp(18px, 4vw, 34px) !important;
          }

          .landing-preview-row > span:not(.landing-preview-copy) {
            min-height: clamp(340px, 46vh, 500px) !important;
          }

          .landing-about-steps {
            grid-auto-flow: row !important;
            grid-template-columns: 1fr !important;
          }

          .landing-facility-band,
          .landing-facility-row,
          .landing-facility-image {
            min-height: clamp(400px, 52vh, 580px) !important;
          }

          .landing-facility-copy {
            padding: clamp(28px, 6vw, 58px) clamp(20px, 5vw, 44px) !important;
          }

          .landing-staff-team-cards {
            gap: 12px !important;
          }
        }

        @media (max-width: 640px) {
          .landing-hero-copy {
            padding: 112px 0 58px !important;
            width: calc(100% - 28px) !important;
          }

          .landing-hero-copy-home .landing-hero-title {
            font-size: 62px !important;
            line-height: 0.98 !important;
          }

          .landing-hero-copy:not(.landing-hero-copy-home) .landing-hero-title {
            font-size: 38px !important;
            line-height: 1.04 !important;
          }

          .landing-hero:not(.landing-hero-home) {
            min-height: clamp(470px, 58vh, 580px) !important;
          }

          .landing-hero-services {
            min-height: clamp(430px, 54vh, 540px) !important;
          }

          .landing-hero-copy-services .landing-hero-title {
            font-size: 34px !important;
            line-height: 1.04 !important;
          }

          .landing-hero-copy-home p {
            max-width: 100% !important;
          }

          .landing-home-carousel-stage {
            min-height: 100% !important;
          }

          .landing-home-collage {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .landing-home-collage > span {
            margin-left: 0 !important;
            width: 100% !important;
          }

          .landing-home-carousel-caption {
            padding: 18px 18px 58px !important;
          }

          .landing-home-carousel-caption h3 {
            font-size: 22px !important;
            line-height: 1.05 !important;
          }

          .landing-home-summary-copy h2 {
            font-size: 24px !important;
            line-height: 1.08 !important;
          }

          .landing-home-summary-copy p,
          .landing-home-carousel-caption p {
            font-size: 11.5px !important;
            line-height: 1.5 !important;
          }

          .landing-home-carousel {
            grid-template-columns: minmax(188px, 0.72fr) minmax(0, 1.28fr) !important;
            min-height: clamp(420px, 66vh, 540px) !important;
          }

          .landing-feature-grid {
            gap: 10px !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .landing-feature-grid article {
            min-height: auto !important;
            padding: 14px 0 !important;
          }

          .landing-preview-row,
          .landing-service-row,
          .landing-facility-row,
          .landing-staff-row {
            grid-template-columns: minmax(168px, 0.92fr) minmax(0, 1.08fr) !important;
          }

          .landing-service-row {
            gap: 12px !important;
            grid-template-columns: minmax(0, 1fr) !important;
            min-height: auto !important;
            padding: 22px 0 !important;
          }

          .landing-service-points {
            gap: 8px !important;
            padding-top: 0 !important;
          }

          .landing-service-price {
            font-size: 24px !important;
            line-height: 1.06 !important;
          }

          .landing-service-title {
            font-size: 20px !important;
            line-height: 1.08 !important;
            margin-top: 10px !important;
          }

          .landing-preview-row {
            min-height: clamp(330px, 50vh, 460px) !important;
          }

          .landing-preview-row > span:not(.landing-preview-copy),
          .landing-facility-band,
          .landing-facility-row,
          .landing-facility-image {
            min-height: clamp(300px, 44vh, 420px) !important;
          }

          .landing-preview-copy,
          .landing-facility-copy {
            padding: 20px 16px !important;
          }

          .landing-preview-title {
            font-size: 30px !important;
            line-height: 1.02 !important;
          }

          .landing-staff-step-pill {
            min-height: 34px !important;
          }

          .landing-staff-step-detail {
            padding: 0 !important;
          }

          .landing-staff-step-detail [style*="font-size"] {
            font-size: 12.5px !important;
          }

          .landing-preview-copy [style*="font-size"],
          .landing-facility-copy h3,
          .landing-staff-row [style*="font-size"] {
            overflow-wrap: anywhere !important;
          }
        }
      `}</style>
    </main>
  );
}

function LandingSectionBody({
  onSelect,
  section,
}: {
  onSelect: (section: LandingSection) => void;
  section: LandingSection;
}) {
  switch (section) {
    case "services":
      return <ServicesSection />;
    case "facilities":
      return <FacilitiesSection />;
    case "staff":
      return <StaffSection />;
    case "about":
      return <AboutSection />;
    case "contact":
      return <ContactSection />;
    case "home":
    default:
      return <HomeSection onSelect={onSelect} />;
  }
}

function LandingContentSection({
  children,
  compact = false,
  fullBleed = false,
  variant = "intro",
}: {
  children: ReactNode;
  compact?: boolean;
  fullBleed?: boolean;
  variant?: LandingContentVariant;
}) {
  const { colors } = useTheme();

  return (
    <section
      className="landing-content-section"
      data-landing-variant={variant}
      style={{
        alignItems: "center",
        background: getLandingSectionBackground(colors, variant),
        boxSizing: "border-box",
        display: "grid",
        minHeight: getLandingSectionMinHeight(variant, compact),
        padding: getLandingSectionPadding(variant, compact),
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          margin: "0 auto",
          maxWidth: fullBleed ? undefined : getLandingSectionMaxWidth(variant),
          minWidth: 0,
          width: fullBleed ? "100%" : getLandingSectionWidth(variant),
        }}
      >
        {children}
      </div>
    </section>
  );
}

function HomeSection({ onSelect }: { onSelect: (section: LandingSection) => void }) {
  return (
    <>
      <HomeMovementSummary />

      <LandingContentSection fullBleed variant="media">
        <HomePreviewRows onSelect={onSelect} />
      </LandingContentSection>

      <LandingContentSection compact variant="final">
        <FeatureRail items={HOME_HIGHLIGHTS} />
        <div style={{ marginTop: "clamp(18px, 3vw, 32px)" }}>
          <FeatureRail items={WHY_FITTRACK_ITEMS} compact />
        </div>
      </LandingContentSection>
    </>
  );
}

function HomeMovementSummary() {
  const { colors } = useTheme();
  const [activeSlide, setActiveSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState<number | null>(null);
  const [isPreviousSlideFading, setIsPreviousSlideFading] = useState(false);
  const fadeFrameRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselImages = [
    LANDING_BACKGROUND_IMAGES.services,
    LANDING_BACKGROUND_IMAGES.facilities,
    LANDING_BACKGROUND_IMAGES.staff,
    LANDING_BACKGROUND_IMAGES.about,
    LANDING_BACKGROUND_IMAGES.contact,
  ];
  const slides: CarouselSlide[] = [
    {
      copy: "Lift, book a court, ask a coach, or plan an easier first visit from one clean starting point.",
      image: undefined,
      label: "Everything for the workout",
      mode: "collage",
    },
    {
      copy: "Strength floor, court, ring, yoga room, or recovery corner. See where your session fits.",
      image: LANDING_BACKGROUND_IMAGES.facilities,
      label: "Pick the vibe before you go",
      mode: "single",
    },
    {
      copy: "Need form checks, boxing rounds, mobility work, or a push through the last set? Start here.",
      image: LANDING_BACKGROUND_IMAGES.staff,
      label: "Find the right coach",
      mode: "single",
    },
  ];
  const active = slides[activeSlide];
  const previous = previousSlide === null ? null : slides[previousSlide];

  useEffect(() => {
    return () => {
      if (fadeFrameRef.current !== null) {
        window.cancelAnimationFrame(fadeFrameRef.current);
      }
      if (fadeTimeoutRef.current !== null) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  const getSlideImages = (slide: CarouselSlide) => (
    slide.mode === "collage"
      ? carouselImages
      : carouselImages.map(() => slide.image ?? LANDING_BACKGROUND_IMAGES.facilities)
  );

  const showSlide = (nextSlide: number) => {
    if (nextSlide === activeSlide) return;

    if (fadeFrameRef.current !== null) {
      window.cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }

    if (fadeTimeoutRef.current !== null) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    setPreviousSlide(activeSlide);
    setIsPreviousSlideFading(false);
    setActiveSlide(nextSlide);

    fadeFrameRef.current = window.requestAnimationFrame(() => {
      setIsPreviousSlideFading(true);
      fadeFrameRef.current = null;
    });

    fadeTimeoutRef.current = setTimeout(() => {
      setPreviousSlide(null);
      setIsPreviousSlideFading(false);
      fadeTimeoutRef.current = null;
    }, 680);
  };

  const goToSlide = (direction: -1 | 1) => {
    showSlide((activeSlide + direction + slides.length) % slides.length);
  };

  const carouselArrowStyle = (side: "left" | "right"): CSSProperties => ({
    alignItems: "center",
    background: "transparent",
    border: 0,
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.65))",
    height: 58,
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 58,
    zIndex: 3,
    ...(side === "left" ? { left: "clamp(12px, 2.6vw, 34px)" } : { right: "clamp(12px, 2.6vw, 34px)" }),
  });

  const dotButtonStyle = (isActive: boolean): CSSProperties => ({
    backgroundColor: isActive ? colors.brand : "rgba(255,255,255,0.34)",
    border: 0,
    cursor: "pointer",
    height: 7,
    padding: 0,
    transform: "skewX(-24deg)",
    width: isActive ? 42 : 18,
  });

  const collagePanelStyle = (image: string, index: number): CSSProperties => ({
    backgroundColor: "rgba(255,255,255,0.08)",
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.56)), ${image}`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    clipPath: index % 2 === 0
      ? "polygon(15% 0, 100% 0, 86% 100%, 0 100%)"
      : "polygon(0 0, 100% 0, 100% 100%, 14% 100%)",
    marginLeft: index === 0 ? 0 : -42,
    minHeight: "100%",
    width: index === 0 ? "100%" : "calc(100% + 42px)",
  });

  return (
    <LandingContentSection fullBleed variant="media">
      <section
        className="landing-home-summary landing-home-carousel"
        style={{
          backgroundColor: "#080808",
          color: "#fff",
          display: "grid",
          gridTemplateColumns: "minmax(300px, 0.58fr) minmax(0, 1.42fr)",
          minHeight: "clamp(620px, 82vh, 860px)",
          overflow: "hidden",
        }}
      >
        <div
          className="landing-home-summary-copy"
          style={{
            alignContent: "center",
            display: "grid",
            gap: 18,
            padding: "clamp(46px, 7vw, 92px) clamp(28px, 5vw, 74px)",
          }}
        >
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
            Overview
          </FitText>
          <FitText
            as="h2"
            style={{
              color: "#fff",
              fontSize: "clamp(36px, 5.1vw, 78px)",
              fontWeight: 950,
              lineHeight: 0.96,
              margin: 0,
              overflowWrap: "anywhere",
            }}
          >
            One gym visit, planned clearly.
          </FitText>
          <FitText
            as="p"
            style={{
              color: "rgba(255,255,255,0.68)",
              fontSize: "clamp(15px, 1.3vw, 19px)",
              lineHeight: 1.62,
              margin: 0,
              maxWidth: 620,
            }}
          >
            FitTrack makes the gym feel organized before the workout starts: what to train, who to ask, which room to use, and how to keep moving.
          </FitText>
        </div>
        <div
          className="landing-home-carousel-stage"
          role="group"
          aria-roledescription="carousel"
          aria-label="Home image carousel"
          style={{
            display: "grid",
            backgroundColor: "rgba(255,255,255,0.06)",
            minHeight: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <button type="button" aria-label="Previous Home image" onClick={() => goToSlide(-1)} style={carouselArrowStyle("left")}>
            <ChevronLeft size={46} strokeWidth={2.15} />
          </button>
          <button type="button" aria-label="Next Home image" onClick={() => goToSlide(1)} style={carouselArrowStyle("right")}>
            <ChevronRight size={46} strokeWidth={2.15} />
          </button>
          {previous ? (
            <div
              key={`home-carousel-previous-${previousSlide}`}
              aria-hidden="true"
              className={`landing-home-collage landing-home-carousel-image-layer ${isPreviousSlideFading ? "is-exiting" : "is-held"}`}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(110px, 1fr))",
                inset: 0,
                minHeight: "100%",
                position: "absolute",
                zIndex: 0,
              }}
            >
              {getSlideImages(previous).map((image, index) => (
                <span key={`${previous.label}-${image}-${index}`} style={collagePanelStyle(image, index)} />
              ))}
            </div>
          ) : null}
          <div
            key={`home-carousel-active-${activeSlide}`}
            aria-hidden="true"
            className="landing-home-collage landing-home-carousel-image-layer is-active"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(110px, 1fr))",
              inset: 0,
              minHeight: "100%",
              position: "absolute",
              zIndex: 0,
            }}
          >
            {getSlideImages(active).map((image, index) => (
              <span key={`${active.label}-${image}-${index}`} style={collagePanelStyle(image, index)} />
            ))}
          </div>
          <div
            aria-hidden="true"
            style={{
              background: active.mode === "collage"
                ? "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.32)), linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.66))"
                : "linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0.38)), linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.60))",
              inset: 0,
              position: "absolute",
              zIndex: 1,
            }}
          />
          <div
            className="landing-home-carousel-caption"
            style={{
              alignContent: "end",
              display: "grid",
              gap: 8,
              justifyItems: "center",
              minHeight: "100%",
              padding: "clamp(32px, 5vw, 64px) clamp(42px, 6vw, 84px) clamp(66px, 7vw, 108px)",
              position: "relative",
              textAlign: "center",
              zIndex: 2,
            }}
          >
            <FitText
              as="h3"
              style={{
                color: "#fff",
                display: "block",
                fontSize: "clamp(26px, 3.8vw, 56px)",
                fontWeight: 950,
                lineHeight: 1,
                margin: 0,
                maxWidth: 620,
                overflowWrap: "anywhere",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              {active.label}
            </FitText>
            <FitText
              as="p"
              style={{
                color: "rgba(255,255,255,0.76)",
                display: "block",
                fontSize: "clamp(13px, 1vw, 16px)",
                lineHeight: 1.55,
                margin: 0,
                maxWidth: 520,
                textAlign: "center",
              }}
            >
              {active.copy}
            </FitText>
          </div>
          <div
            aria-label="Home image slides"
            className="landing-home-carousel-dots"
            style={{
              alignItems: "center",
              bottom: "clamp(18px, 3vw, 34px)",
              display: "inline-flex",
              gap: 8,
              left: "50%",
              position: "absolute",
              transform: "translateX(-50%)",
              zIndex: 3,
            }}
          >
            {slides.map((slide, index) => (
              <button
                key={slide.label}
                type="button"
                aria-label={`Show ${slide.label}`}
                aria-current={index === activeSlide ? "true" : undefined}
                onClick={() => showSlide(index)}
                style={dotButtonStyle(index === activeSlide)}
              />
            ))}
          </div>
        </div>
      </section>
    </LandingContentSection>
  );
}

function HomePreviewRows({ onSelect }: { onSelect: (section: LandingSection) => void }) {
  const { colors } = useTheme();

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {HOME_SECTION_PREVIEWS.map((preview, index) => {
        const reverse = index % 2 === 1;
        return (
          <button
            key={preview.target}
            type="button"
            className="landing-preview-row landing-hoverable"
            onClick={() => onSelect(preview.target)}
            style={{
              alignItems: "stretch",
              backgroundColor: index % 2 === 0 ? colors.surface : mixColor(colors.brand, 7, colors.base),
              border: 0,
              color: colors.textPrimary,
              cursor: "pointer",
              display: "grid",
              gap: 0,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              minHeight: "clamp(560px, 72vh, 780px)",
              minWidth: 0,
              padding: 0,
              textAlign: "left",
              width: "100%",
            }}
          >
            <span
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.10), rgba(0,0,0,0.62)), ${preview.image}`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                display: "block",
                height: "100%",
                minHeight: "clamp(560px, 72vh, 780px)",
                minWidth: 0,
                order: reverse ? 2 : 1,
                width: "100%",
              }}
            />
            <span
              className="landing-preview-copy"
              style={{
                alignContent: "center",
                display: "grid",
                gap: 14,
                minWidth: 0,
                order: reverse ? 1 : 2,
                padding: "clamp(28px, 5vw, 62px) clamp(28px, 6vw, 96px)",
              }}
            >
              <FitText className="landing-preview-title" style={{ color: colors.textPrimary, display: "block", fontSize: "clamp(38px, 5vw, 72px)", fontWeight: 950, lineHeight: 0.94 }}>
                {preview.title}
              </FitText>
              <FitText style={{ color: colors.textSecondary, display: "block", fontSize: "clamp(15px, 1.35vw, 20px)", lineHeight: 1.58, maxWidth: 620 }}>
                {preview.copy}
              </FitText>
              <FitText
                as="span"
                className="landing-preview-action"
                style={{
                  alignItems: "center",
                  backgroundColor: colors.brand,
                  border: `1px solid ${colors.brand}`,
                  borderRadius: 8,
                  color: colors.onBrand,
                  display: "inline-flex",
                  fontSize: "clamp(12px, 1vw, 14px)",
                  fontWeight: 900,
                  justifyContent: "center",
                  lineHeight: 1,
                  marginTop: 4,
                  minHeight: 38,
                  padding: "0 14px",
                  textDecoration: "none",
                  width: "fit-content",
                }}
              >
                Click to browse &gt;
              </FitText>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ServicesSection() {
  const { colors } = useTheme();

  return (
    <>
      <LandingContentSection variant="detail">
        <div style={{ display: "grid", gap: 0 }}>
          {SERVICE_PLANS.map((plan) => (
            <article
              key={plan.title}
              className="landing-service-row"
              style={{
                alignItems: "center",
                display: "grid",
                gap: "18px clamp(18px, 5vw, 56px)",
                gridTemplateColumns: "0.82fr 1.18fr",
                minHeight: "clamp(190px, 26vh, 320px)",
                padding: "clamp(24px, 4vw, 48px) 0",
              }}
            >
              <div className="landing-service-summary">
                <FitText style={{ color: colors.brand, display: "block", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
                  {plan.label}
                </FitText>
                <FitText className="landing-service-price" style={{ color: colors.textPrimary, display: "block", fontSize: "clamp(26px, 4vw, 48px)", fontWeight: 950, lineHeight: 1, marginTop: 8 }}>
                  {plan.price}
                </FitText>
                <FitText as="h3" className="landing-service-title" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: 950, lineHeight: 1.05, margin: "14px 0 0" }}>
                  {plan.title}
                </FitText>
                <FitText as="p" style={{ color: colors.textSecondary, fontSize: 14.5, lineHeight: 1.65, margin: "10px 0 0", maxWidth: 520 }}>
                  {plan.copy}
                </FitText>
              </div>
              <div className="landing-service-points" style={{ display: "grid", gap: 11, paddingTop: 4 }}>
                {plan.points.map((point) => (
                  <span key={point} style={{ alignItems: "center", display: "inline-flex", gap: 9 }}>
                    <CheckMark />
                    <FitText style={{ color: colors.textSecondary, display: "block", fontSize: 14, fontWeight: 750 }}>
                      {point}
                    </FitText>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </LandingContentSection>

      <LandingContentSection compact variant="final">
        <FeatureRail items={SERVICE_FEATURES} />
      </LandingContentSection>
    </>
  );
}

function FacilitiesSection() {
  const { colors } = useTheme();

  return (
    <>
      {FACILITY_SHOWCASE.map((facility, facilityIndex) => (
        <section
          key={facility.title}
          className="landing-facility-band"
          style={{
            backgroundColor: facilityIndex % 2 === 0 ? colors.surface : mixColor(colors.brand, 7, colors.base),
            color: colors.textPrimary,
            minHeight: "clamp(560px, 74vh, 820px)",
            overflow: "hidden",
          }}
        >
          <article
            className="landing-facility-row"
            style={{
              alignItems: "stretch",
              display: "grid",
              gap: 0,
              gridTemplateColumns: facilityIndex % 2 === 0 ? "0.92fr 1.08fr" : "1.08fr 0.92fr",
              minHeight: "clamp(560px, 74vh, 820px)",
              width: "100%",
            }}
          >
            <div
              className="landing-facility-copy"
              style={{
                alignContent: "center",
                display: "grid",
                minWidth: 0,
                order: facilityIndex % 2 === 0 ? 1 : 2,
                padding: "clamp(44px, 7vw, 96px) clamp(28px, 6vw, 96px)",
              }}
            >
              <FitText style={{ color: colors.brand, display: "block", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
                {facility.meta}
              </FitText>
              <FitText
                as="h3"
                style={{
                  color: colors.textPrimary,
                  fontSize: "clamp(40px, 5.4vw, 76px)",
                  fontWeight: 950,
                  lineHeight: 0.95,
                  margin: "10px 0 0",
                  overflowWrap: "anywhere",
                }}
              >
                {facility.title}
              </FitText>
              <FitText
                as="p"
                style={{
                  color: colors.textSecondary,
                  fontSize: "clamp(16px, 1.35vw, 21px)",
                  lineHeight: 1.65,
                  margin: "18px 0 0",
                  maxWidth: 640,
                }}
              >
                {facility.copy}
              </FitText>
            </div>
            <div
              className="landing-facility-image"
              role="img"
              aria-label={`${facility.title} facility image`}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.30)), ${facility.images[0]}`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                minHeight: "clamp(560px, 74vh, 820px)",
                minWidth: 0,
                order: facilityIndex % 2 === 0 ? 2 : 1,
                width: "100%",
              }}
            />
          </article>
        </section>
      ))}
    </>
  );
}

function StaffSection() {
  const { colors } = useTheme();
  const teamSteps = [
    {
      title: "Start at the desk",
      copy: "Membership questions, card loads, payment guidance, account checks, and first-visit confusion get handled before the workout starts.",
    },
    {
      title: "Move to the right coach",
      copy: "Strength, mobility, boxing, and recovery requests get matched to the person who can actually help the session feel productive.",
    },
    {
      title: "Leave with the next step",
      copy: "Members leave knowing whether to book, reload, ask the desk, or return to training.",
    },
  ];

  return (
    <>
      <LandingContentSection variant="detail">
        <div
          className="landing-staff-grid landing-staff-team"
          style={{
            alignItems: "center",
            display: "grid",
            justifyItems: "center",
            minHeight: "clamp(400px, 50vh, 620px)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 18,
              justifyItems: "center",
              maxWidth: 1040,
            }}
          >
            <FitText style={{ color: colors.brand, display: "block", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
              Gym team
            </FitText>
            <FitText
              as="h2"
              style={{
                color: colors.textPrimary,
                fontSize: "clamp(38px, 5vw, 76px)",
                fontWeight: 950,
                lineHeight: 0.96,
                margin: 0,
                maxWidth: 900,
                overflowWrap: "anywhere",
              }}
            >
              The right person should feel obvious.
            </FitText>
            <FitText
              as="p"
              style={{
                color: colors.textSecondary,
                fontSize: "clamp(16px, 1.35vw, 21px)",
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 760,
              }}
            >
              A good gym visit needs more than equipment. It needs someone at the desk who can answer account questions, and coaches who know how to make the next session better.
            </FitText>
            <div
              className="landing-staff-process"
              style={{
                display: "grid",
                gap: "clamp(16px, 2vw, 24px)",
                marginTop: 14,
                width: "100%",
              }}
            >
              <div
                aria-hidden="true"
                className="landing-staff-step-pill"
                style={{
                  alignItems: "center",
                  backgroundColor: "transparent",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 999,
                  color: colors.textPrimary,
                  display: "grid",
                  fontSize: 12,
                  fontWeight: 950,
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  justifyItems: "center",
                  margin: "0 auto",
                  maxWidth: 420,
                  minHeight: 30,
                  padding: "3px 8px",
                  textAlign: "center",
                  width: "100%",
                }}
              >
                {teamSteps.map((detail, index) => (
                  <span
                    key={detail.title}
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.brand,
                      borderRadius: 999,
                      color: colors.onBrand,
                      display: "inline-flex",
                      height: 22,
                      justifyContent: "center",
                      width: 22,
                    }}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
              <div
                className="landing-staff-team-cards"
                style={{
                  display: "grid",
                  gap: "clamp(14px, 2vw, 22px)",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {teamSteps.map((detail) => (
                  <article
                    key={detail.title}
                    className="landing-staff-step-detail"
                    style={{
                      background: "transparent",
                      border: 0,
                      boxShadow: "none",
                      minWidth: 0,
                      padding: "0 clamp(4px, 1vw, 12px)",
                    }}
                  >
                    <FitText style={{ color: colors.textPrimary, display: "block", fontSize: 18, fontWeight: 950 }}>
                      {detail.title}
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, display: "block", fontSize: 14.5, lineHeight: 1.62, marginTop: 10 }}>
                      {detail.copy}
                    </FitText>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </LandingContentSection>

      <LandingContentSection compact variant="final">
        <div style={{ display: "grid", gap: "clamp(18px, 3vw, 30px)" }}>
          {STAFF_DIRECTORY.map((member) => (
            <article
              key={member.name}
              className="landing-staff-row"
              style={{
                alignItems: "center",
                display: "grid",
                gap: 16,
                gridTemplateColumns: "minmax(160px, 0.72fr) minmax(260px, 1.28fr)",
                minHeight: "clamp(210px, 28vh, 320px)",
                padding: "clamp(26px, 4vw, 46px) 0",
              }}
            >
              <div>
                <FitText style={{ color: colors.textPrimary, display: "block", fontSize: "clamp(38px, 5vw, 72px)", fontWeight: 950, lineHeight: 0.92 }}>
                  {member.name}
                </FitText>
                <FitText style={{ color: colors.brand, display: "block", fontSize: 13, fontWeight: 900, marginTop: 10, textTransform: "uppercase" }}>
                  {member.hierarchy}
                </FitText>
              </div>
              <div>
                <FitText style={{ color: colors.textSecondary, display: "block", fontSize: "clamp(17px, 1.45vw, 21px)", lineHeight: 1.55 }}>
                  {member.role}
                </FitText>
                <FitText style={{ color: colors.textMuted, display: "block", fontSize: "clamp(15px, 1.25vw, 18px)", lineHeight: 1.6, marginTop: 8 }}>
                  {member.specialties}
                </FitText>
                <FitText style={{ color: colors.textSecondary, display: "block", fontSize: 16, fontWeight: 850, marginTop: 10 }}>
                  {member.contact}
                </FitText>
              </div>
            </article>
          ))}
        </div>
      </LandingContentSection>
    </>
  );
}

function AboutSection() {
  const { colors } = useTheme();

  return (
    <>
      <LandingContentSection variant="final">
      <div
        className="landing-about-steps"
        style={{
          display: "grid",
          gap: "clamp(28px, 4vw, 48px)",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {ABOUT_STEPS.map((step) => (
          <article
            key={step.title}
            style={{
              alignContent: "center",
              display: "grid",
              gap: 18,
              minHeight: "clamp(340px, 46vh, 540px)",
              padding: "clamp(18px, 3vw, 34px) 0",
            }}
          >
            <span
              style={{
                alignItems: "center",
                color: colors.brand,
                display: "inline-flex",
                fontSize: "clamp(54px, 7vw, 100px)",
                fontWeight: 950,
                lineHeight: 0.9,
              }}
            >
              {step.label}
            </span>
            <FitText as="h3" style={{ color: colors.textPrimary, fontSize: "clamp(30px, 4vw, 54px)", fontWeight: 950, lineHeight: 0.98, margin: 0 }}>
              {step.title}
            </FitText>
            <FitText as="p" style={{ color: colors.textSecondary, fontSize: "clamp(16px, 1.35vw, 20px)", lineHeight: 1.62, margin: 0 }}>
              {step.copy}
            </FitText>
          </article>
        ))}
      </div>
      </LandingContentSection>
    </>
  );
}

function ContactSection() {
  const { colors } = useTheme();

  return (
    <>
      <LandingContentSection variant="final">
      <div
        className="landing-contact-grid"
        style={{
          display: "grid",
          gap: "clamp(28px, 5vw, 70px)",
          gridTemplateColumns: "minmax(0, 0.92fr) minmax(320px, 0.68fr)",
          margin: "0 auto",
          maxWidth: 1320,
        }}
      >
        <div style={{ alignContent: "center", display: "grid", gap: "clamp(20px, 3vw, 34px)" }}>
          {CONTACT_HELP_ITEMS.map((item) => (
            <article
              key={item.title}
              style={{
                borderBottom: `1px solid ${colors.border}`,
                display: "grid",
                gap: 10,
                padding: "clamp(20px, 3vw, 34px) 0",
              }}
            >
              <FitText as="h3" style={{ color: colors.textPrimary, fontSize: "clamp(25px, 3vw, 42px)", fontWeight: 950, lineHeight: 1, margin: 0 }}>
                {item.title}
              </FitText>
              <FitText as="p" style={{ color: colors.textSecondary, fontSize: "clamp(15px, 1.35vw, 19px)", lineHeight: 1.62, margin: 0, maxWidth: 760 }}>
                {item.copy}
              </FitText>
            </article>
          ))}
        </div>

        <div style={{ alignContent: "center", display: "grid", gap: 0, minWidth: 0 }}>
          {CONTACT_CHANNELS.map((channel) => (
            <a
              key={channel.label}
              href={channel.href}
              className="landing-contact-link landing-hoverable"
              rel={channel.href.startsWith("http") ? "noreferrer" : undefined}
              target={channel.href.startsWith("http") ? "_blank" : undefined}
              style={{
                alignItems: "center",
                borderBottom: `1px solid ${colors.border}`,
                color: colors.textPrimary,
                display: "flex",
                gap: 14,
                justifyContent: "space-between",
                minHeight: "clamp(104px, 13vh, 154px)",
                padding: "clamp(20px, 4vw, 38px) 0",
                textDecoration: "none",
              }}
            >
              <FitText style={{ color: colors.brand, display: "block", fontSize: "clamp(12px, 1vw, 15px)", fontWeight: 900, textTransform: "uppercase" }}>
                {channel.label}
              </FitText>
              <FitText style={{ color: colors.textSecondary, display: "block", fontSize: "clamp(21px, 3vw, 42px)", fontWeight: 950, lineHeight: 0.98, textAlign: "right" }}>
                {channel.value}
              </FitText>
            </a>
          ))}
        </div>
      </div>
      </LandingContentSection>
    </>
  );
}

function FeatureRail({ compact = false, items }: { compact?: boolean; items: PublicFeature[] }) {
  return (
    <div
      className="landing-feature-grid"
      style={{
        alignItems: "stretch",
        display: "grid",
        gap: compact ? "clamp(16px, 3vw, 32px)" : "clamp(20px, 4vw, 42px)",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      }}
    >
      {items.map((item) => (
        <IconTile key={item.title} compact={compact} item={item} />
      ))}
    </div>
  );
}

function FeatureList({ compact = false, items }: { compact?: boolean; items: PublicFeature[] }) {
  return (
    <div style={{ display: "grid", gap: compact ? 12 : 14 }}>
      {items.map((item) => (
        <IconRow key={item.title} item={item} compact={compact} />
      ))}
    </div>
  );
}

function IconRow({ compact = false, item }: { compact?: boolean; item: PublicFeature }) {
  const { colors } = useTheme();

  return (
    <article
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "34px 1fr",
      }}
    >
      <span
        style={{
          backgroundColor: `${colors.brand}22`,
          borderRadius: 8,
          display: "grid",
          height: 34,
          placeItems: "center",
          width: 34,
        }}
      >
        <item.icon size={17} color={colors.brand} />
      </span>
      <div>
        <FitText style={{ color: colors.textPrimary, display: "block", fontSize: compact ? 15 : 16, fontWeight: 900 }}>
          {item.title}
        </FitText>
        <FitText style={{ color: colors.textSecondary, display: "block", fontSize: compact ? 12.5 : 13.5, lineHeight: 1.55, marginTop: 3 }}>
          {item.copy}
        </FitText>
      </div>
    </article>
  );
}

function CheckMark() {
  const { colors } = useTheme();

  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: colors.brand,
        display: "inline-block",
        flex: "0 0 auto",
        height: 7,
        transform: "skewX(-24deg)",
        width: 18,
      }}
    />
  );
}

function IconTile({ compact = false, item }: { compact?: boolean; item: PublicFeature }) {
  const { colors } = useTheme();

  return (
    <article
      style={{
        alignContent: "center",
        display: "grid",
        gap: compact ? 12 : 16,
        minHeight: compact ? "clamp(150px, 20vh, 260px)" : "clamp(200px, 28vh, 360px)",
        padding: compact ? "clamp(16px, 3vw, 30px) 0" : "clamp(24px, 4vw, 44px) 0",
      }}
    >
      <span
        style={{
          display: "grid",
          height: compact ? 40 : 48,
          placeItems: "start",
          width: compact ? 40 : 48,
        }}
      >
        <item.icon size={compact ? 26 : 34} color={colors.brand} />
      </span>
      <FitText style={{ color: colors.textPrimary, display: "block", fontSize: compact ? "clamp(24px, 3vw, 40px)" : "clamp(32px, 4vw, 58px)", fontWeight: 950, lineHeight: 0.98 }}>
        {item.title}
      </FitText>
      <FitText style={{ color: colors.textSecondary, display: "block", fontSize: compact ? "clamp(15px, 1.25vw, 18px)" : "clamp(16px, 1.45vw, 21px)", lineHeight: 1.58 }}>
        {item.copy}
      </FitText>
    </article>
  );
}

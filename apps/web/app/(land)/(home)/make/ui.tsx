"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";

import { ASSETS } from "../landing-data";

/* ------------------------------------------------------------------ */
/* Imagery helper                                                      */
/* ------------------------------------------------------------------ */

const LOCAL_IMAGES: Record<string, string> = {
  "1772450014702-498a8a3f61ae": ASSETS.hero,
  "1770026137145-e792e19b9060": ASSETS.strength,
  "1726867863287-aba3393812d0": ASSETS.boxing,
  "1661307987465-1db8d7a8796f": ASSETS.mobility,
  "1772450014622-1c209d012c2e": ASSETS.spacesStrength,
  "1572454181157-0b40dd7667fe": ASSETS.spacesCourt,
  "1651707999601-cba87015439c": ASSETS.spacesRing,
  "1683056255281-e52a141924f0": ASSETS.team,
  "1599901860904-17e6ed7083a0": ASSETS.spacesRecovery,
};

export function unsplash(id: string, _w = 1200, _h = 1500) {
  if (id === "1683056255281-e52a141924f0" && _w >= 1000) return ASSETS.spacesYoga;
  return LOCAL_IMAGES[id] ?? "";
}

export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.opacity = "0";
}

/* ------------------------------------------------------------------ */
/* Scroll reveal — respects OS and app animation preferences           */
/* ------------------------------------------------------------------ */

export function useMakeMotionPreference() {
  const { settings } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  const [osReduced, setOsReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsReduced(media.matches);
    update();
    setHydrated(true);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const noMotion = hydrated && (osReduced || settings.animationLevel === "none");
  const reduce = hydrated && (osReduced || settings.animationLevel !== "full");
  return { hydrated, noMotion, reduce };
}

export function useLandingHydration() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "header" | "figure";
}) {
  const { noMotion, reduce } = useMakeMotionPreference();
  if (noMotion) {
    return (
      <div className={className} data-landing-reveal="true">
        {children}
      </div>
    );
  }
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      data-landing-reveal="true"
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/* ------------------------------------------------------------------ */
/* Eyebrow / kicker label                                              */
/* ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.22em] ${className}`}
    >
      <span aria-hidden className="h-px w-6 bg-orange" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons — internal links use the app router; external links stay a  */
/* plain anchor.                                                       */
/* ------------------------------------------------------------------ */

type BtnProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost" | "light" | "onDark";
  className?: string;
  external?: boolean;
  "aria-label"?: string;
};

export function FitButton({
  href,
  children,
  variant = "primary",
  className = "",
  external,
  ...rest
}: BtnProps) {
  const base =
    "group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold tracking-tight transition-colors duration-200";
  const styles: Record<string, string> = {
    primary: "bg-orange text-ink hover:bg-[#ffa14d]",
    onDark: "bg-orange text-ink hover:bg-[#ffa14d]",
    ghost:
      "border border-bone/20 bg-transparent text-bone hover:border-orange hover:text-orange",
    light:
      "border border-bone/25 bg-transparent text-bone hover:border-bone/70 hover:bg-bone hover:text-ink",
  };
  const classes = `${base} ${styles[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {children}
    </Link>
  );
}

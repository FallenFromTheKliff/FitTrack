"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { NAV_ITEMS } from "../landing-data";
import { useMakeMotionPreference } from "./ui";

export function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "text-bone" : "text-bone";
  return (
    <a href="#top" className={`flex items-baseline gap-[3px] ${color}`} aria-label="SertFit Gym — home">
      <span className="font-display text-[22px] font-black uppercase leading-none tracking-tight">Sert</span>
      <span className="font-display text-[22px] font-black uppercase leading-none tracking-tight text-orange">Fit</span>
      <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.28em] opacity-60">Gym</span>
    </a>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { noMotion, reduce } = useMakeMotionPreference();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);
  const restoreScrollRef = useRef(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const content = document.querySelector<HTMLElement>("[data-landing-content]");
    const trigger = triggerRef.current;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    scrollYRef.current = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";
    content?.setAttribute("inert", "");

    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    const focusTimer = window.requestAnimationFrame(() => first?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreScrollRef.current = true;
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
      if (!focusable.length) return;
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 768) {
        restoreScrollRef.current = true;
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      content?.removeAttribute("inert");
      if (restoreScrollRef.current) {
        window.scrollTo({ top: scrollYRef.current, behavior: "auto" });
        window.requestAnimationFrame(() => trigger?.focus());
      }
      restoreScrollRef.current = true;
    };
  }, [open]);

  const close = (restoreScroll = true) => {
    restoreScrollRef.current = restoreScroll;
    setOpen(false);
  };

  return (
    <header
      data-landing-region="navigation"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-bone/10 bg-ink/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Wordmark />

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="relative py-1 text-[14px] font-medium text-bone/75 transition-colors hover:text-bone after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-orange after:transition-transform hover:after:scale-x-100"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/member-login"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-orange px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-[#ffa14d]"
          >
            Sign in
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-bone transition-colors hover:bg-panel-2/10 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            data-landing-region="mobile-navigation"
            className="fixed inset-0 z-50 md:hidden"
            initial={noMotion || reduce ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={noMotion || reduce ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: noMotion || reduce ? 0 : 0.2 }}
          >
            <div
              data-sertfit-menu-backdrop="true"
              aria-hidden="true"
              className="absolute inset-0 bg-panel-2/40 backdrop-blur-sm"
              onClick={() => close()}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-x-3 top-3 rounded-2xl border border-bone/10 bg-ink p-5 shadow-2xl"
              initial={noMotion || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={noMotion || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: noMotion || reduce ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <Wordmark />
                <button
                  type="button"
                  onClick={() => close()}
                  aria-label="Close menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-bone transition-colors hover:bg-panel-2/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav aria-label="Mobile" className="mt-4 flex flex-col">
                {NAV_ITEMS.map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    onClick={() => close(false)}
                    className="flex items-center justify-between border-t border-bone/10 py-4 font-display text-[22px] font-bold uppercase tracking-tight text-bone"
                  >
                    {n.label}
                    <ArrowUpRight className="h-5 w-5 text-orange" />
                  </a>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

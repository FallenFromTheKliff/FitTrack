"use client";

import { CreditCard, Users, CalendarClock } from "lucide-react";

import FitTrackLogo from "@/components/brand/FitTrackLogo";

import { Eyebrow, Reveal } from "./ui";

const OPTIONS = [
  {
    icon: CreditCard,
    title: "Memberships & passes",
    body: "Daily, weekly, monthly, and yearly options. Ask the front desk what each option includes before you choose.",
    note: "Ask the front desk for current rates",
  },
  {
    icon: Users,
    title: "Coaching",
    body: "Work with a coach on strength & conditioning, mobility & recovery, or boxing.",
    note: "Availability varies by coach",
  },
  {
    icon: CalendarClock,
    title: "Room & court bookings",
    body: "Ask about reserving the court, ring, or a room. Availability and rates depend on the amenity and time.",
    note: "Check availability before you visit",
  },
];

const STEPS = [
  { n: "1", t: "Explore", d: "Browse the gym, spaces, and available services above." },
  { n: "2", t: "Choose", d: "Pick the type of training or visit that suits you right now." },
  { n: "3", t: "Get going", d: "Sign in through FitTrack, or contact the team for guidance." },
];

export default function GetStarted() {
  return (
    <section id="start" data-landing-region="start" className="scroll-mt-20 bg-ink-2 py-20 sm:py-28">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Reveal className="max-w-[52ch]">
          <Eyebrow className="text-orange">Ways to get started</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-bone">
            Pick your next step
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-bone/70">
            Compare your options, then take one clear next step. No pressure — the front desk can
            walk you through anything.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {OPTIONS.map((o, i) => (
            <Reveal key={o.title} delay={i * 0.06} className="flex flex-col rounded-2xl border border-bone/12 bg-panel p-7 transition-colors hover:border-orange/40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-orange">
                <o.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-display text-[21px] font-bold uppercase tracking-tight text-bone">{o.title}</h3>
              <p className="mt-3 flex-1 text-[15.5px] leading-relaxed text-bone/70">{o.body}</p>
              <p className="mt-5 border-t border-bone/12 pt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-bone/50">{o.note}</p>
            </Reveal>
          ))}
        </div>

        {/* Journey + FitTrack */}
        <Reveal className="mt-6 grid gap-8 rounded-2xl bg-panel-2 p-8 text-bone md:grid-cols-[1.2fr_0.8fr] md:p-10">
          <div>
            <h3 className="font-display text-[22px] font-bold uppercase tracking-tight">A simple starting journey</h3>
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="font-display text-[34px] font-black leading-none text-orange">{s.n}</span>
                  <p className="mt-2 font-display text-[15px] font-bold uppercase tracking-wide">{s.t}</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-bone/65">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-xl bg-panel p-6">
            <p className="text-[14.5px] leading-relaxed text-bone/70">
              <span className="font-semibold text-bone">FitTrack</span> is SertFit's app and web
              management platform — sign in for member access, membership details, and bookings.
            </p>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange p-1.5">
                <FitTrackLogo size={42} alt="" />
              </span>
              <span className="font-display text-[18px] font-extrabold tracking-tight">FitTrack</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

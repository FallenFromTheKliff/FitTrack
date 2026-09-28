"use client";

import { motion } from "framer-motion";
import { ArrowDownRight } from "lucide-react";

import { OFFERINGS } from "../landing-data";
import { handleImageError, unsplash, useMakeMotionPreference } from "./ui";

export default function Hero() {
  const { noMotion, reduce } = useMakeMotionPreference();
  const ease = [0.16, 1, 0.3, 1] as const;

  const fade = (delay: number) => ({
    ...(noMotion || reduce
      ? { animate: { opacity: 1, y: 0 }, transition: { duration: 0, delay: 0 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease },
        }),
  });

  return (
    <section data-landing-region="hero" className="relative overflow-hidden bg-ink pt-[68px]">
      {/* Ambient warm glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-[620px] w-[620px] rounded-full opacity-70 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(242,132,43,0.28) 0%, rgba(122,58,16,0.10) 45%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(rgba(246,241,233,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-8 pt-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16 lg:pt-20">
        {/* Copy */}
        <div className="relative z-10">
          <motion.div data-landing-reveal="true" {...fade(0)}>
            <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[0.22em] text-orange">
              <span aria-hidden className="h-px w-6 bg-orange" />
              SertFit Gym · Move with us
            </span>
          </motion.div>

          <motion.h1
            data-landing-reveal="true"
            {...fade(0.06)}
            className="mt-6 font-display text-[clamp(2.75rem,7vw,5.25rem)] font-black uppercase leading-[0.92] tracking-[-0.02em] text-bone"
          >
            Train your way.
            <br />
            <span className="text-orange">Build real strength.</span>
          </motion.h1>

          <motion.p
            data-landing-reveal="true"
            {...fade(0.14)}
            className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-bone/70 sm:text-[18px]"
          >
            Strength floors, a boxing ring, courts, and quiet space to recover — plus coaches who
            meet you where you are. Find your next session at SertFit Gym.
          </motion.p>

          <motion.div data-landing-reveal="true" {...fade(0.22)} className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#training"
              className="group inline-flex min-h-[52px] items-center gap-2 rounded-full bg-bone px-7 text-[15px] font-semibold text-ink transition-colors hover:bg-orange"
            >
              Explore the gym
              <ArrowDownRight className="h-4 w-4 transition-transform group-hover:translate-y-0.5" strokeWidth={2.2} />
            </a>
          </motion.div>
        </div>

        {/* Image */}
        <motion.figure
          data-landing-reveal="true"
          className="relative"
          {...(noMotion || reduce
            ? { animate: { opacity: 1, scale: 1 }, transition: { duration: 0 } }
            : {
                initial: { opacity: 0, scale: 1.04 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.8, ease },
              })}
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-panel shadow-2xl shadow-black/60 ring-1 ring-bone/10 sm:aspect-[5/6]">
            <img
              src={unsplash("1772450014702-498a8a3f61ae", 1000, 1200)}
              alt="A person lifting a loaded barbell during a strength session."
              className="h-full w-full object-cover"
              fetchPriority="high"
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
            <div className="absolute inset-0 rounded-[20px] ring-1 ring-inset ring-orange/10" />
          </div>
          <div className="absolute -left-3 bottom-5 hidden rounded-full bg-orange px-5 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink shadow-lg sm:block">
            Five ways to train
          </div>
        </motion.figure>
      </div>

      {/* Offerings strip */}
      <motion.div data-landing-reveal="true" {...fade(0.3)} className="border-y border-bone/10 bg-ink-2">
        <ul className="mx-auto flex max-w-[1240px] flex-wrap gap-x-8 gap-y-2 px-5 py-4 font-mono text-[12.5px] uppercase tracking-[0.14em] text-bone/65 sm:px-8">
          {OFFERINGS.map((o) => (
            <li key={o} className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange" />
              {o}
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}

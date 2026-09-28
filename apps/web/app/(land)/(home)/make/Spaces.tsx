"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Eyebrow, unsplash, handleImageError, useMakeMotionPreference } from "./ui";

const FACILITIES = [
  {
    id: "strength",
    name: "Strength Floor",
    desc: "Racks, plates, and cables with open space for free-weight and strength training at any level.",
    img: "1772450014622-1c209d012c2e",
    alt: "Strength floor with racks and free weights.",
  },
  {
    id: "court",
    name: "Basketball Court",
    desc: "An indoor court for pickup, drills, and reservable session time.",
    img: "1572454181157-0b40dd7667fe",
    alt: "Indoor basketball court prepared for training.",
  },
  {
    id: "ring",
    name: "Boxing Ring",
    desc: "A dedicated ring for boxing practice, conditioning, and one-to-one coaching.",
    img: "1651707999601-cba87015439c",
    alt: "Boxing ring arranged for practice and coaching.",
  },
  {
    id: "yoga",
    name: "Yoga Room",
    desc: "A calm, matted studio for mobility, stretching, and quieter guided sessions.",
    img: "1683056255281-e52a141924f0",
    alt: "Matted studio space arranged for yoga and mobility.",
  },
  {
    id: "recovery",
    name: "Recovery Corner",
    desc: "A dedicated space to cool down, work on mobility, and reset after training.",
    img: "1599901860904-17e6ed7083a0",
    alt: "Recovery area arranged for stretching and cooldown work.",
  },
] as const;

export default function Spaces() {
  const [active, setActive] = useState(0);
  const { noMotion, reduce } = useMakeMotionPreference();
  const current = FACILITIES[active];

  return (
    <section id="spaces" data-landing-region="spaces" className="scroll-mt-20 bg-ink-2 py-20 text-bone sm:py-28">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[46ch]">
            <Eyebrow className="text-orange">Spaces to train</Eyebrow>
            <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em]">
              Five spaces. Your way to train.
            </h2>
          </div>
          <p className="max-w-[38ch] text-[16px] leading-relaxed text-bone/60">
            Pick a space to preview it. Explore what’s here, then ask the team what’s available for
            your visit.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          {/* Featured image */}
          <div className="relative aspect-[16/12] overflow-hidden rounded-2xl bg-panel sm:aspect-[16/10]">
            <AnimatePresence mode="wait">
              <motion.img
                key={current.id}
                data-landing-reveal="true"
                src={unsplash(current.img, 1100, 720)}
                alt={current.alt}
                loading="lazy"
                onError={handleImageError}
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ opacity: noMotion || reduce ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: noMotion || reduce ? 1 : 0 }}
                transition={{ duration: noMotion || reduce ? 0 : 0.4, ease: "easeInOut" }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-orange">
                {String(active + 1).padStart(2, "0")} / {String(FACILITIES.length).padStart(2, "0")}
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={current.id}
                  data-landing-reveal="true"
                  className="mt-2 max-w-[42ch] text-[15.5px] leading-relaxed text-bone/85"
                  initial={noMotion || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={noMotion || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: noMotion || reduce ? 0 : 0.3 }}
                >
                  {current.desc}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Selector */}
          <div aria-label="Facilities" className="flex flex-col">
            {FACILITIES.map((f, i) => {
              const selected = i === active;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActive(i)}
                  className={`group flex items-center justify-between gap-4 border-t border-bone/12 py-5 text-left transition-colors last:border-b ${
                    selected ? "text-bone" : "text-bone/55 hover:text-bone/90"
                  }`}
                >
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[12px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-bold uppercase tracking-[-0.01em]">
                      {f.name}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${
                      selected ? "scale-100 bg-orange" : "scale-0 bg-ink/40 group-hover:scale-75"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

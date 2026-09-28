"use client";

import { Dumbbell, HeartPulse, Hand, Headset } from "lucide-react";
import { motion } from "framer-motion";

import { Reveal, Eyebrow, stagger, staggerItem, unsplash, handleImageError, useMakeMotionPreference } from "./ui";

const COACHING = [
  {
    icon: Dumbbell,
    title: "Strength & conditioning",
    body: "Coaching to help you lift well, program sensibly, and progress at a pace that fits you.",
  },
  {
    icon: HeartPulse,
    title: "Mobility & recovery",
    body: "Guidance for warmups, mobility work, and recovery so training feels sustainable.",
  },
  {
    icon: Hand,
    title: "Boxing",
    body: "Technique, footwork, and conditioning — for total beginners and returning boxers alike.",
  },
];

export default function People() {
  const { noMotion, reduce } = useMakeMotionPreference();
  const reducedMotion = noMotion || reduce;
  const listVariants = reducedMotion
    ? {
        hidden: { transition: { duration: 0, delay: 0 } },
        show: { transition: { duration: 0, delay: 0 } },
      }
    : stagger;
  const itemVariants = reducedMotion
    ? {
        hidden: { opacity: 1, y: 0, transition: { duration: 0, delay: 0 } },
        show: { opacity: 1, y: 0, transition: { duration: 0, delay: 0 } },
      }
    : staggerItem;

  return (
    <section id="team" data-landing-region="team" className="scroll-mt-20 bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <Eyebrow className="text-orange">People &amp; support</Eyebrow>
            <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-bone">
              Coaches and a front desk on your side
            </h2>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-bone/70">
              You're never left to figure it out alone. Our coaching covers three specialties, and
              the front desk is there for the practical parts of being a member.
            </p>

            <figure className="mt-8 aspect-[16/10] overflow-hidden rounded-2xl bg-panel">
              <img
                src={unsplash("1683056255281-e52a141924f0", 900, 560)}
                alt="People training together in a group session."
                loading="lazy"
                onError={handleImageError}
                className="h-full w-full object-cover"
              />
            </figure>
          </Reveal>

          <div>
            <motion.ul
              data-landing-reveal="true"
              variants={listVariants}
              initial={reducedMotion ? "show" : "hidden"}
              animate={reducedMotion ? "show" : undefined}
              whileInView={reducedMotion ? undefined : "show"}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              className="flex flex-col gap-4"
            >
              {COACHING.map((c) => (
                <motion.li
                  key={c.title}
                  data-landing-reveal="true"
                  variants={itemVariants}
                  className="flex gap-5 rounded-2xl border border-bone/12 bg-panel p-6 transition-colors hover:border-bone/25"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-panel-2 text-orange">
                    <c.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-display text-[19px] font-bold uppercase tracking-tight text-bone">{c.title}</h3>
                    <p className="mt-1.5 text-[15.5px] leading-relaxed text-bone/70">{c.body}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <Reveal delay={0.1}>
              <div className="mt-4 flex gap-5 rounded-2xl bg-panel-2 p-6 text-bone">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange text-ink">
                  <Headset className="h-5 w-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="font-display text-[19px] font-bold uppercase tracking-tight">The front desk</h3>
                  <p className="mt-1.5 text-[15.5px] leading-relaxed text-bone/70">
                    Memberships, check-ins, account questions, booking help, and payment guidance —
                    and a friendly hand planning your first visit.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

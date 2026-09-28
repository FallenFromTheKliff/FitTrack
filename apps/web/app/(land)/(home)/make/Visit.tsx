"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Phone, Share2, Camera, Plus } from "lucide-react";

import { CONTACT, FAQ as APPROVED_FAQ } from "../landing-data";
import styles from "../landing.module.css";
import { Eyebrow, Reveal, useMakeMotionPreference } from "./ui";

const FAQ = APPROVED_FAQ.map((item) => ({ q: item.question, a: item.answer }));

function FaqItem({
  q,
  a,
  open,
  onToggle,
  id,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
  id: string;
}) {
  const { noMotion, reduce } = useMakeMotionPreference();
  return (
    <div className="border-t border-bone/12 last:border-b">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          className="flex w-full items-center justify-between gap-4 py-5 text-left"
        >
          <span className="font-display text-[clamp(1.05rem,2vw,1.35rem)] font-bold uppercase tracking-tight text-bone">{q}</span>
          <Plus
            className={`h-5 w-5 shrink-0 text-orange transition-transform duration-300 ${open ? "rotate-45" : ""}`}
            strokeWidth={2.4}
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            data-landing-reveal="true"
            role="region"
            aria-labelledby={`${id}-btn`}
            initial={noMotion || reduce ? { opacity: 1, height: "auto" } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={noMotion || reduce ? { opacity: 1, height: "auto" } : { height: 0, opacity: 0 }}
            transition={{ duration: noMotion || reduce ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] pb-6 text-[16px] leading-relaxed text-bone/70">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CHANNELS = [
  { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: Phone, label: "Phone", value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
  { icon: Share2, label: "Facebook", value: "/sertfitgym", href: CONTACT.facebook, ext: true },
  { icon: Camera, label: "Instagram", value: "@sertfitgym", href: CONTACT.instagram, ext: true },
];

export default function Visit() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="visit" data-landing-region="visit" className="scroll-mt-20 bg-ink py-20 sm:py-28">
      <div className={`mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:gap-16 ${styles.visitGrid}`}>
        {/* FAQ */}
        <Reveal>
          <Eyebrow className="text-orange">Common questions</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-bone">
            Before your first visit
          </h2>
          <div className="mt-8">
            {FAQ.map((f, i) => (
              <FaqItem
                key={i}
                id={`faq-${i}`}
                q={f.q}
                a={f.a}
                open={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
              />
            ))}
          </div>
        </Reveal>

        {/* Contact */}
        <Reveal delay={0.08}>
          <div className="rounded-2xl bg-panel-2 p-8 text-bone">
            <h3 className="font-display text-[22px] font-bold uppercase tracking-tight">Talk to the team</h3>
            <p className="mt-3 text-[15.5px] leading-relaxed text-bone/70">
              Questions about training, memberships, or bookings? Reach out — we're happy to help
              you plan a first visit.
            </p>

            <ul className="mt-7 flex flex-col gap-2">
              {CHANNELS.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(c.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="group flex items-center gap-4 rounded-xl border border-bone/12 px-4 py-3.5 transition-colors hover:border-orange/60 hover:bg-panel"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-orange group-hover:bg-orange group-hover:text-ink">
                      <c.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone/50">{c.label}</span>
                      <span className="text-[15px] font-medium text-bone">{c.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <a
              href="#spaces"
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-bone/25 text-[14px] font-semibold text-bone transition-colors hover:border-bone/70"
            >
              Explore the spaces
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

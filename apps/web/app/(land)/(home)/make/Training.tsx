"use client";

import { ArrowRight } from "lucide-react";

import { Reveal, Eyebrow, unsplash, handleImageError } from "./ui";

const TRACKS = [
  {
    no: "01",
    title: "Strength & conditioning",
    body: "Racks, plates, and cables on an open strength floor. Build a base, add load with intent, and train with room to move — whether it's your first working set or your heaviest.",
    points: ["Free weights & racks", "Cable & machine stations", "Programmed conditioning"],
    img: "1770026137145-e792e19b9060",
    alt: "A person lifting dumbbells during strength training.",
  },
  {
    no: "02",
    title: "Boxing & active training",
    body: "Step into the ring for technique, footwork, and conditioning. Coaching keeps beginners safe and gives regulars something sharper to work toward.",
    points: ["Bag & pad work", "Ring practice", "Conditioning rounds"],
    img: "1726867863287-aba3393812d0",
    alt: "Two people practicing boxing in a ring.",
  },
  {
    no: "03",
    title: "Mobility, yoga & recovery",
    body: "Quieter sessions to stretch, breathe, and reset. The yoga room and recovery corner give your training somewhere to land — so you come back ready.",
    points: ["Guided mobility", "Yoga & stretching", "Cooldown & recovery"],
    img: "1661307987465-1db8d7a8796f",
    alt: "A person moving through a yoga stretch in a calm studio space.",
  },
];

export default function Training() {
  return (
    <section id="training" data-landing-region="training" className="scroll-mt-20 bg-ink py-20 sm:py-28">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Reveal className="max-w-[52ch]">
          <Eyebrow className="text-orange">Ways to train</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-bone">
            Three directions,
            <br className="hidden sm:block" /> one place to grow
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-bone/70">
            Come for one thing or move between them. Every track is approachable for a first visit and
            deep enough to keep you progressing.
          </p>
        </Reveal>

        <div className="mt-14 flex flex-col gap-14 sm:gap-20">
          {TRACKS.map((t, i) => {
            const flip = i % 2 === 1;
            return (
              <Reveal
                key={t.no}
                className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${flip ? "lg:[&>figure]:order-2" : ""}`}
              >
                <figure className="group relative aspect-[16/11] overflow-hidden rounded-2xl bg-panel">
                  <img
                    src={unsplash(t.img, 1000, 720)}
                    alt={t.alt}
                    loading="lazy"
                    onError={handleImageError}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <span className="absolute left-4 top-4 font-mono text-[12px] font-semibold tracking-[0.2em] text-bone/90">
                    {t.no}
                  </span>
                </figure>

                <div>
                  <h3 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold uppercase leading-[1] tracking-[-0.01em] text-bone">
                    {t.title}
                  </h3>
                  <p className="mt-4 max-w-[48ch] text-[16.5px] leading-relaxed text-bone/70">{t.body}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {t.points.map((p) => (
                      <li key={p} className="rounded-full border border-bone/15 bg-panel px-3.5 py-1.5 text-[13px] font-medium text-bone/80">
                        {p}
                      </li>
                    ))}
                  </ul>
                  <a href="#spaces" className="group mt-7 inline-flex items-center gap-2 text-[14px] font-semibold text-orange">
                    See the spaces
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.2} />
                  </a>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

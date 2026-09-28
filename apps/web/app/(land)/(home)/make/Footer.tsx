"use client";

import Link from "next/link";

import { CONTACT, NAV_ITEMS } from "../landing-data";
import { Reveal } from "./ui";
import { Wordmark } from "./Header";

export default function Footer() {
  return (
    <footer data-landing-region="footer" className="bg-ink text-bone">
      {/* Closing invitation */}
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="max-w-[20ch]">
          <h2 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]">
            Come train
            <br />
            with <span className="text-orange">us</span>.
          </h2>
        </Reveal>
        <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-3">
          <a
            href="#visit"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-bone/25 px-7 text-[15px] font-semibold text-bone transition-colors hover:border-bone/70"
          >
            Contact the team
          </a>
        </Reveal>
      </div>

      {/* Footer meta */}
      <div className="border-t border-bone/12">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-5 py-12 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-[34ch]">
            <Wordmark tone="light" />
            <p className="mt-4 text-[14.5px] leading-relaxed text-bone/60">
              A gym for strength, movement, and recovery. FitTrack is SertFit's app and web
              management platform for member access, membership details, and bookings.
            </p>
          </div>

          <nav aria-label="Footer" className="flex gap-14">
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/55">Explore</span>
              {[
                ...NAV_ITEMS,
                { label: "Get started", href: "#start" },
              ].map(({ label, href }) => (
                <a key={href} href={href} className="text-[14.5px] text-bone/75 transition-colors hover:text-orange">
                  {label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone/55">Connect</span>
              <a href={`mailto:${CONTACT.email}`} className="text-[14.5px] text-bone/75 transition-colors hover:text-orange">Email</a>
              <a href={CONTACT.facebook} target="_blank" rel="noreferrer" className="text-[14.5px] text-bone/75 transition-colors hover:text-orange">Facebook</a>
              <a href={CONTACT.instagram} target="_blank" rel="noreferrer" className="text-[14.5px] text-bone/75 transition-colors hover:text-orange">Instagram</a>
            </div>
          </nav>
        </div>

        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 border-t border-bone/12 px-5 py-6 text-[12.5px] text-bone/55 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} SertFit Gym. All rights reserved.</span>
          <Link href="/login" className="text-bone/55 underline-offset-4 transition-colors hover:text-bone/80 hover:underline">
            Team sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Footer from "./Footer";
import GetStarted from "./GetStarted";
import Header from "./Header";
import Hero from "./Hero";
import People from "./People";
import Spaces from "./Spaces";
import Training from "./Training";
import Visit from "./Visit";
import { useLandingHydration } from "./ui";
import styles from "../landing.module.css";

export default function App() {
  const hydrated = useLandingHydration();

  return (
    <div
      className={`sertfit-landing ${styles.hydrationScope}`}
      data-sertfit-hydrated={hydrated ? "true" : "false"}
    >
      <div className="min-h-full bg-ink text-bone">
        <a
          href="#top"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-orange focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        <Header />
        <div data-landing-content>
          <main id="top" tabIndex={-1}>
            <Hero />
            <Training />
            <Spaces />
            <People />
            <GetStarted />
            <Visit />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}

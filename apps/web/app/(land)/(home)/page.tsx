import type { Metadata } from "next";

import SertFitLanding from "./SertFitLanding";
import "./landing.generated.css";

export const metadata: Metadata = {
  title: "SertFit Gym | Move with us",
  description:
    "Explore SertFit Gym training spaces, coaching, and ways to start your next session.",
};

export default function Page() {
  return <SertFitLanding />;
}

"use client";

import { ArrowLeft, Lock } from "lucide-react";

import { LOCKED_PAGE_COPY } from "@/app/(land)/locked/helpers";

import { AuthStatusPage } from "./AuthStatusPage";

const LOCKED_DETAIL_ITEMS = [
  {
    body: "Try signing in again after 30 minutes so the protection window can clear safely.",
    title: "Wait for the cooldown"
  },
  {
    body: "Use the login page password recovery flow if you suspect the password is wrong or compromised.",
    title: "Recover access from the portal"
  }
] as const;

export function LockedStatusPage() {
  return (
    <AuthStatusPage
      Icon={Lock}
      badge="Security Hold"
      body={LOCKED_PAGE_COPY.body}
      detailHeading="What you can do now"
      detailItems={LOCKED_DETAIL_ITEMS}
      footerNote="If the lock was unexpected or you still cannot sign in after the cooldown, contact support from the portal."
      heroAccent="Protected."
      heroCalloutBody="Return to the web portal and use password recovery if you do not want to wait for the cooldown window."
      heroCalloutTitle="Fastest recovery"
      heroStats={["Temporary lock", "30-minute cooldown", "Recovery available"]}
      heroSubtitle="FitTrack paused sign-in after repeated failed attempts. Wait for the cooldown or recover access from the portal."
      heroTitle="Account"
      noticeBody={LOCKED_PAGE_COPY.noticeBody}
      noticeTitle={LOCKED_PAGE_COPY.noticeTitle}
      primaryAction={{ href: "/login", icon: ArrowLeft, label: "Back to Login" }}
      title={LOCKED_PAGE_COPY.title}
      tone="warning"
    />
  );
}

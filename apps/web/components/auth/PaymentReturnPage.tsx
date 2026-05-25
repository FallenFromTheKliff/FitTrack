"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AuthStatusPage } from "./AuthStatusPage";

type PaymentReturnVariant = "cancel" | "success";

type DetailItem = {
  body: string;
  title: string;
};

type PaymentReturnContent = {
  Icon: LucideIcon;
  badge: string;
  body: string;
  detailItems: readonly DetailItem[];
  footerNote: string;
  heroAccent: string;
  heroStats: readonly string[];
  heroSubtitle: string;
  heroTitle: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  noticeBody: string;
  noticeTitle: string;
  title: string;
  tone: "success" | "warning";
};

function resolveGenericContent(variant: PaymentReturnVariant): PaymentReturnContent {
  if (variant === "success") {
    return {
      Icon: CheckCircle2,
      badge: "PayMongo Return",
      body:
        "PayMongo sent the browser back to FitTrack after checkout. This return alone does not prove the payment is already settled inside the app.",
      detailItems: [
        {
          body:
            "This page only confirms the browser redirect completed. The actual purchase status still depends on FitTrack receiving the final payment confirmation on the backend.",
          title: "What this page confirms"
        },
        {
          body:
            "Reopen the screen where you started the checkout and refresh it there. If the payment is still pending after a short wait, contact staff before starting a second attempt.",
          title: "What to do next"
        }
      ],
      footerNote:
        "PayMongo return pages stay public so the browser can land here even if the original FitTrack session is gone.",
      heroAccent: "Received.",
      heroStats: ["Browser returned", "Backend confirmation still required", "Refresh the original screen"],
      heroSubtitle:
        "The checkout flow returned to FitTrack, but the final status still belongs to the server confirmation path.",
      heroTitle: "Payment Return",
      noticeBody:
        "Avoid starting the same purchase again until you have checked the original FitTrack screen or confirmed the payment status with staff.",
      noticeTitle: "Do not treat the redirect itself as final settlement.",
      primaryActionHref: "/dashboard",
      primaryActionLabel: "Return to Web Portal",
      title: "Checkout Returned",
      tone: "success"
    };
  }

  return {
    Icon: XCircle,
    badge: "PayMongo Return",
    body:
      "The checkout was cancelled, closed, or abandoned before FitTrack received a confirmed completion signal.",
    detailItems: [
      {
        body:
          "No payment should be assumed successful from this page. FitTrack should keep access unchanged unless a later verified payment event says otherwise.",
        title: "What this means"
      },
      {
        body:
          "If you still want to continue, go back to the screen where you started the checkout and retry from there instead of refreshing this page.",
        title: "How to retry safely"
      }
    ],
    footerNote:
      "PayMongo return pages stay public so the browser can land here even if the original FitTrack session is gone.",
    heroAccent: "Cancelled.",
    heroStats: ["Payment not confirmed", "Original purchase stays unchanged", "Retry from the source screen"],
    heroSubtitle:
      "FitTrack should keep the purchase unchanged until a verified backend confirmation says otherwise.",
    heroTitle: "Payment Return",
    noticeBody:
      "Do not mark a payment as settled just because the browser reached this page. Retry from the original FitTrack flow if you still want to continue.",
    noticeTitle: "This is not a payment receipt.",
    primaryActionHref: "/dashboard",
    primaryActionLabel: "Return to Web Portal",
    title: "Checkout Was Cancelled",
    tone: "warning"
  }
}

function resolveMembershipCardContent(variant: PaymentReturnVariant): PaymentReturnContent {
  if (variant === "success") {
    return {
      Icon: CheckCircle2,
      badge: "Membership Card Return",
      body:
        "Your membership-card checkout returned from PayMongo. The card can stay pending briefly until FitTrack receives and processes the backend payment confirmation.",
      detailItems: [
        {
          body:
            "Reopen the member Profile screen where you started the purchase. That screen is the source of truth for whether the card is still pending, active, or needs staff follow-up.",
          title: "Best next step"
        },
        {
          body:
            "If the member card does not move forward after a short wait, contact the front desk or admin team before attempting another card purchase.",
          title: "If the card still looks stuck"
        }
      ],
      footerNote:
        "This page is public so PayMongo can safely redirect here even if the original member session was opened from the mobile app.",
      heroAccent: "Returned.",
      heroStats: ["Membership-card checkout came back", "Card may stay pending briefly", "Refresh Profile for final state"],
      heroSubtitle:
        "The browser return reached FitTrack, but the member card becomes trustworthy only after the backend confirmation path finishes.",
      heroTitle: "Membership Card",
      noticeBody:
        "Do not start another membership-card purchase right away. First reopen Profile and confirm whether the current attempt is still processing or already completed.",
      noticeTitle: "One checkout can still be in flight after the redirect.",
      primaryActionHref: "/profile",
      primaryActionLabel: "Return to Profile",
      title: "Membership Card Checkout Returned",
      tone: "success"
    };
  }

  return {
    Icon: XCircle,
    badge: "Membership Card Return",
    body:
      "The membership-card checkout was cancelled or closed before FitTrack received a confirmed completion signal.",
    detailItems: [
      {
        body:
          "No membership-card activation should be assumed from this page. The account should stay in its current state unless a later verified payment event arrives.",
          title: "What this means"
        },
        {
          body:
            "If you still want the card, reopen the member Profile screen and restart the purchase from there. That keeps the retry aligned with the real membership-card state.",
          title: "How to retry"
        }
      ],
      footerNote:
        "This page is public so PayMongo can safely redirect here even if the original member session was opened from the mobile app.",
      heroAccent: "Cancelled.",
      heroStats: ["Card not activated", "Account stays unchanged", "Retry from Profile if needed"],
      heroSubtitle:
        "FitTrack should leave membership-card access unchanged until a verified payment event confirms otherwise.",
      heroTitle: "Membership Card",
      noticeBody:
        "If a previous attempt still appears pending in Profile, wait for it to settle or ask staff to confirm the payment state before trying again.",
      noticeTitle: "Avoid stacking duplicate card purchases.",
      primaryActionHref: "/profile",
      primaryActionLabel: "Return to Profile",
      title: "Membership Card Checkout Cancelled",
      tone: "warning"
    };
}

export function PaymentReturnPage({ variant }: { variant: PaymentReturnVariant }) {
  const searchParams = useSearchParams();
  const content = useMemo(() => {
    const flow = searchParams.get("flow");

    if (flow === "membership-card") {
      return resolveMembershipCardContent(variant);
    }

    return resolveGenericContent(variant);
  }, [searchParams, variant]);

  return (
    <AuthStatusPage
      Icon={content.Icon}
      badge={content.badge}
      body={content.body}
      detailHeading="What to expect next"
      detailItems={content.detailItems}
      footerNote={content.footerNote}
      heroAccent={content.heroAccent}
      heroCalloutBody="If you started this in the member app, reopen the original FitTrack screen after the redirect and refresh there. The server-side payment status remains the source of truth."
      heroCalloutTitle="After the browser return"
      heroStats={content.heroStats}
      heroSubtitle={content.heroSubtitle}
      heroTitle={content.heroTitle}
      noticeBody={content.noticeBody}
      noticeTitle={content.noticeTitle}
      primaryAction={{
        href: content.primaryActionHref,
        icon: ArrowLeft,
        label: content.primaryActionLabel
      }}
      title={content.title}
      tone={content.tone}
    />
  );
}

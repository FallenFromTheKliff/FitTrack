"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { webApiClient } from "@/lib/api-client";
import {
  clearCommerceCheckoutHold,
  readCommerceCheckoutHold,
  type StoredCommerceCheckoutHold,
} from "@/lib/commerce-checkout";
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

type CheckoutHoldState =
  | "pending"
  | "succeeded"
  | "expired"
  | "failed"
  | "error"
  | "retry";

function resolveCheckoutHoldContent(
  baseContent: PaymentReturnContent,
  state: CheckoutHoldState | null | undefined,
  hasHold: boolean,
): PaymentReturnContent {
  if (!hasHold || state === undefined || state === null) {
    return baseContent;
  }

  if (state === "succeeded") {
    return {
      ...baseContent,
      body:
        "FitTrack received the successful full-payment confirmation. The related access or booking can now move to its active state.",
      heroAccent: "Confirmed.",
      heroStats: ["Full payment confirmed", "Access or booking can activate", "Refresh the original FitTrack screen"],
      heroSubtitle:
        "The checkout hold is complete. The original FitTrack screen is now the source of truth for the active result.",
      noticeBody:
        "The full payment was confirmed. Reopen the original FitTrack screen and refresh it to see the active booking or access.",
      noticeTitle: "Checkout complete.",
      title: "Payment Confirmed",
      tone: "success",
    };
  }

  if (state === "expired") {
    return {
      ...baseContent,
      body:
        "This checkout hold expired before FitTrack received a successful confirmation, so the related booking or access stays unchanged.",
      heroAccent: "Hold expired.",
      heroStats: ["Checkout hold expired", "Full payment not confirmed", "Retry from the original screen"],
      heroSubtitle:
        "The hold reached its expiry time without a successful confirmation. No product booking or active access should be created from this attempt.",
      noticeBody:
        "Return to the original FitTrack flow to start a fresh attempt. Do not reuse this expired checkout.",
      noticeTitle: "Checkout hold expired.",
      title: "Checkout Hold Expired",
      tone: "warning",
    };
  }

  if (state === "failed") {
    return {
      ...baseContent,
      body:
        "The full checkout failed, so FitTrack left the related booking or access unchanged.",
      heroAccent: "Not completed.",
      heroStats: ["Checkout failed", "Full payment not confirmed", "Retry from the original screen"],
      heroSubtitle:
        "The checkout returned a failed result. No product booking or active access should be created from this attempt.",
      noticeBody:
        "Return to the original FitTrack flow if you still want to try again. Avoid starting a second attempt until this result is clear.",
      noticeTitle: "Checkout failed.",
      title: "Checkout Failed",
      tone: "warning",
    };
  }

  if (state === "error") {
    return {
      ...baseContent,
      body:
        "FitTrack could not read the checkout hold status. The related booking or access stays unchanged until the status is known.",
      heroAccent: "Status unavailable.",
      heroStats: ["Checkout returned", "Status lookup failed", "Retry status lookup"],
      heroSubtitle:
        "The browser return arrived, but the server status could not be loaded safely.",
      noticeBody:
        "Retry the status lookup. If it continues to fail, return to the original FitTrack screen or contact staff before starting another checkout.",
      noticeTitle: "Checkout status unavailable.",
      title: "Checkout Status Error",
      tone: "warning",
    };
  }

  if (state === "retry") {
    return {
      ...baseContent,
      body:
        "FitTrack is retrying the checkout hold status lookup. The related booking or access stays unchanged until the server confirms the result.",
      heroAccent: "Retrying.",
      heroStats: ["Checkout returned", "Retrying status lookup", "Access stays unchanged until success"],
      heroSubtitle:
        "The status lookup was requested again and will keep the hold matched to its original return.",
      noticeBody:
        "Keep this checkout attempt intact while FitTrack retries. Do not start a duplicate checkout.",
      noticeTitle: "Retrying checkout status.",
      title: "Retrying Checkout Status",
      tone: "success",
    };
  }

  return {
    ...baseContent,
    body:
      "FitTrack is still processing the full-payment confirmation. The related booking or access stays unchanged until the checkout succeeds.",
    heroAccent: "Processing.",
    heroStats: ["Checkout returned", "Waiting for full-payment confirmation", "Access stays unchanged until success"],
    heroSubtitle:
      "The checkout return arrived, and FitTrack is polling the hold status before activating the related product.",
    noticeBody:
      "Keep this attempt intact for a short while, then refresh the original FitTrack screen. Do not start a duplicate checkout.",
    noticeTitle: "Checkout confirmation is processing.",
    title: "Checkout Processing",
    tone: "success",
  };
}

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
            "Reopen the screen where you started the checkout and refresh it there. If confirmation has not arrived after a short wait, contact staff before starting a second attempt.",
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
      "FitTrack should keep the purchase unchanged until a successful backend confirmation says otherwise.",
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
        "Your membership-card checkout returned from PayMongo. Access becomes active only after FitTrack receives and processes the successful payment confirmation.",
      detailItems: [
        {
          body:
            "Reopen the member Profile screen where you started the purchase. That screen is the source of truth for whether access is active after the checkout confirmation.",
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
      heroStats: ["Membership-card checkout came back", "Access activates after confirmation", "Refresh Profile for final state"],
      heroSubtitle:
        "The browser return reached FitTrack, but member access becomes active only after the backend confirmation path finishes.",
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
        "FitTrack should leave membership-card access unchanged until a successful payment confirmation says otherwise.",
      heroTitle: "Membership Card",
      noticeBody:
        "If access has not activated in Profile, wait for the checkout status to finish before trying again.",
      noticeTitle: "Avoid stacking duplicate card purchases.",
      primaryActionHref: "/profile",
      primaryActionLabel: "Return to Profile",
      title: "Membership Card Checkout Cancelled",
      tone: "warning"
    };
}

export function PaymentReturnPage({ variant }: { variant: PaymentReturnVariant }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [storedHold, setStoredHold] = useState<StoredCommerceCheckoutHold | null>(null);
  const queryHoldId = searchParams.get("hold_id") ?? searchParams.get("checkout_hold_id");

  useEffect(() => {
    setStoredHold(readCommerceCheckoutHold());
  }, []);

  const holdId = queryHoldId ?? storedHold?.holdId ?? null;
  const matchingStoredHold = storedHold?.holdId === holdId ? storedHold : null;
  const holdQuery = useQuery({
    enabled: variant === "success" && Boolean(holdId),
    queryFn: () => webApiClient.commerceCheckout.getHoldStatus(holdId!),
    queryKey: ["commerce-checkout-return", holdId],
    refetchInterval: (query) => (query.state.data?.state === "pending" ? 2000 : false),
    retry: 2
  });

  const checkoutState: CheckoutHoldState | null | undefined =
    holdQuery.isError
      ? holdQuery.isFetching
        ? "retry"
        : "error"
      : holdQuery.data?.state === "pending" &&
          (holdQuery.data.expiresAt ?? matchingStoredHold?.expiresAt) &&
          Date.parse(holdQuery.data.expiresAt ?? matchingStoredHold?.expiresAt ?? "") <= Date.now()
        ? "expired"
        : holdQuery.data?.state ?? (holdQuery.isFetching ? "pending" : undefined);

  useEffect(() => {
    if (variant === "cancel") {
      clearCommerceCheckoutHold(holdId);
      return;
    }

    if (checkoutState && ["succeeded", "expired", "failed"].includes(checkoutState)) {
      clearCommerceCheckoutHold(holdId);
      void queryClient.invalidateQueries();
    }
  }, [checkoutState, holdId, queryClient, variant]);

  const baseContent = useMemo(() => {
    const flow = searchParams.get("flow");

    if (flow === "membership-card") {
      return resolveMembershipCardContent(variant);
    }

    return resolveGenericContent(variant);
  }, [searchParams, variant]);
  const content = useMemo(
    () =>
      resolveCheckoutHoldContent(
        baseContent,
        checkoutState,
        Boolean(holdId),
      ),
    [baseContent, checkoutState, holdId],
  );

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

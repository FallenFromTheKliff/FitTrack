import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { membershipCurrentSubscriptionQueryOptions } from "@fittrack/query";
import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";

function formatMembershipStatus(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function usePremiumFitnessAccess() {
  const { user } = useAuth();
  const isMember = user?.role === "USER";

  const subscriptionQuery = useQuery({
    ...membershipCurrentSubscriptionQueryOptions(mobileApiClient, user?.id),
    enabled: !!user?.id && isMember,
    staleTime: 60_000,
    gcTime: 300_000
  });

  const currentSubscription = subscriptionQuery.data ?? null;
  const subscriptionStatus = currentSubscription?.status ?? null;
  const hasActivePlan = subscriptionStatus === "active";
  const isPlanAccessLoading = isMember && subscriptionQuery.status === "pending";
  const isPremiumLocked = isMember && !isPlanAccessLoading && !hasActivePlan;
  const subscriptionStatusLabel = currentSubscription
    ? formatMembershipStatus(subscriptionStatus)
    : "No active member access";

  const membershipAccessSummary = useMemo(() => {
    if (currentSubscription) {
      return `${currentSubscription.plan?.name ?? "Membership plan"} is currently ${subscriptionStatusLabel}.`;
    }
    return "No active membership card is on this account yet.";
  }, [currentSubscription, subscriptionStatusLabel]);

  return {
    currentSubscription,
    hasActivePlan,
    isMember,
    isPlanAccessLoading,
    isPremiumLocked,
    membershipAccessSummary,
    subscriptionStatusLabel
  };
}

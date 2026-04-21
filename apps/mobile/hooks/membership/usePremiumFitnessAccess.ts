import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { membershipCurrentSubscriptionQueryOptions } from "@fittrack/query";
import { useAuth } from "@/contexts/AuthContext";
import { mobileApiClient } from "@/lib/api-client";

function formatMembershipStatus(value: string) {
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
  const hasActivePlan = currentSubscription?.status === "active";
  const isPlanAccessLoading = isMember && subscriptionQuery.status === "pending";
  const isPremiumLocked = isMember && !isPlanAccessLoading && !hasActivePlan;
  const subscriptionStatusLabel = currentSubscription
    ? formatMembershipStatus(currentSubscription.status)
    : "No active plan";

  const membershipAccessSummary = useMemo(() => {
    if (currentSubscription) {
      return `${currentSubscription.plan.name} is currently ${subscriptionStatusLabel}.`;
    }
    return "No active membership plan is on this account yet.";
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

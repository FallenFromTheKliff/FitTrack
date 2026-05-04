import { resolveApiBaseUrl } from "@fittrack/api-client";

import { AdminLoginPage } from "@/components/auth/AdminLoginPage";
import { buildLoginHeroStats } from "@/data/auth/auth";

export const dynamic = "force-dynamic";

type PortalSummaryResponse = {
  active_members: number;
  sessions_today: number;
  total_revenue: string;
};

type PortalSummaryEnvelope = {
  data?: PortalSummaryResponse;
};

async function getPortalSummary(): Promise<PortalSummaryResponse | null> {
  const fallbackBaseUrl =
    process.env.NODE_ENV === "production"
      ? process.env.API_INTERNAL_ORIGIN
      : "http://127.0.0.1:3001/v1";
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL
    : undefined;
  const baseUrl = resolveApiBaseUrl(
    configuredBaseUrl,
    fallbackBaseUrl ?? "http://127.0.0.1:3001/v1"
  );

  try {
    const response = await fetch(`${baseUrl}/auth/portal-summary`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as
      | PortalSummaryResponse
      | PortalSummaryEnvelope;

    if ("data" in payload && payload.data) {
      return payload.data;
    }

    return payload as PortalSummaryResponse;
  } catch {
    return null;
  }
}

export default async function Page() {
  const summary = await getPortalSummary();

  return <AdminLoginPage heroStats={buildLoginHeroStats(summary)} />;
}

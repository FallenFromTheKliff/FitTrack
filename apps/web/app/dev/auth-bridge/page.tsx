"use client";

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@fittrack/app-core";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeNext(nextValue: string | null) {
  if (!nextValue || !nextValue.startsWith("/")) return "/analytics";
  return nextValue;
}

export default function DevAuthBridgePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "blocked" | "missing" | "working">("idle");

  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const nextPath = useMemo(() => normalizeNext(searchParams.get("next")), [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isLocalhostHost(window.location.hostname)) {
      setStatus("blocked");
      return;
    }

    if (!accessToken) {
      setStatus("missing");
      return;
    }

    setStatus("working");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

    if (refreshToken && refreshToken.trim() !== "") {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }

    router.replace(nextPath);
  }, [accessToken, nextPath, refreshToken, router]);

  if (status === "blocked") {
    return (
      <main className="min-h-screen bg-base text-text-primary flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-border bg-surface-raised p-8">
          <h1 className="text-2xl font-semibold">Dev auth bridge unavailable</h1>
          <p className="mt-3 text-sm text-text-muted">
            This helper only works on localhost development hosts.
          </p>
        </div>
      </main>
    );
  }

  if (status === "missing") {
    return (
      <main className="min-h-screen bg-base text-text-primary flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-border bg-surface-raised p-8">
          <h1 className="text-2xl font-semibold">Missing token</h1>
          <p className="mt-3 text-sm text-text-muted">
            Provide an <code>access_token</code> query parameter to seed the local session.
          </p>
          <Link className="mt-5 inline-block text-sm text-brand" href="/login">
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base text-text-primary flex items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-border bg-surface-raised p-8">
        <h1 className="text-2xl font-semibold">Seeding dev session</h1>
        <p className="mt-3 text-sm text-text-muted">
          Writing local auth tokens and redirecting to <code>{nextPath}</code>.
        </p>
      </div>
    </main>
  );
}

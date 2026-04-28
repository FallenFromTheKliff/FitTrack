"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user?.role === "ADMIN") {
      router.replace("/analytics");
      return;
    }

    router.replace("/schedule");
  }, [isLoading, router, user?.role]);

  return null;
}

"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/lib/queryClient";

function isEmptyObjectRejection(reason: unknown) {
  return (
    reason !== null &&
    typeof reason === "object" &&
    Object.getPrototypeOf(reason) === Object.prototype &&
    Object.keys(reason).length === 0
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  const { loadUserSettings, clearUserSettings } = useTheme();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isEmptyObjectRejection(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryProvider>
      <AuthProvider onUserLoaded={loadUserSettings} onUserCleared={clearUserSettings}>
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}

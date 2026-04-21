"use client";
import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/lib/queryClient";

export default function Providers({ children }: { children: ReactNode }) {
  const { loadUserSettings, clearUserSettings } = useTheme();
  return (
    <QueryProvider>
      <AuthProvider onUserLoaded={loadUserSettings} onUserCleared={clearUserSettings}>
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}

"use client";
import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { MemberProvider } from "@/contexts/MemberContext";
import { ScheduleProvider } from "@/contexts/ScheduleContext";
import { QueryProvider } from "@/lib/queryClient";

export default function Providers({ children }: { children: ReactNode }) {
  const { loadUserSettings, clearUserSettings } = useTheme();
  return (
    <QueryProvider>
      <AuthProvider onUserLoaded={loadUserSettings} onUserCleared={clearUserSettings}>
        <MemberProvider>
          <ScheduleProvider>{children}</ScheduleProvider>
        </MemberProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

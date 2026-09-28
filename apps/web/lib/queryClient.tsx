"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useStableQueryClient } from "@fittrack/query";

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = useStableQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

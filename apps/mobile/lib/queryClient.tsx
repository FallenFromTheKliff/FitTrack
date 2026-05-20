import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";

import { toApiClientError } from "@fittrack/api-client";

const NETWORK_TOAST_COOLDOWN_MS = 3500;

let lastNetworkToastAt = 0;

function showNetworkToast(message: string) {
  const now = Date.now();
  if (now - lastNetworkToastAt < NETWORK_TOAST_COOLDOWN_MS) {
    return;
  }
  lastNetworkToastAt = now;

  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.LONG);
    return;
  }

  Alert.alert("Connection problem", message);
}

function notifyNetworkError(error: unknown) {
  const apiError = toApiClientError(error, "Request failed.");

  if (apiError.kind === "network") {
    showNetworkToast("No internet connection. Check your connection and try again.");
    return;
  }

  if (apiError.kind === "timeout") {
    showNetworkToast("Connection timed out. Check your internet and try again.");
  }
}

function makeMobileQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error) {
        notifyNetworkError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError(error) {
        notifyNetworkError(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeMobileQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

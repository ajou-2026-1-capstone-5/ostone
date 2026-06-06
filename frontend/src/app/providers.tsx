import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { AUTH_SESSION_CHANGED_EVENT } from "@/shared/lib/auth";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const clearSessionScopedCache = () => {
      queryClient.clear();
    };

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, clearSessionScopedCache);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, clearSessionScopedCache);
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

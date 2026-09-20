"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { Toaster } from "sonner";
import { createAppStore, type AppState } from "@/stores/app-store";

type StoreApi = ReturnType<typeof createAppStore>;
const StoreContext = createContext<StoreApi | null>(null);

export function useAppStore<T>(selector: (state: AppState) => T) {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppProviders");
  return useStore(store, selector);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } } }));
  const [store] = useState(() => createAppStore());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
        <Toaster richColors position="top-right" closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

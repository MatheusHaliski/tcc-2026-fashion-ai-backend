"use client";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/i18n";
import { ThemeProvider } from "@/lib/theme/theme";
import { AuthProvider } from "@/lib/auth/session";
import { ToastProvider } from "@/components/ui";
import { DetailModalProvider } from "@/components/detail-modal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider><DetailModalProvider>{children}</DetailModalProvider></AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

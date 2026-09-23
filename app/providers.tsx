"use client";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/i18n";
import { ThemeProvider } from "@/lib/theme/theme";
import { AuthProvider } from "@/lib/auth/session";
import { ToastProvider } from "@/components/ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

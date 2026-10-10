"use client";
import type { ReactNode } from "react";
import { I18nProvider, type Locale } from "@/lib/i18n/i18n";
import { ThemeProvider } from "@/lib/theme/theme";
import { AuthProvider } from "@/lib/auth/session";
import { NoticeProvider, ToastProvider } from "@/components/ui";
import { DetailModalProvider } from "@/components/detail-modal";
import { useDevRefsFromUrl } from "@/lib/dev-refs";
import { ChunkRecovery } from "@/components/chunk-recovery";
import { GuideProvider } from "@/components/guide/guide";

export function Providers({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  useDevRefsFromUrl();
  return (
    <I18nProvider initial={initialLocale}>
      <ThemeProvider>
        <ToastProvider>
          <ChunkRecovery />
          <NoticeProvider><AuthProvider><GuideProvider><DetailModalProvider>{children}</DetailModalProvider></GuideProvider></AuthProvider></NoticeProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

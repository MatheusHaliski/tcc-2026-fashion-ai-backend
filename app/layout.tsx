import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { translate } from "@/lib/i18n/core";
import { DEFAULT_LOCALE, PSEUDO_LOCALE, STORAGE_KEY, detectLocale, isLocale, type Locale } from "@/lib/i18n/state";

// Tipografia oficial (docs/tipografia): editorial = Fraunces, interface = Inter, dado = IBM Plex Mono — self-hosted pelo next/font.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-editorial", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data", display: "swap" });

/** Idioma da requisição (RF23): cookie gravado pelo I18nProvider → Accept-Language do navegador → pt-BR. */
async function requestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(STORAGE_KEY)?.value;
  if (isLocale(saved)) return saved;
  return detectLocale((await headers()).get("accept-language")?.split(",")[0] ?? null) ?? DEFAULT_LOCALE;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return {
    title: { default: "Fashion AI", template: "%s · Fashion AI" },
    description: translate(locale, "meta.description"),
    icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  };
}
export const viewport: Viewport = { themeColor: "#191A19", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale === PSEUDO_LOCALE ? "pt-BR" : locale} suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}

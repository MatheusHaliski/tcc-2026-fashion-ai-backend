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
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F7F6F2" }, { media: "(prefers-color-scheme: dark)", color: "#121311" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

/** Aplica tema, redução de movimento e escala de fonte antes da primeira pintura (sem piscar claro no tema escuro). */
const THEME_BOOT = `(function(){try{var p=JSON.parse(localStorage.getItem("fai.theme")||"{}");var t=p.theme||"AUTO";var r=(p.highContrast||t==="HIGH_CONTRAST")?"contrast":t==="DARK"?"dark":t==="LIGHT"?"light":(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.dataset.theme=r;if(p.reduceMotion)d.dataset.reduceMotion="true";if(p.fontScale&&p.fontScale!==100)d.style.fontSize=p.fontScale+"%";}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;   // CSP com nonce (middleware.ts)
  return (
    <html lang={locale === PSEUDO_LOCALE ? "pt-BR" : locale} suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}

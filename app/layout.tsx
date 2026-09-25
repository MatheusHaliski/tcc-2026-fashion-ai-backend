import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { translate } from "@/lib/i18n/core";
import { DEFAULT_LOCALE, PSEUDO_LOCALE, STORAGE_KEY, detectLocale, isLocale, type Locale } from "@/lib/i18n/state";

// Tipografia oficial (docs/tipografia): editorial = Fraunces, interface = Inter, dado = IBM Plex Mono.
// Arquivos próprios em lib/design/fonts (latin, next/font/local) — next/font/google busca da rede no build e falha
// de forma intermitente na Vercel ("Cannot read properties of null (reading '1')" no @next/font/google/loader).
const fraunces = localFont({ src: "../lib/design/fonts/fraunces-variable.woff2", weight: "100 900", variable: "--font-editorial", display: "swap" });
const inter = localFont({ src: "../lib/design/fonts/inter-variable.woff2", weight: "100 900", variable: "--font-ui", display: "swap" });
const plexMono = localFont({
  src: [
    { path: "../lib/design/fonts/plexmono-400.woff2", weight: "400", style: "normal" },
    { path: "../lib/design/fonts/plexmono-500.woff2", weight: "500", style: "normal" },
    { path: "../lib/design/fonts/plexmono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-data", display: "swap",
});

/** Idioma da requisição (RF23): cookie gravado pelo I18nProvider → Accept-Language do navegador → pt-BR. */
async function requestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(STORAGE_KEY)?.value;
  if (isLocale(saved)) return saved;
  return detectLocale((await headers()).get("accept-language")?.split(",")[0] ?? null) ?? DEFAULT_LOCALE;
}

/** Gate de desenvolvedor: a página não pode revelar nada do produto (nome, descrição, ícone, textos do app). */
const isGatePage = async () => (await headers()).get("x-gate-page") === "1";
const BLANK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'/%3E";

export async function generateMetadata(): Promise<Metadata> {
  if (await isGatePage()) return { title: { absolute: "/gate" }, description: null, icons: { icon: BLANK_ICON }, robots: { index: false, follow: false } };
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
  // casca mínima no /gate: sem provedores do app (catálogos de texto, tema, sessão) nem script de tema
  if (await isGatePage()) return <html lang="en"><body className="gate-body">{children}</body></html>;
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

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Tipografia oficial (docs/tipografia): editorial = Fraunces, interface = Inter, dado = IBM Plex Mono — self-hosted pelo next/font.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-editorial", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Fashion AI", template: "%s · Fashion AI" },
  description: "Seu guarda-roupa digital com looks por IA, DNA de Estilo, Hype Score e comunidade.",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#191A19", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

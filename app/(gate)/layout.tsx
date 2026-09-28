import type { Metadata, Viewport } from "next";
import "./gate.css";

/**
 * Layout raiz próprio do gate de desenvolvedor. É separado do layout do app (app/(site)/layout.tsx) para que a tela
 * do gate não carregue nenhum pacote do produto: sem provedores, catálogos de texto, tema, fontes, nome ou ícone.
 */
const BLANK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'/%3E";

export const metadata: Metadata = {
  title: { absolute: "/gate" },
  icons: { icon: BLANK_ICON },
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
/**
 * Sempre renderizada por requisição: a CSP do middleware usa um nonce novo a cada resposta e o Next só o aplica aos
 * scripts de páginas dinâmicas. Estática (gerada no build), a página sairia sem nonce e o navegador bloquearia todos os
 * scripts (tela em branco).
 */
export const dynamic = "force-dynamic";

export default function GateRootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="gate-body">{children}</body></html>;
}

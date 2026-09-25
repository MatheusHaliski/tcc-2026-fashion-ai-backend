import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateConfig, verifyGate } from "@/lib/gate/token";

/**
 * Duas responsabilidades em toda página HTML:
 * 1. Gate de desenvolvedor: antes do lançamento público, todas as páginas (inclusive cadastro e login, RF1/RF2) exigem o
 *    cookie assinado do /gate. Ficam de fora só o próprio /gate, os arquivos do Next e os estáticos com extensão.
 *    Enquanto o gate está ligado, nada é indexado (X-Robots-Tag).
 * 2. Content-Security-Policy com nonce por requisição (OWASP A03/A05): só roda script do próprio site com o nonce; o
 *    Next aplica o nonce aos scripts dele ao ler a CSP da requisição, e o layout aplica ao script de tema.
 */
const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
const PROD = process.env.NODE_ENV === "production";

function csp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${PROD ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",                      // estilos inline do React (style={…}) e das cenas 3D
    `img-src 'self' data: blob: https: ${API}`,               // mídia do backend e logos de marca externos (https)
    "font-src 'self' data:",
    `connect-src 'self' ${API} blob: data:`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(PROD ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const cfg = await gateConfig();
  const isGate = req.nextUrl.pathname === "/gate" || req.nextUrl.pathname.startsWith("/gate/");
  const pass = isGate || !cfg.enabled || (await verifyGate(req.cookies.get(GATE_COOKIE)?.value, cfg.secret, cfg.user));
  let res: NextResponse;
  if (pass) {
    const headers = new Headers(req.headers);
    headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", policy);
    if (req.nextUrl.pathname === "/gate") headers.set("x-gate-page", "1"); else headers.delete("x-gate-page");
    res = NextResponse.next({ request: { headers } });
  } else {
    const url = req.nextUrl.clone();
    const next = req.nextUrl.pathname + req.nextUrl.search;
    url.pathname = "/gate"; url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    res = NextResponse.redirect(url);
  }
  res.headers.set("Content-Security-Policy", policy);
  if (cfg.enabled) res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  // tudo, menos os arquivos do Next e os estáticos com extensão (o /gate passa pelo middleware só para ganhar a CSP)
  matcher: ["/((?!_next/|.*\\.[A-Za-z0-9]+$).*)"],
};

import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateConfig, verifyGate } from "@/lib/gate/token";

/**
 * Duas responsabilidades em toda página HTML:
 * 1. Gate de desenvolvedor: antes do lançamento público, a tela inicial "/" É o gate (a URL não muda) e todas as outras
 *    páginas (inclusive cadastro e login, RF1/RF2) voltam para "/" até o cookie assinado existir. Ficam de fora só as
 *    rotas /gate/* (verificação, Google, status), os arquivos do Next e os estáticos com extensão. Enquanto o gate está
 *    ligado, nada é indexado (X-Robots-Tag).
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
  const path = req.nextUrl.pathname;
  const isGateRoute = path.startsWith("/gate/");               // rotas do gate (verificação, Google, status)
  const passed = !cfg.enabled || (await verifyGate(req.cookies.get(GATE_COOKIE)?.value, cfg.secret, cfg.user));
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", policy); headers.delete("x-gate-page");
  let res: NextResponse;
  if (isGateRoute || (passed && path !== "/gate")) {
    res = NextResponse.next({ request: { headers } });
  } else if (passed) {
    res = NextResponse.redirect(new URL("/", req.nextUrl.origin));  // /gate depois de entrar: volta para o app
  } else if (path === "/" || path === "/gate") {
    // a tela inicial É o gate: a URL continua "/" e a página renderizada é a do gate (casca neutra)
    headers.set("x-gate-page", "1");
    const url = req.nextUrl.clone(); url.pathname = "/gate";
    res = NextResponse.rewrite(url, { request: { headers } });
  } else {
    const url = req.nextUrl.clone();
    const next = path + req.nextUrl.search;
    url.pathname = "/"; url.search = `?next=${encodeURIComponent(next)}`;
    res = NextResponse.redirect(url);
  }
  res.headers.set("Content-Security-Policy", policy);
  if (cfg.enabled) res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  // tudo passa pelo gate, inclusive imagens e ícones de /public; ficam de fora só os pacotes do Next (/_next) e o
  // robots.txt (que manda não indexar). As rotas /gate/* entram para ganhar a CSP, mas não pedem o cookie.
  matcher: ["/((?!_next/|robots\\.txt$).*)"],
};

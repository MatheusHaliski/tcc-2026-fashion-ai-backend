import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_API_COOKIE, GATE_API_RENEW_BEFORE_SECONDS, GATE_API_TTL_SECONDS, GATE_COOKIE, apiTokenMatches, gateConfig, signApiToken, tokenExp,
  verifyCloudflareAccess, verifyGate, type GateConfig, type GateIdentity,
} from "@/lib/gate/token";

/**
 * Duas responsabilidades em toda requisição:
 * 1. Gate de desenvolvedor: antes do lançamento público, a tela inicial "/" É o gate (a URL não muda) e todas as outras
 *    páginas e arquivos (inclusive cadastro e login, RF1/RF2, e os estáticos de /public) voltam para "/" até o cookie
 *    assinado existir. A identidade de quem entrou é conferida contra a lista atual a cada requisição (revogação por
 *    pessoa). Ficam de fora só as rotas conhecidas do gate (/gate/google, /gate/verify…), os pacotes do Next e o
 *    robots.txt; qualquer outro /gate/* mostra o próprio gate. Enquanto o gate está ligado, nada é indexado.
 *    Com DEV_GATE_MODE=cloudflare quem faz o login é o Cloudflare Access; aqui só conferimos o JWT dele.
 * 2. Content-Security-Policy com nonce por requisição (OWASP A03/A05): só roda script do próprio site com o nonce; o
 *    Next aplica o nonce aos scripts dele ao ler a CSP da requisição, e o layout aplica ao script de tema.
 */
const API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
/** Origem extra de mídia (ex.: CDN do bucket quando a API não serve /media). Vazio = só o site e a API. */
const MEDIA = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "").trim().replace(/\/+$/, "");
const PROD = process.env.NODE_ENV === "production";
const GATE_ROUTES = new Set(["/gate/google", "/gate/google/callback", "/gate/status", "/gate/verify", "/gate/renew"]);

function csp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${PROD ? "" : " 'unsafe-eval'"}`,   // wasm: MediaPipe do Avatar 3D (RF40); não libera eval de JS
    "style-src 'self' 'unsafe-inline'",                      // estilos inline do React (style={…}) e das cenas 3D
    // mídia do site e do backend (logos de marca são baixados pelo backend) + fotos oficiais do catálogo (RF47): só a URL
    // https da fonte oficial é referenciada, nunca copiada — o backend valida o domínio; imagens não executam código
    `img-src 'self' data: blob: https: ${API}${MEDIA ? ` ${MEDIA}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' ${API} blob: data:`,
    `media-src 'self' blob: data:${MEDIA ? ` ${MEDIA}` : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(PROD ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

async function identityOf(req: NextRequest, cfg: GateConfig): Promise<GateIdentity | null> {
  if (cfg.mode === "cloudflare") {
    return verifyCloudflareAccess(req.headers.get("cf-access-jwt-assertion") ?? req.cookies.get("CF_Authorization")?.value, cfg);
  }
  return verifyGate("gp", req.cookies.get(GATE_COOKIE)?.value, cfg);
}

function denied(path: string, req: NextRequest, cfg: GateConfig, headers: Headers): NextResponse {
  if (path.startsWith("/bff/")) {
    return NextResponse.json({ code: "DEV_GATE", message: "gate" }, { status: 403, headers: { "X-Dev-Gate-Required": "1", "Cache-Control": "no-store" } });
  }
  if (cfg.mode === "cloudflare") {
    // sem o JWT do Access (ex.: alguém chegou pela URL da Vercel, fora do Cloudflare): nada do produto aparece
    return new NextResponse("403", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (path === "/" || path === "/gate" || path.startsWith("/gate/")) {
    // a tela inicial É o gate: a URL continua como está e a página renderizada é a do gate (layout neutro próprio)
    const url = req.nextUrl.clone(); url.pathname = "/gate"; url.search = path === "/" || path === "/gate" ? req.nextUrl.search : "";
    return NextResponse.rewrite(url, { request: { headers } });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/"; url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const cfg = await gateConfig();
  const path = req.nextUrl.pathname;
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", policy);
  const identity = cfg.enabled ? await identityOf(req, cfg) : null;
  const passed = !cfg.enabled || !!identity;

  let res: NextResponse;
  if (GATE_ROUTES.has(path) && cfg.mode === "builtin") {
    res = NextResponse.next({ request: { headers } });                  // as rotas do gate conferem tudo sozinhas
  } else if (passed && (path === "/gate" || path.startsWith("/gate/"))) {
    res = NextResponse.redirect(new URL("/", req.nextUrl.origin));      // já entrou: /gate volta para o app
  } else if (passed) {
    res = NextResponse.next({ request: { headers } });
  } else {
    res = denied(path, req, cfg, headers);
  }

  // token curto da API (X-Dev-Gate): renovado aqui enquanto a pessoa navega, com a mesma identidade e entrada
  if (identity && cfg.enabled && cfg.mode === "builtin" && cfg.secret && !GATE_ROUTES.has(path) && res.status < 300) {
    const current = req.cookies.get(GATE_API_COOKIE)?.value;
    const exp = tokenExp(current);
    if (!apiTokenMatches(cfg, current) || !exp || exp - Math.floor(Date.now() / 1000) < GATE_API_RENEW_BEFORE_SECONDS) {
      const secure = PROD && req.nextUrl.protocol === "https:";
      res.cookies.set(GATE_API_COOKIE, await signApiToken(cfg, identity.id, identity.jti), { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: GATE_API_TTL_SECONDS });
    }
  }
  res.headers.set("Content-Security-Policy", policy);
  if (cfg.enabled) res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  // tudo passa pelo gate, inclusive imagens e ícones de /public; ficam de fora só os pacotes do Next (/_next) e o
  // robots.txt (que manda não indexar). As rotas conhecidas /gate/* entram para ganhar a CSP, mas não pedem o cookie.
  matcher: ["/((?!_next/|robots\\.txt$).*)"],
};

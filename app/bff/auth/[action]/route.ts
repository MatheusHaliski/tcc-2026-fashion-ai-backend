import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_HEADER, gateConfig, hmacB64url, randomToken, signApiToken, verifyGate } from "@/lib/gate/token";

/**
 * BFF da sessão (RF1/RF2/RF3): o refresh token nunca chega ao JavaScript da página. Login, cadastro e renovação passam
 * por aqui; a rota chama a API, guarda o refresh token num cookie HttpOnly + Secure + SameSite=Strict restrito a
 * /bff/auth e devolve ao navegador só o access token (15 min, fica em memória). Um XSS deixa de conseguir uma sessão
 * persistente de 30 dias.
 *
 * - Anti-CSRF: só aceita POST da própria origem (Origin) e o cookie é SameSite=Strict.
 * - IP real: a API veria o IP do servidor da Vercel; mandamos o IP do cliente em X-Fai-Client-Ip assinado com
 *   EDGE_PROXY_SECRET (HMAC de "ip|ts"), que o ClientIpResolver do backend confere (limite por IP, auditoria, sessões).
 * - Gate: a API exige X-Dev-Gate; o middleware já validou o cookie da página, então assinamos aqui um token curto de API
 *   com a mesma identidade (ou repassamos o JWT do Cloudflare Access).
 */
const API = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").trim().replace(/\/+$/, "");
const RT_COOKIE = "fai_rt";                 // refresh token (HttpOnly)
const RT_HINT_COOKIE = "fai_rt_h";          // só "1": avisa o cliente que vale tentar renovar ao abrir o app (sem segredo)
const RT_PATH = "/bff/auth";
const MAX_BODY = 64 * 1024;
const ACTIONS = new Set(["login", "register", "refresh", "logout"]);

type Json = Record<string, unknown>;

function clientIp(req: NextRequest): string | null {
  // na Vercel, x-real-ip e x-forwarded-for são sobrescritos pela borda com o IP do cliente
  const ip = (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

async function upstreamHeaders(req: NextRequest, authorization?: string): Promise<Record<string, string>> {
  const h: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  for (const name of ["accept-language", "user-agent", "authorization", "x-correlation-id"]) {
    const v = req.headers.get(name); if (v) h[name] = v;
  }
  if (authorization) h.authorization = authorization;
  const secret = process.env.EDGE_PROXY_SECRET?.trim();
  const ip = clientIp(req);
  if (secret && secret.length >= 32 && ip) {
    const ts = String(Math.floor(Date.now() / 1000));
    Object.assign(h, { "X-Fai-Client-Ip": ip, "X-Fai-Proxy-Ts": ts, "X-Fai-Proxy-Sig": await hmacB64url(secret, `${ip}|${ts}`) });
  }
  const cfg = await gateConfig();
  if (cfg.enabled && cfg.mode === "builtin" && cfg.secret) {
    const who = await verifyGate("gp", req.cookies.get(GATE_COOKIE)?.value, cfg);
    if (who) h[GATE_HEADER] = await signApiToken(cfg, who.id, who.jti || randomToken(12), 120);
  } else if (cfg.enabled && cfg.mode === "cloudflare") {
    const jwt = req.headers.get("cf-access-jwt-assertion") ?? req.cookies.get("CF_Authorization")?.value;
    if (jwt) h["cf-access-token"] = jwt;   // o Access da API aceita o mesmo JWT por este cabeçalho
  }
  return h;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const pub = process.env.DEV_GATE_PUBLIC_URL?.trim().replace(/\/+$/, "");
  return origin === req.nextUrl.origin || (!!pub && origin === pub);
}

function secureCookie(req: NextRequest): boolean {
  return process.env.NODE_ENV === "production" || req.nextUrl.protocol === "https:";
}

function setSessionCookies(res: NextResponse, req: NextRequest, refreshToken: string, refreshExpiresAt: unknown) {
  const until = typeof refreshExpiresAt === "string" ? Date.parse(refreshExpiresAt) : NaN;
  const maxAge = Number.isFinite(until) ? Math.max(60, Math.floor((until - Date.now()) / 1000)) : 24 * 60 * 60;
  const secure = secureCookie(req);
  res.cookies.set(RT_COOKIE, refreshToken, { httpOnly: true, secure, sameSite: "strict", path: RT_PATH, maxAge });
  res.cookies.set(RT_HINT_COOKIE, "1", { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge });
}

function clearSessionCookies(res: NextResponse) {
  res.cookies.set(RT_COOKIE, "", { path: RT_PATH, maxAge: 0 });
  res.cookies.set(RT_HINT_COOKIE, "", { path: "/", maxAge: 0 });
}

async function callApi(req: NextRequest, path: string, body: Json | string | null, authorization?: string): Promise<{ status: number; data: Json | null; headers: Headers } | null> {
  try {
    const r = await fetch(`${API}${path}`, {
      method: "POST", headers: await upstreamHeaders(req, authorization), cache: "no-store",
      body: body === null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let data: Json | null = null;
    try { data = text ? (JSON.parse(text) as Json) : null; } catch { data = null; }
    return { status: r.status, data, headers: r.headers };
  } catch {
    return null;
  }
}

function reply(status: number, data: Json | null, upstream?: Headers): NextResponse {
  const res = status === 204 || data === null ? new NextResponse(null, { status: status === 200 ? 204 : status }) : NextResponse.json(data, { status });
  res.headers.set("Cache-Control", "no-store");
  for (const h of ["x-correlation-id", "x-dev-gate-required", "retry-after"]) {
    const v = upstream?.get(h); if (v) res.headers.set(h, v);
  }
  return res;
}

function offline(): NextResponse {
  return NextResponse.json({ status: 502, code: "OFFLINE", message: "API indisponível." }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

/** Tira o refresh token da resposta e o guarda no cookie HttpOnly. */
function withSession(req: NextRequest, status: number, data: Json | null, upstream: Headers): NextResponse {
  if (status >= 200 && status < 300 && data && typeof data.refreshToken === "string") {
    const { refreshToken, ...rest } = data;
    const res = reply(status, rest, upstream);
    setSessionCookies(res, req, refreshToken, data.refreshExpiresAt);
    return res;
  }
  return reply(status, data, upstream);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ status: 404, code: "NAO_ENCONTRADO" }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ status: 403, code: "ORIGEM_INVALIDA" }, { status: 403 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ status: 413, code: "CORPO_GRANDE" }, { status: 413 });

  if (action === "login" || action === "register") {
    const r = await callApi(req, `/api/auth/${action}`, raw || "{}");
    return r ? withSession(req, r.status, r.data, r.headers) : offline();
  }

  if (action === "refresh") {
    let body: Json = {};
    try { body = raw ? (JSON.parse(raw) as Json) : {}; } catch { /* corpo inválido: vale só o cookie */ }
    // migração: sessões antigas guardavam o refresh token no localStorage; o cliente manda uma única vez e apaga
    const legacy = typeof body.migrateRefreshToken === "string" ? body.migrateRefreshToken : null;
    const token = req.cookies.get(RT_COOKIE)?.value ?? legacy;
    if (!token) {
      const res = NextResponse.json({ status: 401, code: "SEM_SESSAO" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      clearSessionCookies(res);
      return res;
    }
    const r = await callApi(req, "/api/auth/refresh", { refreshToken: token });
    if (!r) return offline();
    if (r.status >= 400) {
      const res = reply(r.status === 403 ? 403 : 401, r.data ?? { status: 401, code: "SESSAO_ENCERRADA" }, r.headers);
      if (r.status !== 403) clearSessionCookies(res);   // 403 = gate da API; a sessão continua válida
      return res;
    }
    return withSession(req, r.status, r.data, r.headers);
  }

  // logout: encerra a sessão na API (pelo sid do access token) e SEMPRE apaga os cookies da sessão neste navegador —
  // inclusive com a API fora do ar ou com o access token vencido. Sem isso, um recarregar restauraria a sessão "saída"
  // pelo cookie HttpOnly (grave em aparelho compartilhado).
  let r = await callApi(req, "/api/auth/logout", null);
  const refreshToken = req.cookies.get(RT_COOKIE)?.value;
  if (r?.status === 401 && refreshToken) {
    // access token vencido: renova com o cookie e encerra a sessão na API com o token novo (a rotação já invalida o antigo)
    const renewed = await callApi(req, "/api/auth/refresh", { refreshToken });
    const access = renewed && renewed.status < 300 && typeof renewed.data?.accessToken === "string" ? renewed.data.accessToken : null;
    if (access) r = await callApi(req, "/api/auth/logout", null, `Bearer ${access}`);
  }
  // 401 aqui = a sessão já não vale na API: para quem saiu, o resultado é o mesmo de um logout bem-sucedido
  const res = !r ? offline() : r.status >= 400 && r.status !== 401 ? reply(r.status, r.data, r.headers) : reply(204, null, r.headers);
  clearSessionCookies(res);
  return res;
}

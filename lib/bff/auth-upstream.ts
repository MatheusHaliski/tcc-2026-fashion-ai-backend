import type { NextRequest } from "next/server";
import { GATE_COOKIE, GATE_HEADER, gateConfig, hmacB64url, randomToken, signApiToken, verifyGate } from "@/lib/gate/token";

/**
 * Chamada do BFF da sessão à API (servidor → servidor): repassa idioma, user-agent, Authorization e correlação do
 * navegador; manda o IP real do cliente assinado e o token do gate.
 *
 * - IP real: a API veria o IP do servidor da Vercel; mandamos o IP do cliente em X-Fai-Client-Ip assinado com
 *   EDGE_PROXY_SECRET (HMAC de "ip|ts"), que o ClientIpResolver do backend confere (limite por IP, auditoria, sessões).
 * - Gate: a API exige X-Dev-Gate; o middleware já validou o cookie da página, então assinamos aqui um token curto de API
 *   com a mesma identidade (ou repassamos o JWT do Cloudflare Access).
 */
const API = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").trim().replace(/\/+$/, "");

export type Json = Record<string, unknown>;
/** Resposta da API já lida: status, corpo JSON (ou null se vazio/não-JSON) e cabeçalhos para repasse. */
export type ApiAnswer = { status: number; data: Json | null; headers: Headers };

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

/** POST na API; `null` quando a API está fora do ar (falha de rede). */
export async function callApi(req: NextRequest, path: string, body: Json | string | null, authorization?: string): Promise<ApiAnswer | null> {
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

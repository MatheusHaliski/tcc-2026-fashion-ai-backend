import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_API_COOKIE, GATE_API_TTL_SECONDS, GATE_COOKIE, GATE_GOOGLE_COOKIE, GATE_TTL_SECONDS, gateConfig, maskIdentity,
  randomToken, safeEqual, safeNext, sha256Hex, signGate, verifyValue,
} from "@/lib/gate/token";

/**
 * Verificação do gate (2º fator): PIN conferido contra o hash do servidor, depois do 1º fator (login Google autorizado,
 * ou usuário da equipe com DEV_GATE_GOOGLE=false). Erros respondem igual para qualquer fator (não revela qual falhou),
 * com atraso fixo. Freios contra força bruta:
 * - no modo Google, cada PIN errado descarta o 1º fator: a próxima tentativa exige um novo login Google com uma conta
 *   da lista (quem não controla uma conta autorizada não chega a tentar o PIN);
 * - no máximo 8 erros por IP a cada 15 minutos (memória da instância, com limite de tamanho). Em produção, some a isso
 *   a regra de rate limit do firewall da Vercel para /gate/verify (docs/seguranca/SEGURANCA_PRODUCAO.md).
 * Sucesso grava o token da página (HttpOnly) e o token da API (curto), ambos com a identidade de quem entrou, e registra
 * a entrada no log do servidor.
 */
const WINDOW_MS = 15 * 60 * 1000; const MAX_FAILS = 8; const MAX_TRACKED_IPS = 5000;
const fails = new Map<string, { n: number; since: number }>();

function ipOf(req: NextRequest): string {
  return (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64);
}

function recordFail(ip: string, now: number) {
  const cur = fails.get(ip);
  if (!cur && fails.size >= MAX_TRACKED_IPS) {           // limite de memória: descarta a entrada mais antiga
    const oldest = fails.keys().next().value;
    if (oldest !== undefined) fails.delete(oldest);
  }
  fails.set(ip, { n: (cur?.n ?? 0) + 1, since: cur?.since ?? now });
}

export async function POST(req: NextRequest) {
  const cfg = await gateConfig();
  if (!cfg.enabled) return NextResponse.json({ ok: true, next: "/" });
  if (cfg.mode !== "builtin" || !cfg.pinHash || !cfg.secret) return NextResponse.json({ error: "GATE_NAO_CONFIGURADO" }, { status: 503 });
  const ip = ipOf(req); const now = Date.now();
  const f = fails.get(ip); if (f && now - f.since > WINDOW_MS) fails.delete(ip);
  if ((fails.get(ip)?.n ?? 0) >= MAX_FAILS) return NextResponse.json({ error: "MUITAS_TENTATIVAS" }, { status: 429, headers: { "Retry-After": "900" } });
  let body: { user?: unknown; pin?: unknown; next?: unknown } = {};
  try { body = await req.json(); } catch { /* corpo inválido conta como erro */ }
  const user = typeof body.user === "string" ? body.user.trim().slice(0, 64) : "";
  const pin = typeof body.pin === "string" ? body.pin.trim().slice(0, 64) : "";
  // 1º fator: conta Google autorizada (padrão) ou, com DEV_GATE_GOOGLE=false, o usuário da equipe
  const googleEmail = cfg.google ? await verifyValue("g1", req.cookies.get(GATE_GOOGLE_COOKIE)?.value, cfg.secret) : null;
  const identity = cfg.google
    ? (googleEmail && cfg.allowedEmails.includes(googleEmail.toLowerCase()) ? googleEmail.toLowerCase() : null)
    : (safeEqual(await sha256Hex(user.toLowerCase()), await sha256Hex(cfg.user.toLowerCase())) ? cfg.user.toLowerCase() : null);
  const okPin = safeEqual(await sha256Hex(pin), cfg.pinHash);
  if (!identity || !okPin) {
    recordFail(ip, now);
    await new Promise((r) => setTimeout(r, 600));
    const res = NextResponse.json({ error: "CREDENCIAIS_INVALIDAS" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (cfg.google) res.cookies.set(GATE_GOOGLE_COOKIE, "", { path: "/", maxAge: 0 });   // PIN errado: refaça o login Google
    return res;
  }
  fails.delete(ip);
  const jti = randomToken(12);
  const secure = process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:";
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  res.cookies.set(GATE_COOKIE, await signGate("gp", identity, jti, cfg.secret), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: GATE_TTL_SECONDS });
  // token curto só para o cabeçalho X-Dev-Gate do backend (não abre páginas; não autentica usuário: o JWT continua)
  res.cookies.set(GATE_API_COOKIE, await signGate("ga", identity, jti, cfg.secret), { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: GATE_API_TTL_SECONDS });
  res.cookies.set(GATE_GOOGLE_COOKIE, "", { path: "/", maxAge: 0 });   // 1º fator é de uso único
  res.headers.set("Cache-Control", "no-store");
  // trilha de auditoria: quem entrou, quando e de onde (logs do servidor da Vercel)
  console.info(JSON.stringify({ event: "gate.entrada", identity: maskIdentity(identity), identityHash: (await sha256Hex(identity)).slice(0, 16), jti, ip }));
  return res;
}

/** Sair do gate: apaga todos os cookies do gate neste navegador. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  for (const name of [GATE_COOKIE, GATE_API_COOKIE, GATE_GOOGLE_COOKIE, "fai_gate_h"]) res.cookies.set(name, "", { path: "/", maxAge: 0 });
  return res;
}

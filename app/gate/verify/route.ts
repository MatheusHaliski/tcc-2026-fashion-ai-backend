import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_HEADER_COOKIE, GATE_TTL_SECONDS, gateConfig, safeEqual, safeNext, sha256Hex, signGate } from "@/lib/gate/token";

/**
 * Verificação do gate: usuário + PIN conferidos contra as variáveis do servidor (o PIN só existe como hash). Erros
 * respondem igual para usuário e PIN (não revela qual errou), com atraso fixo, e cada IP tem no máximo 8 tentativas
 * erradas a cada 15 minutos. O contador fica na memória da instância: em produção, some a ele uma regra de rate limit
 * no firewall da Vercel para /gate/verify (ver docs/seguranca/SEGURANCA_PRODUCAO.md).
 */
const WINDOW_MS = 15 * 60 * 1000; const MAX_FAILS = 8;
const fails = new Map<string, { n: number; since: number }>();

function ipOf(req: NextRequest): string {
  return (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
}

export async function POST(req: NextRequest) {
  const cfg = await gateConfig();
  if (!cfg.enabled) return NextResponse.json({ ok: true, next: "/" });
  if (!cfg.pinHash || !cfg.secret) return NextResponse.json({ error: "GATE_NAO_CONFIGURADO" }, { status: 503 });
  const ip = ipOf(req); const now = Date.now();
  const f = fails.get(ip); if (f && now - f.since > WINDOW_MS) fails.delete(ip);
  if ((fails.get(ip)?.n ?? 0) >= MAX_FAILS) return NextResponse.json({ error: "MUITAS_TENTATIVAS" }, { status: 429, headers: { "Retry-After": "900" } });
  let body: { user?: unknown; pin?: unknown; next?: unknown } = {};
  try { body = await req.json(); } catch { /* corpo inválido conta como erro */ }
  const user = typeof body.user === "string" ? body.user.trim().slice(0, 64) : "";
  const pin = typeof body.pin === "string" ? body.pin.trim().slice(0, 64) : "";
  const okUser = safeEqual(await sha256Hex(user.toLowerCase()), await sha256Hex(cfg.user.toLowerCase()));
  const okPin = safeEqual(await sha256Hex(pin), cfg.pinHash);
  if (!okUser || !okPin) {
    const cur = fails.get(ip); fails.set(ip, { n: (cur?.n ?? 0) + 1, since: cur?.since ?? now });
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "CREDENCIAIS_INVALIDAS" }, { status: 401 });
  }
  fails.delete(ip);
  const token = await signGate(cfg.user, cfg.secret);
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  const secure = process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:";
  res.cookies.set(GATE_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: GATE_TTL_SECONDS });
  // cópia legível pelo cliente da API, só para o cabeçalho X-Dev-Gate do backend (não autentica usuário: o JWT continua)
  res.cookies.set(GATE_HEADER_COOKIE, token, { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: GATE_TTL_SECONDS });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, "", { path: "/", maxAge: 0 }); res.cookies.set(GATE_HEADER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

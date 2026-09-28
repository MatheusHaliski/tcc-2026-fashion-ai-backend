import { NextResponse, type NextRequest } from "next/server";
import { GATE_API_COOKIE, GATE_API_TTL_SECONDS, GATE_COOKIE, gateConfig, signApiToken, verifyGate } from "@/lib/gate/token";

/**
 * Renova o token curto da API (cookie fai_gate_a, 1 h) a partir do token da página (HttpOnly). O cliente da API chama
 * esta rota quando o backend recusa o X-Dev-Gate por validade vencida; se a pessoa saiu da lista ou o token da página
 * venceu, responde 401 e o cliente volta para o gate.
 */
export async function POST(req: NextRequest) {
  const cfg = await gateConfig();
  if (!cfg.enabled || cfg.mode !== "builtin") return NextResponse.json({ ok: true });
  if (!cfg.secret) return NextResponse.json({ error: "GATE_NAO_CONFIGURADO" }, { status: 503 });
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin && origin !== cfg.publicUrl) return NextResponse.json({ error: "ORIGEM_INVALIDA" }, { status: 403 });
  const who = await verifyGate("gp", req.cookies.get(GATE_COOKIE)?.value, cfg);
  if (!who) return NextResponse.json({ error: "GATE_EXPIRADO" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const secure = process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:";
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(GATE_API_COOKIE, await signApiToken(cfg, who.id, who.jti), { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: GATE_API_TTL_SECONDS });
  return res;
}

import { NextResponse, type NextRequest } from "next/server";
import { GATE_GOOGLE_COOKIE, GATE_OAUTH_COOKIE, gateConfig, safeEqual, signValue, verifyValue } from "@/lib/gate/token";

/**
 * Callback do login Google do gate: confere state, troca o código no servidor (segredo do cliente + PKCE), valida o
 * id_token (emissor, audiência, validade, nonce, e-mail verificado) e só aceita contas listadas em
 * DEV_GATE_ALLOWED_EMAILS. Sucesso grava o 1º fator (cookie assinado de 15 min) e volta para a tela inicial "/" pedir o PIN.
 * O id_token vem direto do endpoint de token do Google por TLS, então dispensa checar a assinatura (OIDC Core §3.1.3.7).
 */
export async function GET(req: NextRequest) {
  const cfg = await gateConfig();
  const origin = cfg.publicUrl ?? req.nextUrl.origin;
  const fail = (erro: string) => {
    const res = NextResponse.redirect(new URL(`/?erro=${erro}`, origin));
    res.cookies.set(GATE_OAUTH_COOKIE, "", { path: "/gate", maxAge: 0 });
    return res;
  };
  if (!cfg.enabled || !cfg.google || !cfg.googleClientId || !cfg.googleClientSecret || !cfg.secret) return fail("google_nao_configurado");
  const raw = await verifyValue("o1", req.cookies.get(GATE_OAUTH_COOKIE)?.value, cfg.secret);
  if (!raw) return fail("google_expirado");
  const flow = JSON.parse(raw) as { state: string; nonce: string; verifier: string; next: string };
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return fail("google_cancelado");
  if (!safeEqual(q.get("state") ?? "", flow.state) || !q.get("code")) return fail("google_invalido");
  let idToken: string | undefined;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: q.get("code")!, client_id: cfg.googleClientId, client_secret: cfg.googleClientSecret,
        redirect_uri: `${origin}/gate/google/callback`, grant_type: "authorization_code", code_verifier: flow.verifier }),
    });
    if (!r.ok) return fail("google_invalido");
    idToken = ((await r.json()) as { id_token?: string }).id_token;
  } catch { return fail("google_indisponivel"); }
  if (!idToken) return fail("google_invalido");
  let claims: { iss?: string; aud?: string; exp?: number; nonce?: string; email?: string; email_verified?: boolean | string };
  try { claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")); } catch { return fail("google_invalido"); }
  const now = Math.floor(Date.now() / 1000);
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss ?? "") || claims.aud !== cfg.googleClientId
      || !claims.exp || claims.exp < now || claims.nonce !== flow.nonce || !claims.email || !verified) return fail("google_invalido");
  const email = claims.email.toLowerCase();
  if (!cfg.allowedEmails.includes(email)) return fail("conta_nao_autorizada");
  const res = NextResponse.redirect(new URL(`/${flow.next && flow.next !== "/" ? `?next=${encodeURIComponent(flow.next)}` : ""}`, origin));
  res.cookies.set(GATE_OAUTH_COOKIE, "", { path: "/gate", maxAge: 0 });
  res.cookies.set(GATE_GOOGLE_COOKIE, await signValue("g1", email, cfg.secret, 900),
    { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 900 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

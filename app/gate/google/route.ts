import { NextResponse, type NextRequest } from "next/server";
import { GATE_OAUTH_COOKIE, gateConfig, pkceChallenge, randomToken, safeNext, signValue } from "@/lib/gate/token";

/**
 * Gate, 1º fator: inicia o login Google (OpenID Connect, fluxo de código com PKCE). state, nonce e o verificador PKCE
 * ficam num cookie HttpOnly assinado de 10 minutos; o segredo do cliente Google só é usado no servidor, no callback.
 */
export async function GET(req: NextRequest) {
  const cfg = await gateConfig();
  const back = (erro: string) => NextResponse.redirect(new URL(`/gate?erro=${erro}`, cfg.publicUrl ?? req.nextUrl.origin));
  if (!cfg.enabled) return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  if (!cfg.google || !cfg.googleClientId || !cfg.googleClientSecret || !cfg.secret) return back("google_nao_configurado");
  const origin = cfg.publicUrl ?? req.nextUrl.origin;
  const state = randomToken(24), nonce = randomToken(24), verifier = randomToken(48);
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: cfg.googleClientId, redirect_uri: `${origin}/gate/google/callback`, response_type: "code",
    scope: "openid email", state, nonce, code_challenge: await pkceChallenge(verifier), code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  const secure = origin.startsWith("https://");
  res.cookies.set(GATE_OAUTH_COOKIE, await signValue("o1", JSON.stringify({ state, nonce, verifier, next }), cfg.secret, 600),
    { httpOnly: true, secure, sameSite: "lax", path: "/gate", maxAge: 600 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

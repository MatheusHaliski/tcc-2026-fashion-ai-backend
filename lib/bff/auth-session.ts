import { NextResponse, type NextRequest } from "next/server";
import type { Json } from "./auth-upstream";

/**
 * Cookies e respostas do BFF da sessão: o refresh token vive só num cookie HttpOnly + Secure + SameSite=Strict
 * restrito a /bff/auth; a página recebe o resto do corpo (access token) e um cookie-sinal sem segredo.
 */
const RT_COOKIE = "fai_rt";                 // refresh token (HttpOnly)
const RT_HINT_COOKIE = "fai_rt_h";          // só "1": avisa o cliente que vale tentar renovar ao abrir o app (sem segredo)
const RT_PATH = "/bff/auth";

/** Refresh token guardado no cookie HttpOnly deste navegador. */
export function refreshTokenCookie(req: NextRequest): string | undefined {
  return req.cookies.get(RT_COOKIE)?.value;
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

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(RT_COOKIE, "", { path: RT_PATH, maxAge: 0 });
  res.cookies.set(RT_HINT_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Resposta sem cache que repassa correlação, aviso de gate e retry-after da API; 200 sem corpo vira 204. */
export function reply(status: number, data: Json | null, upstream?: Headers): NextResponse {
  const res = status === 204 || data === null ? new NextResponse(null, { status: status === 200 ? 204 : status }) : NextResponse.json(data, { status });
  res.headers.set("Cache-Control", "no-store");
  for (const h of ["x-correlation-id", "x-dev-gate-required", "retry-after"]) {
    const v = upstream?.get(h); if (v) res.headers.set(h, v);
  }
  return res;
}

/** Tira o refresh token da resposta e o guarda no cookie HttpOnly. */
export function withSession(req: NextRequest, status: number, data: Json | null, upstream: Headers): NextResponse {
  if (status >= 200 && status < 300 && data && typeof data.refreshToken === "string") {
    const { refreshToken, ...rest } = data;
    const res = reply(status, rest, upstream);
    setSessionCookies(res, req, refreshToken, data.refreshExpiresAt);
    return res;
  }
  return reply(status, data, upstream);
}

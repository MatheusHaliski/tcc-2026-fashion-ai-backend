import { NextResponse, type NextRequest } from "next/server";
import { callApi, type Json } from "@/lib/bff/auth-upstream";
import { clearSessionCookies, refreshTokenCookie, reply, withSession } from "@/lib/bff/auth-session";

/**
 * BFF da sessão (RF1/RF2/RF3): o refresh token nunca chega ao JavaScript da página. Login, cadastro e renovação passam
 * por aqui; a rota chama a API, guarda o refresh token num cookie HttpOnly + Secure + SameSite=Strict restrito a
 * /bff/auth e devolve ao navegador só o access token (15 min, fica em memória). Um XSS deixa de conseguir uma sessão
 * persistente de 30 dias.
 *
 * - Anti-CSRF: só aceita POST da própria origem (Origin) e o cookie é SameSite=Strict.
 * - IP real e gate: ver `lib/bff/auth-upstream.ts` (IP do cliente assinado com EDGE_PROXY_SECRET; token curto do gate).
 * - Cookies e respostas: `lib/bff/auth-session.ts`.
 *
 * Cada ação é uma estratégia da tabela `ACTIONS` (Strategy): a rota valida ação, origem e tamanho do corpo e delega.
 */
const MAX_BODY = 64 * 1024;

type ActionHandler = (req: NextRequest, raw: string) => Promise<NextResponse>;

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const pub = process.env.DEV_GATE_PUBLIC_URL?.trim().replace(/\/+$/, "");
  return origin === req.nextUrl.origin || (!!pub && origin === pub);
}

/** API fora do ar (texto fixo do servidor: o i18n:scan não varre app/bff). */
function offline(): NextResponse {
  return NextResponse.json({ status: 502, code: "OFFLINE", message: "API indisponível." }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

/** login/cadastro: repassa o corpo à API e guarda o refresh token da resposta no cookie. */
function credentials(path: string): ActionHandler {
  return async (req, raw) => {
    const r = await callApi(req, path, raw || "{}");
    return r ? withSession(req, r.status, r.data, r.headers) : offline();
  };
}

const refresh: ActionHandler = async (req, raw) => {
  let body: Json = {};
  try { body = raw ? (JSON.parse(raw) as Json) : {}; } catch { /* corpo inválido: vale só o cookie */ }
  // migração: sessões antigas guardavam o refresh token no localStorage; o cliente manda uma única vez e apaga
  const legacy = typeof body.migrateRefreshToken === "string" ? body.migrateRefreshToken : null;
  const token = refreshTokenCookie(req) ?? legacy;
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
};

/**
 * logout: encerra a sessão na API (pelo sid do access token) e SEMPRE apaga os cookies da sessão neste navegador —
 * inclusive com a API fora do ar ou com o access token vencido. Sem isso, um recarregar restauraria a sessão "saída"
 * pelo cookie HttpOnly (grave em aparelho compartilhado).
 */
const logout: ActionHandler = async (req) => {
  let r = await callApi(req, "/api/auth/logout", null);
  const refreshToken = refreshTokenCookie(req);
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
};

/** Ações aceitas; `Map` (e não objeto) para que nomes herdados como "constructor" não virem ação. */
const ACTIONS = new Map<string, ActionHandler>([
  ["login", credentials("/api/auth/login")],
  ["register", credentials("/api/auth/register")],
  ["refresh", refresh],
  ["logout", logout],
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const handle = ACTIONS.get(action);
  if (!handle) return NextResponse.json({ status: 404, code: "NAO_ENCONTRADO" }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ status: 403, code: "ORIGEM_INVALIDA" }, { status: 403 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ status: 413, code: "CORPO_GRANDE" }, { status: 413 });
  return handle(req, raw);
}

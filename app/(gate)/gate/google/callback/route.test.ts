import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { GATE_GOOGLE_COOKIE, GATE_OAUTH_COOKIE, signValue, verifyValue } from "@/lib/gate/token";

/**
 * Callback do login Google do gate: confere state, troca o código, valida o id_token e só aceita contas da lista.
 * Cada recusa volta para "/?erro=<motivo>" e apaga o cookie do fluxo.
 */
const SECRET = "c".repeat(48);
const ORIGIN = "http://localhost:3000";
const FLOW = { state: "st-1", nonce: "n-1", verifier: "v-1", next: "/feed" };

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (claims: Record<string, unknown>) => `h.${b64(claims)}.s`;
const GOOD = { iss: "https://accounts.google.com", aud: "client-1", exp: Math.floor(Date.now() / 1000) + 600, nonce: "n-1", email: "Ana@Exemplo.com", email_verified: true };

async function req(q: string, flow: unknown = FLOW) {
  const cookie = flow === null ? "" : `${GATE_OAUTH_COOKIE}=${await signValue("o1", typeof flow === "string" ? flow : JSON.stringify(flow), SECRET, 600)}`;
  return new NextRequest(`${ORIGIN}/gate/google/callback${q}`, { headers: cookie ? { cookie } : {} });
}
const tokenResponse = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
const erro = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("erro");

beforeEach(() => {
  vi.stubEnv("DEV_GATE_SECRET", SECRET);
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-1");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "segredo-1");
  vi.stubEnv("DEV_GATE_ALLOWED_EMAILS", "ana@exemplo.com");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("GET /gate/google/callback", () => {
  it("Google não configurado", async () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "");
    const res = await GET(await req("?state=st-1&code=c"));
    expect(erro(res)).toBe("google_nao_configurado");
    expect(res.headers.getSetCookie().join(";")).toMatch(new RegExp(`${GATE_OAUTH_COOKIE}=;`));
  });

  it("sem o cookie do fluxo (ou vencido): expirado", async () => {
    expect(erro(await GET(await req("?state=st-1&code=c", null)))).toBe("google_expirado");
  });

  it("cookie do fluxo com conteúdo que não é JSON: inválido", async () => {
    expect(erro(await GET(await req("?state=st-1&code=c", "não-json")))).toBe("google_invalido");
  });

  it("pessoa cancelou no Google", async () => {
    expect(erro(await GET(await req("?error=access_denied")))).toBe("google_cancelado");
  });

  it("state diferente ou sem código: inválido", async () => {
    expect(erro(await GET(await req("?state=outro&code=c")))).toBe("google_invalido");
    expect(erro(await GET(await req("?state=st-1")))).toBe("google_invalido");
  });

  it("troca de código recusada, Google fora do ar ou resposta sem id_token", async () => {
    tokenResponse({ error: "invalid_grant" }, 400);
    expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("google_invalido");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("google_indisponivel");
    tokenResponse({});
    expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("google_invalido");
  });

  it("id_token ilegível ou com declarações erradas: inválido", async () => {
    tokenResponse({ id_token: "só-um-pedaço" });
    expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("google_invalido");
    for (const bad of [{ iss: "https://evil.tld" }, { aud: "outro" }, { exp: 1 }, { nonce: "x" }, { email: undefined }, { email_verified: false }]) {
      tokenResponse({ id_token: idToken({ ...GOOD, ...bad }) });
      expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("google_invalido");
    }
  });

  it("conta fora da lista: não autorizada", async () => {
    tokenResponse({ id_token: idToken({ ...GOOD, email: "intruso@exemplo.com" }) });
    expect(erro(await GET(await req("?state=st-1&code=c")))).toBe("conta_nao_autorizada");
  });

  it("conta autorizada: troca o código com PKCE, grava o 1º fator e volta pedindo o PIN com o next", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify({ id_token: idToken({ ...GOOD, email_verified: "true", iss: "accounts.google.com" }) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(await req("?state=st-1&code=abc"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/?next=%2Ffeed`);
    const body = new URLSearchParams(String(fetchMock.mock.calls[0][1].body));
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toBe("v-1");
    const g = res.headers.getSetCookie().find((c) => c.startsWith(`${GATE_GOOGLE_COOKIE}=`))!;
    expect(await verifyValue("g1", g.split(";")[0].slice(GATE_GOOGLE_COOKIE.length + 1), SECRET)).toBe("ana@exemplo.com");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sem next (ou next = /): volta para a home sem parâmetro", async () => {
    tokenResponse({ id_token: idToken(GOOD) });
    const res = await GET(await req("?state=st-1&code=abc", { ...FLOW, next: "/" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
  });
});

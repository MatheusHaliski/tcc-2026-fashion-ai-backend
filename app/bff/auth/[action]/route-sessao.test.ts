import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { GATE_COOKIE, signGate } from "@/lib/gate/token";

/**
 * BFF da sessão — login, cadastro e renovação: o refresh token sai da resposta e vai para o cookie HttpOnly; a rota
 * repassa à API o IP assinado, o idioma e o token do gate; recusa ação desconhecida, outra origem e corpo grande.
 */
const ORIGIN = "http://localhost:3000";
const SECRET = "b".repeat(48);
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const params = (action: string) => ({ params: Promise.resolve({ action }) });

function request(action: string, opts: { body?: string; headers?: Record<string, string>; url?: string } = {}) {
  return new NextRequest(opts.url ?? `${ORIGIN}/bff/auth/${action}`, { method: "POST", headers: { origin: ORIGIN, ...opts.headers }, body: opts.body });
}
type Call = { url: string; headers: Record<string, string>; body?: string };
function upstream(...answers: (Response | (() => Response))[]) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: init.body as string | undefined });
    const a = answers.shift();
    if (!a) throw new TypeError("fetch failed");
    return typeof a === "function" ? a() : a;
  }));
  return calls;
}
const cookie = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));

beforeEach(() => { vi.stubEnv("DEV_GATE_ENABLED", "false"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /bff/auth/* — validações", () => {
  it("ação desconhecida: 404", async () => {
    const res = await POST(request("whoami"), params("whoami"));
    expect(res.status).toBe(404);
  });

  it("sem Origin vale o sec-fetch-site da própria origem; sem nenhum dos dois, 403", async () => {
    upstream(json(200, { accessToken: "a" }));
    const ok = await POST(new NextRequest(`${ORIGIN}/bff/auth/login`, { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: "{}" }), params("login"));
    expect(ok.status).toBe(200);
    const no = await POST(new NextRequest(`${ORIGIN}/bff/auth/login`, { method: "POST", body: "{}" }), params("login"));
    expect(no.status).toBe(403);
  });

  it("Origin igual à URL pública do app é aceita", async () => {
    vi.stubEnv("DEV_GATE_PUBLIC_URL", "https://app.exemplo.com/");
    upstream(json(200, { accessToken: "a" }));
    expect((await POST(request("login", { headers: { origin: "https://app.exemplo.com" }, body: "{}" }), params("login"))).status).toBe(200);
  });

  it("corpo acima de 64 KB: 413", async () => {
    const res = await POST(request("login", { body: "x".repeat(64 * 1024 + 1) }), params("login"));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "CORPO_GRANDE" });
  });
});

describe("POST /bff/auth/login e /register", () => {
  it("login certo: tira o refresh token da resposta e grava os cookies com a validade da sessão", async () => {
    const until = new Date(Date.now() + 3600 * 1000).toISOString();
    const calls = upstream(json(200, { accessToken: "acc", refreshToken: "rt-1", refreshExpiresAt: until }, { "x-correlation-id": "cid-1" }));
    const res = await POST(request("login", { body: JSON.stringify({ email: "a@x.com", password: "p" }), headers: { "accept-language": "en", "user-agent": "UA", "x-correlation-id": "cid-0" } }), params("login"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accessToken: "acc", refreshExpiresAt: until });
    expect(calls[0].url).toBe("http://localhost:8080/api/auth/login");
    expect(calls[0].body).toBe(JSON.stringify({ email: "a@x.com", password: "p" }));
    expect(calls[0].headers).toMatchObject({ "accept-language": "en", "user-agent": "UA", "x-correlation-id": "cid-0" });
    const rt = cookie(res, "fai_rt")!;
    expect(rt).toMatch(/^fai_rt=rt-1/);
    expect(rt).toMatch(/HttpOnly/i);
    expect(rt).toMatch(/Path=\/bff\/auth/);
    expect(Number(/Max-Age=(\d+)/i.exec(rt)![1])).toBeGreaterThan(3500);
    expect(cookie(res, "fai_rt_h")).toMatch(/^fai_rt_h=1/);
    expect(res.headers.get("x-correlation-id")).toBe("cid-1");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("cadastro sem corpo manda {} e, sem validade informada, o cookie dura um dia; https marca Secure", async () => {
    const calls = upstream(json(201, { accessToken: "a", refreshToken: "rt" }));
    const res = await POST(request("register", { url: "https://app.exemplo.com/bff/auth/register", headers: { origin: "https://app.exemplo.com" } }), params("register"));
    expect(res.status).toBe(201);
    expect(calls[0].body).toBe("{}");
    const rt = cookie(res, "fai_rt")!;
    expect(rt).toMatch(/Max-Age=86400/i);
    expect(rt).toMatch(/Secure/i);
  });

  it("validade já vencida vira o mínimo de 60 s", async () => {
    upstream(json(200, { accessToken: "a", refreshToken: "rt", refreshExpiresAt: "2000-01-01T00:00:00Z" }));
    expect(cookie(await POST(request("login", { body: "{}" }), params("login")), "fai_rt")).toMatch(/Max-Age=60/i);
  });

  it("erro da API é repassado sem cookies, com retry-after; resposta vazia ou não-JSON vira 204/status sem corpo", async () => {
    upstream(json(429, { code: "MUITAS_TENTATIVAS" }, { "retry-after": "30" }));
    const res = await POST(request("login", { body: "{}" }), params("login"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.getSetCookie()).toEqual([]);
    upstream(new Response("", { status: 200 }));
    expect((await POST(request("login", { body: "{}" }), params("login"))).status).toBe(204);
    upstream(new Response("<html>", { status: 500 }));
    const html = await POST(request("login", { body: "{}" }), params("login"));
    expect(html.status).toBe(500);
    expect(await html.text()).toBe("");
  });

  it("API fora do ar: 502 OFFLINE", async () => {
    upstream();
    const res = await POST(request("login", { body: "{}" }), params("login"));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "OFFLINE" });
  });

  it("com EDGE_PROXY_SECRET e IP válido manda o IP do cliente assinado; IP inválido não vai", async () => {
    vi.stubEnv("EDGE_PROXY_SECRET", "e".repeat(40));
    let calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}", headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1" } }), params("login"));
    expect(calls[0].headers["X-Fai-Client-Ip"]).toBe("200.1.2.3");
    expect(calls[0].headers["X-Fai-Proxy-Sig"]).toMatch(/^[\w-]+$/);
    calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}", headers: { "x-real-ip": "não-é-ip" } }), params("login"));
    expect(calls[0].headers["X-Fai-Client-Ip"]).toBeUndefined();
  });

  it("gate ligado: assina o token curto da API a partir do cookie da página", async () => {
    vi.stubEnv("DEV_GATE_ENABLED", "true");
    vi.stubEnv("DEV_GATE_SECRET", SECRET);
    vi.stubEnv("DEV_GATE_ALLOWED_EMAILS", "ana@exemplo.com");
    vi.stubEnv("DEV_GATE_API_TOKEN", "v2");
    const gp = await signGate("gp", "ana@exemplo.com", "j1", SECRET);
    let calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}", headers: { cookie: `${GATE_COOKIE}=${gp}` } }), params("login"));
    expect(calls[0].headers["X-Dev-Gate"]).toMatch(/^ga\./);
    calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}" }), params("login"));
    expect(calls[0].headers["X-Dev-Gate"]).toBeUndefined();
  });

  it("gate do Cloudflare: repassa o JWT do Access (cabeçalho ou cookie)", async () => {
    vi.stubEnv("DEV_GATE_ENABLED", "true");
    vi.stubEnv("DEV_GATE_MODE", "cloudflare");
    let calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}", headers: { "cf-access-jwt-assertion": "jwt-h" } }), params("login"));
    expect(calls[0].headers["cf-access-token"]).toBe("jwt-h");
    calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}", headers: { cookie: "CF_Authorization=jwt-c" } }), params("login"));
    expect(calls[0].headers["cf-access-token"]).toBe("jwt-c");
    calls = upstream(json(200, { accessToken: "a" }));
    await POST(request("login", { body: "{}" }), params("login"));
    expect(calls[0].headers["cf-access-token"]).toBeUndefined();
  });
});

describe("POST /bff/auth/refresh", () => {
  it("sem cookie nem token antigo: 401 SEM_SESSAO e apaga os cookies", async () => {
    const res = await POST(request("refresh", { body: "{não json" }), params("refresh"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "SEM_SESSAO" });
    expect(cookie(res, "fai_rt")).toMatch(/Max-Age=0/i);
  });

  it("migração do localStorage: usa o token enviado uma vez e grava o novo no cookie", async () => {
    const calls = upstream(json(200, { accessToken: "acc", refreshToken: "rt-novo" }));
    const res = await POST(request("refresh", { body: JSON.stringify({ migrateRefreshToken: "rt-velho" }) }), params("refresh"));
    expect(JSON.parse(calls[0].body!)).toEqual({ refreshToken: "rt-velho" });
    expect(await res.json()).toEqual({ accessToken: "acc" });
    expect(cookie(res, "fai_rt")).toMatch(/^fai_rt=rt-novo/);
  });

  it("cookie vence sobre o token antigo; recusa da API (401) apaga os cookies", async () => {
    const calls = upstream(json(401, { code: "SESSAO_ENCERRADA" }));
    const res = await POST(request("refresh", { body: JSON.stringify({ migrateRefreshToken: "rt-velho" }), headers: { cookie: "fai_rt=rt-cookie" } }), params("refresh"));
    expect(JSON.parse(calls[0].body!)).toEqual({ refreshToken: "rt-cookie" });
    expect(res.status).toBe(401);
    expect(cookie(res, "fai_rt")).toMatch(/Max-Age=0/i);
  });

  it("403 (gate da API) mantém a sessão; erro sem corpo vira SESSAO_ENCERRADA", async () => {
    upstream(json(403, { code: "GATE" }, { "x-dev-gate-required": "1" }));
    const res = await POST(request("refresh", { headers: { cookie: "fai_rt=rt" } }), params("refresh"));
    expect(res.status).toBe(403);
    expect(res.headers.get("x-dev-gate-required")).toBe("1");
    expect(res.headers.getSetCookie()).toEqual([]);
    upstream(new Response("", { status: 500 }));
    const r2 = await POST(request("refresh", { headers: { cookie: "fai_rt=rt" } }), params("refresh"));
    expect(r2.status).toBe(401);
    expect(await r2.json()).toMatchObject({ code: "SESSAO_ENCERRADA" });
  });

  it("API fora do ar: 502", async () => {
    upstream();
    expect((await POST(request("refresh", { headers: { cookie: "fai_rt=rt" } }), params("refresh"))).status).toBe(502);
  });
});

describe("POST /bff/auth/logout — casos de borda", () => {
  it("401 sem cookie de sessão: não tenta renovar e responde 204", async () => {
    const calls = upstream(json(401, { code: "TOKEN_EXPIRADO" }));
    const res = await POST(request("logout"), params("logout"));
    expect(res.status).toBe(204);
    expect(calls).toHaveLength(1);
  });

  it("renovação sem access token na resposta: não chama o logout de novo", async () => {
    const calls = upstream(json(401, {}), json(200, { refreshToken: "x" }));
    const res = await POST(request("logout", { headers: { cookie: "fai_rt=rt" } }), params("logout"));
    expect(res.status).toBe(204);
    expect(calls).toHaveLength(2);
  });
});

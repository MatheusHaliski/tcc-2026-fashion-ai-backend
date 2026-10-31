import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

/**
 * Caracterização do despacho por ação do BFF da sessão (R60b): nomes fora da tabela — inclusive chaves herdadas de
 * Object — dão 404 sem chamar a API; corpos de erro das validações; atributos dos dois cookies; resposta 2xx sem
 * refresh token passa como veio; o logout repassa o Authorization do navegador na primeira chamada.
 */
const ORIGIN = "http://localhost:3000";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const params = (action: string) => ({ params: Promise.resolve({ action }) });
const request = (action: string, headers: Record<string, string> = {}, body?: string) =>
  new NextRequest(`${ORIGIN}/bff/auth/${action}`, { method: "POST", headers: { origin: ORIGIN, ...headers }, body });
const cookie = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));

beforeEach(() => { vi.stubEnv("DEV_GATE_ENABLED", "false"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /bff/auth/* — tabela de ações", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "LOGIN", ""])("ação %j fora da tabela: 404 NAO_ENCONTRADO sem chamar a API", async (action) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(request(action, {}, "{}"), params(action));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: 404, code: "NAO_ENCONTRADO" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ação desconhecida responde 404 antes de checar a origem; origem errada responde 403 ORIGEM_INVALIDA", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request("whoami", { origin: "https://evil.tld" }), params("whoami"))).status).toBe(404);
    const res = await POST(request("refresh", { origin: "https://evil.tld" }), params("refresh"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: 403, code: "ORIGEM_INVALIDA" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /bff/auth/* — cookies e repasse", () => {
  it("login certo: fai_rt é HttpOnly/Strict em /bff/auth; fai_rt_h=1 é legível pela página em / (Strict)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { accessToken: "a", refreshToken: "rt" })));
    const res = await POST(request("login", {}, "{}"), params("login"));
    const rt = cookie(res, "fai_rt")!, hint = cookie(res, "fai_rt_h")!;
    expect(rt).toMatch(/HttpOnly/i);
    expect(rt).toMatch(/SameSite=Strict/i);
    expect(rt).toMatch(/Path=\/bff\/auth/);
    expect(hint).toMatch(/^fai_rt_h=1;/);
    expect(hint).not.toMatch(/HttpOnly/i);
    expect(hint).toMatch(/SameSite=Strict/i);
    expect(hint).toMatch(/Path=\/(;|$)/);
    expect(rt).not.toMatch(/Secure/i);   // http em desenvolvimento
  });

  it("2xx sem refresh token (login e refresh) passa o corpo como veio e não mexe nos cookies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { accessToken: "a", twoFactorRequired: false })));
    const login = await POST(request("login", {}, "{}"), params("login"));
    expect(await login.json()).toEqual({ accessToken: "a", twoFactorRequired: false });
    expect(login.headers.getSetCookie()).toEqual([]);
    const refresh = await POST(request("refresh", { cookie: "fai_rt=rt" }), params("refresh"));
    expect(refresh.status).toBe(200);
    expect(await refresh.json()).toEqual({ accessToken: "a", twoFactorRequired: false });
    expect(refresh.headers.getSetCookie()).toEqual([]);
  });

  it("logout: a primeira chamada leva o Authorization do navegador, sem corpo; 502 offline sai com no-store", async () => {
    const calls: { url: string; auth?: string; body: unknown; method?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, auth: (init.headers as Record<string, string>).authorization, body: init.body, method: init.method });
      throw new TypeError("fetch failed");
    }));
    const res = await POST(request("logout", { authorization: "Bearer acc", cookie: "fai_rt=rt" }), params("logout"));
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: 502, code: "OFFLINE", message: "API indisponível." });
    expect(calls).toEqual([{ url: "http://localhost:8080/api/auth/logout", auth: "Bearer acc", body: undefined, method: "POST" }]);
  });

  it("refresh sem sessão sai com no-store e apaga os dois cookies", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await POST(request("refresh"), params("refresh"));
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cookie(res, "fai_rt")).toMatch(/Max-Age=0/i);
    expect(cookie(res, "fai_rt_h")).toMatch(/Max-Age=0/i);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

/** BFF da sessão: o logout apaga os cookies da sessão em qualquer desfecho (aparelho compartilhado). */
const ORIGIN = "http://localhost:3000";

function logoutRequest(cookies = "fai_rt=rt-antigo; fai_rt_h=1") {
  return new NextRequest(`${ORIGIN}/bff/auth/logout`, {
    method: "POST", headers: { origin: ORIGIN, cookie: cookies, authorization: "Bearer access-antigo" },
  });
}
const params = { params: Promise.resolve({ action: "logout" }) };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Cookies apagados na resposta: nome → maxAge 0 e valor vazio. */
function cleared(res: Response): string[] {
  return res.headers.getSetCookie().filter((c) => /Max-Age=0/i.test(c) && /^[^=]+=;/.test(c)).map((c) => c.split("=")[0]);
}

beforeEach(() => { process.env.DEV_GATE_ENABLED = "false"; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.DEV_GATE_ENABLED; });

describe("POST /bff/auth/logout", () => {
  it("API fora do ar: responde 502 e mesmo assim apaga os cookies da sessão", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await POST(logoutRequest(), params);
    expect(res.status).toBe(502);
    expect(cleared(res)).toEqual(expect.arrayContaining(["fai_rt", "fai_rt_h"]));
  });

  it("access token vencido: renova com o cookie, encerra a sessão com o token novo e apaga os cookies", async () => {
    const calls: { url: string; auth: string | null; body: string | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, auth: headers.authorization ?? null, body: (init.body as string) ?? null });
      if (url.endsWith("/api/auth/refresh")) return json(200, { accessToken: "access-novo", refreshToken: "rt-novo" });
      return headers.authorization === "Bearer access-novo" ? new Response(null, { status: 204 }) : json(401, { code: "TOKEN_EXPIRADO" });
    }));
    const res = await POST(logoutRequest(), params);
    expect(res.status).toBe(204);
    expect(calls.map((c) => c.url.replace(/^.*\/api/, "/api"))).toEqual(["/api/auth/logout", "/api/auth/refresh", "/api/auth/logout"]);
    expect(calls[1].body).toContain("rt-antigo");
    expect(calls[2].auth).toBe("Bearer access-novo");
    expect(cleared(res)).toEqual(expect.arrayContaining(["fai_rt", "fai_rt_h"]));
    expect(res.headers.getSetCookie().join(";")).not.toContain("rt-novo");   // o refresh token novo nunca volta ao navegador
  });

  it("sessão já encerrada na API (refresh recusado): 204 e cookies apagados", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/api/auth/refresh") ? json(401, { code: "SESSAO_ENCERRADA" }) : json(401, { code: "TOKEN_EXPIRADO" }))));
    const res = await POST(logoutRequest(), params);
    expect(res.status).toBe(204);
    expect(cleared(res)).toEqual(expect.arrayContaining(["fai_rt", "fai_rt_h"]));
  });

  it("logout normal: 204 e cookies apagados; erro da API é repassado, também apagando os cookies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const ok = await POST(logoutRequest(), params);
    expect(ok.status).toBe(204);
    expect(cleared(ok)).toEqual(expect.arrayContaining(["fai_rt", "fai_rt_h"]));

    vi.stubGlobal("fetch", vi.fn(async () => json(500, { code: "ERRO" })));
    const fail = await POST(logoutRequest(), params);
    expect(fail.status).toBe(500);
    expect(cleared(fail)).toEqual(expect.arrayContaining(["fai_rt", "fai_rt_h"]));
  });

  it("recusa logout vindo de outra origem (CSRF) sem tocar nos cookies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = new NextRequest(`${ORIGIN}/bff/auth/logout`, { method: "POST", headers: { origin: "https://evil.tld", cookie: "fai_rt=rt-antigo" } });
    const res = await POST(req, params);
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

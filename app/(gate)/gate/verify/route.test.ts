import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
import { GATE_API_COOKIE, GATE_COOKIE, GATE_GOOGLE_COOKIE, sha256Hex, signValue, verifyGate, gateConfig } from "@/lib/gate/token";

/**
 * Gate, 2º fator (PIN): confere a identidade (Google ou usuário da equipe) e o PIN, responde igual para qualquer fator
 * errado, limita tentativas por IP e, no sucesso, grava os tokens da página e da API.
 */
const ORIGIN = "http://localhost:3000";
const SECRET = "s".repeat(48);
const PIN = "12345678";

function req(body: unknown, opts: { ip?: string; cookie?: string; raw?: string } = {}) {
  return new NextRequest(`${ORIGIN}/gate/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.ip ? { "x-real-ip": opts.ip } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.raw ?? JSON.stringify(body),
  });
}

/** Roda a rota avançando o relógio falso (o atraso fixo de 600 ms dos erros) até a resposta sair. */
async function run(p: Promise<Response>): Promise<Response> {
  let done = false; void p.finally(() => { done = true; });
  while (!done) { await new Promise((r) => setImmediate(r)); await vi.advanceTimersByTimeAsync(700); }
  return p;
}

const cookieValue = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0].slice(name.length + 1);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  vi.stubEnv("DEV_GATE_SECRET", SECRET);
  vi.stubEnv("DEV_GATE_PIN_HASH", await sha256Hex(PIN));
  vi.stubEnv("DEV_GATE_ALLOWED_EMAILS", "ana@exemplo.com");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("POST /gate/verify", () => {
  it("gate desligado: libera direto para a home", async () => {
    vi.stubEnv("DEV_GATE_ENABLED", "false");
    const res = await POST(req({}));
    expect(await res.json()).toEqual({ ok: true, next: "/" });
  });

  it("sem PIN ou sem segredo configurado: 503 (falha fechada)", async () => {
    vi.stubEnv("DEV_GATE_SECRET", "");
    const res = await POST(req({ pin: PIN }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "GATE_NAO_CONFIGURADO" });
  });

  it("modo Google sem o 1º fator: 401 com credenciais inválidas e descarta o cookie do Google", async () => {
    const res = await run(POST(req({ pin: PIN }, { ip: "10.0.0.1" })));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "CREDENCIAIS_INVALIDAS" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.getSetCookie().join(";")).toMatch(new RegExp(`${GATE_GOOGLE_COOKIE}=;.*Max-Age=0`, "i"));
  });

  it("modo Google com conta autorizada e PIN certo: grava os tokens da página e da API e registra a entrada", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const g = await signValue("g1", "Ana@Exemplo.com", SECRET, 900);
    const res = await run(POST(req({ pin: ` ${PIN} `, next: "/feed?x=1" }, { ip: "10.0.0.2", cookie: `${GATE_GOOGLE_COOKIE}=${g}` })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: "/feed?x=1" });
    const page = cookieValue(res, GATE_COOKIE);
    expect(await verifyGate("gp", page, await gateConfig())).toMatchObject({ id: "ana@exemplo.com" });
    expect(cookieValue(res, GATE_API_COOKIE)).toMatch(/^v1\./);
    expect(cookieValue(res, GATE_GOOGLE_COOKIE)).toBe("");
    const log = JSON.parse(String(info.mock.calls[0][0]));
    expect(log).toMatchObject({ event: "gate.entrada", identity: "an***@exemplo.com", ip: "10.0.0.2" });
  });

  it("modo Google com conta fora da lista: recusa mesmo com PIN certo", async () => {
    const g = await signValue("g1", "intruso@exemplo.com", SECRET, 900);
    const res = await run(POST(req({ pin: PIN }, { ip: "10.0.0.3", cookie: `${GATE_GOOGLE_COOKIE}=${g}` })));
    expect(res.status).toBe(401);
  });

  it("sem Google: usuário da equipe e PIN certos entram; next externo volta para a home", async () => {
    vi.stubEnv("DEV_GATE_GOOGLE", "false");
    vi.stubEnv("DEV_GATE_USER", "Equipe");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await run(POST(req({ user: " equipe ", pin: PIN, next: "https://evil.tld" }, { ip: "10.0.0.4" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: "/" });
    // sem Google, PIN errado não mexe no cookie do Google
    const bad = await run(POST(req({ user: "equipe", pin: "errado" }, { ip: "10.0.0.4" })));
    expect(bad.status).toBe(401);
    expect(cookieValue(bad, GATE_GOOGLE_COOKIE)).toBeUndefined();
  });

  it("corpo inválido e campos que não são texto contam como erro", async () => {
    vi.stubEnv("DEV_GATE_GOOGLE", "false");
    const res = await run(POST(req(null, { raw: "{não é json", ip: "10.0.0.5" })));
    expect(res.status).toBe(401);
    const res2 = await run(POST(req({ user: 1, pin: 2 }, { ip: "10.0.0.5" })));
    expect(res2.status).toBe(401);
  });

  it("depois de 8 erros no mesmo IP responde 429 com Retry-After; passada a janela, volta a aceitar tentativas", async () => {
    vi.stubEnv("DEV_GATE_GOOGLE", "false");
    vi.stubEnv("DEV_GATE_USER", "equipe");
    for (let i = 0; i < 8; i++) expect((await run(POST(req({ user: "equipe", pin: "x" }, { ip: "10.9.9.9" })))).status).toBe(401);
    const blocked = await POST(req({ user: "equipe", pin: PIN }, { ip: "10.9.9.9" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("900");
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const again = await run(POST(req({ user: "equipe", pin: PIN }, { ip: "10.9.9.9" })));
    expect(again.status).toBe(200);
  });

  it("sem cabeçalho de IP usa o primeiro do x-forwarded-for", async () => {
    vi.stubEnv("DEV_GATE_GOOGLE", "false");
    vi.stubEnv("DEV_GATE_USER", "equipe");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = new NextRequest(`${ORIGIN}/gate/verify`, { method: "POST", headers: { "x-forwarded-for": " 200.1.1.1 , 10.0.0.1" }, body: JSON.stringify({ user: "equipe", pin: PIN }) });
    await run(POST(r));
    expect(JSON.parse(String(info.mock.calls[0][0])).ip).toBe("200.1.1.1");
    const r2 = new NextRequest(`${ORIGIN}/gate/verify`, { method: "POST", body: JSON.stringify({ user: "equipe", pin: PIN }) });
    await run(POST(r2));
    expect(JSON.parse(String(info.mock.calls[1][0])).ip).toBe("local");
  });
});

describe("DELETE /gate/verify", () => {
  it("apaga todos os cookies do gate", async () => {
    const res = await DELETE();
    expect(await res.json()).toEqual({ ok: true });
    const set = res.headers.getSetCookie().map((c) => c.split("=")[0]);
    expect(set).toEqual(expect.arrayContaining([GATE_COOKIE, GATE_API_COOKIE, GATE_GOOGLE_COOKIE, "fai_gate_h"]));
  });
});

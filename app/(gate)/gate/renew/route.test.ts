import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { GATE_API_COOKIE, GATE_COOKIE, signGate } from "@/lib/gate/token";

/** Renovação do token curto da API a partir do token da página: origem conferida e identidade ainda autorizada. */
const ORIGIN = "http://localhost:3000";
const SECRET = "r".repeat(48);
const req = (headers: Record<string, string> = {}) => new NextRequest(`${ORIGIN}/gate/renew`, { method: "POST", headers });

beforeEach(() => { vi.stubEnv("DEV_GATE_SECRET", SECRET); vi.stubEnv("DEV_GATE_ALLOWED_EMAILS", "ana@exemplo.com"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("POST /gate/renew", () => {
  it("gate desligado ou no modo Cloudflare: nada a renovar", async () => {
    vi.stubEnv("DEV_GATE_ENABLED", "false");
    expect(await (await POST(req())).json()).toEqual({ ok: true });
    vi.stubEnv("DEV_GATE_ENABLED", "true"); vi.stubEnv("DEV_GATE_MODE", "cloudflare");
    expect(await (await POST(req())).json()).toEqual({ ok: true });
  });

  it("sem segredo: 503", async () => {
    vi.stubEnv("DEV_GATE_SECRET", "");
    expect((await POST(req())).status).toBe(503);
  });

  it("origem de outro site: 403", async () => {
    const res = await POST(req({ origin: "https://evil.tld" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "ORIGEM_INVALIDA" });
  });

  it("sem token da página válido: 401 e o cliente volta para o gate", async () => {
    const res = await POST(req({ origin: ORIGIN, cookie: `${GATE_COOKIE}=lixo` }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "GATE_EXPIRADO" });
  });

  it("token da página válido: grava um novo token de API no formato configurado", async () => {
    vi.stubEnv("DEV_GATE_API_TOKEN", "v2");
    vi.stubEnv("DEV_GATE_PUBLIC_URL", "https://app.exemplo.com/");
    const gp = await signGate("gp", "ana@exemplo.com", "j1", SECRET);
    const res = await POST(req({ origin: "https://app.exemplo.com", cookie: `${GATE_COOKIE}=${gp}` }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const api = res.headers.getSetCookie().find((c) => c.startsWith(`${GATE_API_COOKIE}=`))!;
    expect(api).toMatch(/^fai_gate_a=ga\./);
    expect(api).toMatch(/SameSite=strict/i);
  });
});

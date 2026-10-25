import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { GATE_OAUTH_COOKIE, verifyValue } from "@/lib/gate/token";

/** Início do login Google do gate: monta a URL do Google com PKCE e guarda state/nonce/verificador num cookie assinado. */
const SECRET = "g".repeat(48);
const req = (q = "") => new NextRequest(`http://localhost:3000/gate/google${q}`);

beforeEach(() => {
  vi.stubEnv("DEV_GATE_SECRET", SECRET);
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-1");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "segredo-1");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("GET /gate/google", () => {
  it("gate desligado: volta para a home", async () => {
    vi.stubEnv("DEV_GATE_ENABLED", "false");
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("Google sem cliente configurado: volta com erro", async () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "");
    const res = await GET(req());
    expect(res.headers.get("location")).toBe("http://localhost:3000/?erro=google_nao_configurado");
  });

  it("configurado: redireciona ao Google com PKCE e grava o fluxo no cookie (só caminho interno em next)", async () => {
    const res = await GET(req("?next=/feed"));
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("client_id")).toBe("client-1");
    expect(loc.searchParams.get("redirect_uri")).toBe("http://localhost:3000/gate/google/callback");
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${GATE_OAUTH_COOKIE}=`))!;
    expect(cookie).not.toMatch(/Secure/i);
    const flow = JSON.parse((await verifyValue("o1", cookie.split(";")[0].slice(GATE_OAUTH_COOKIE.length + 1), SECRET))!);
    expect(flow).toMatchObject({ state: loc.searchParams.get("state"), nonce: loc.searchParams.get("nonce"), next: "/feed" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("com URL pública https: usa ela no redirect e marca o cookie como Secure", async () => {
    vi.stubEnv("DEV_GATE_PUBLIC_URL", "https://app.exemplo.com");
    const res = await GET(req());
    expect(new URL(res.headers.get("location")!).searchParams.get("redirect_uri")).toBe("https://app.exemplo.com/gate/google/callback");
    expect(res.headers.getSetCookie().find((c) => c.startsWith(`${GATE_OAUTH_COOKIE}=`))).toMatch(/Secure/i);
  });
});

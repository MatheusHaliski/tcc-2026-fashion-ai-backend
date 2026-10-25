import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { GATE_GOOGLE_COOKIE, signValue } from "@/lib/gate/token";

/** Estado do gate para a tela: qual é o 1º fator e se ele já foi concluído. */
const SECRET = "t".repeat(48);
const req = (cookie?: string) => new NextRequest("http://localhost:3000/gate/status", { headers: cookie ? { cookie } : {} });

afterEach(() => { vi.unstubAllEnvs(); });

describe("GET /gate/status", () => {
  it("modo Google sem login feito: googleDone falso", async () => {
    vi.stubEnv("DEV_GATE_SECRET", SECRET);
    const res = await GET(req());
    expect(await res.json()).toEqual({ mode: "google", googleDone: false, email: null });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("modo Google com o 1º fator concluído: devolve o e-mail", async () => {
    vi.stubEnv("DEV_GATE_SECRET", SECRET);
    const g = await signValue("g1", "ana@exemplo.com", SECRET, 900);
    expect(await (await GET(req(`${GATE_GOOGLE_COOKIE}=${g}`))).json()).toEqual({ mode: "google", googleDone: true, email: "ana@exemplo.com" });
  });

  it("sem Google: modo usuário", async () => {
    vi.stubEnv("DEV_GATE_GOOGLE", "false");
    expect(await (await GET(req())).json()).toEqual({ mode: "user", googleDone: false, email: null });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

/** Indexação: com o gate ligado (padrão) nenhum buscador entra; sem gate, só as áreas privadas ficam de fora. */
afterEach(() => { vi.unstubAllEnvs(); });

describe("robots.txt", () => {
  it("gate ligado por padrão: bloqueia tudo", () => {
    vi.stubEnv("DEV_GATE_ENABLED", undefined as unknown as string);
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });

  it("gate desligado: libera o site e bloqueia admin, configurações e o gate", () => {
    vi.stubEnv("DEV_GATE_ENABLED", "FALSE");
    expect(robots()).toEqual({ rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/settings", "/gate"] }] });
  });
});

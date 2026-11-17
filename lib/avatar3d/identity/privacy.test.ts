import { describe, expect, it } from "vitest";
import { ALLOWED_LOG_KEYS, FORBIDDEN_LOG_KEYS, identityLogPayload } from "./privacy";

describe("logs da identidade do avatar sem dados pessoais", () => {
  it("nenhuma chave proibida está na lista permitida", () => {
    for (const key of FORBIDDEN_LOG_KEYS) expect(ALLOWED_LOG_KEYS.has(key)).toBe(false);
  });

  it("mantém só as chaves permitidas com valores simples", () => {
    expect(identityLogPayload({ userId: "u1", version: 3, gatePassed: true, stage: "atlas", shape: [1, 2], landmarks: "x" }))
      .toEqual({ userId: "u1", version: 3, gatePassed: true, stage: "atlas" });
  });

  it("descarta valores que parecem dado pessoal mesmo em chave permitida", () => {
    expect(identityLogPayload({
      reason: "#a1b2c3",
      source: "data:image/png;base64,AAAA",
      mode: "blob:http://x/1",
      status: "x".repeat(201),
      count: { nested: 1 },
      photos: [0.1, 0.2],
    })).toEqual({});
  });

  it("listas de texto só levam códigos curtos, no máximo 20", () => {
    const codes = Array.from({ length: 25 }, (_, i) => `AVISO_${i}`);
    const out = identityLogPayload({ warnings: [...codes, "tem espaço", "x".repeat(41)] });
    expect(out.warnings).toEqual(codes.slice(0, 20));
  });

  it("ignora nulos e indefinidos", () => {
    expect(identityLogPayload({ userId: null, identityId: undefined, ms: 120 })).toEqual({ ms: 120 });
  });
});

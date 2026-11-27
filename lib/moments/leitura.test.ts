import { describe, expect, it } from "vitest";
import { nomeDaLeitura } from "./leitura";

describe("nome da leitura do Momento (auditoria 10.1: \"LEITURA: TOTAL-DENIM\")", () => {
  it("usa o rótulo cadastrado; sem ele, a chave vira nome", () => {
    expect(nomeDaLeitura("wash-contrast", [{ key: "wash-contrast", label: "Contraste de lavagens", styleTags: [], colorTags: [] }])).toBe("Contraste de lavagens");
    expect(nomeDaLeitura("total-denim")).toBe("Total denim");
    expect(nomeDaLeitura("TOTAL_DENIM")).toBe("Total denim");
  });
});

import { describe, expect, it } from "vitest";
import { contrair } from "@/lib/flair/detetive/contracao";

describe("contração nas frases montadas do Fashion Detective (auditoria 3: \"do bolso de o segurança\")", () => {
  it("português: de + o/a vira do/da; em + o/a vira no/na", () => {
    expect(contrair("Pegar o papel do bolso de o segurança do salão", "pt-BR")).toBe("Pegar o papel do bolso do segurança do salão");
    expect(contrair("Pegar o papel do bolso de a vigia do arquivo", "pt-BR")).toBe("Pegar o papel do bolso da vigia do arquivo");
    expect(contrair("Pegar o papel do bolso de Rafa Sion", "pt-BR")).toBe("Pegar o papel do bolso de Rafa Sion");
  });

  it("espanhol: de + el vira del e a + el vira al; inglês fica como está", () => {
    expect(contrair("Convencer a el guardia del salón de dejarte pasar", "es")).toBe("Convencer al guardia del salón de dejarte pasar");
    expect(contrair("Tomar el papel del bolsillo de el guardia", "es")).toBe("Tomar el papel del bolsillo del guardia");
    expect(contrair("Take the paper from the hall guard's pocket", "en")).toBe("Take the paper from the hall guard's pocket");
  });
});

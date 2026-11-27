import { describe, expect, it } from "vitest";
import pt from "@/lib/i18n/messages/pt-BR.json";
import { lookTypeName } from "./look-type";

const messages = pt as Record<string, string>;
const t = (key: string) => messages[key] ?? key;

describe("tipo de look na tela", () => {
  it("Unisex do cadastro aparece como Unissex", () => {
    expect(lookTypeName({ codigo: "UNISEX", nome: "Unisex" }, t)).toBe("Unissex");
    expect(lookTypeName({ codigo: "FEMININO", nome: "Feminino" }, t)).toBe("Feminino");
    expect(lookTypeName({ codigo: "NOVO", nome: "Tipo novo" }, t)).toBe("Tipo novo");
  });
});

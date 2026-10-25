import { describe, expect, it } from "vitest";
import { pseudo } from "./pseudo";

describe("pseudolocalização", () => {
  it("troca letras, mantém o resto e alonga com til proporcional", () => {
    expect(pseudo("Abc 1!")).toBe("[Áƀç 1! ~]");
    expect(pseudo("abcdefghij")).toBe("[áƀçðéƒğĥíĵ ~~~]");
  });

  it("devolve intacto texto vazio, curto demais ou sem letras", () => {
    expect(pseudo("")).toBe("");
    expect(pseudo(" a ")).toBe(" a ");
    expect(pseudo("123 456")).toBe("123 456");
  });
});

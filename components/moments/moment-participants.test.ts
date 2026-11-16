/**
 * "1 participantes" (auditoria 10.1, Momentos): a contagem de participantes concorda com o número em todos os idiomas.
 */
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/core";

describe("contagem de participantes do Momento", () => {
  it("um participante no singular, vários no plural", () => {
    expect(translate("pt-BR", "moments.participants_count", { n: 1 })).toBe("1 participante");
    expect(translate("pt-BR", "moments.participants_count", { n: 10 })).toBe("10 participantes");
    expect(translate("en", "moments.participants_count", { n: 1 })).toBe("1 participant");
    expect(translate("es", "moments.participants_count", { n: 2 })).toBe("2 participantes");
  });
});

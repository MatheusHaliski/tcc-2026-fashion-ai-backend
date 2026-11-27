import { describe, expect, it } from "vitest";
import pt from "@/lib/i18n/messages/pt-BR.json";
import { aiCapabilityName, challengeName, sealStatusName } from "./dashboard-labels";

const messages = pt as Record<string, string>;
const t = (key: string) => messages[key] ?? key;

describe("Administração › nomes dos gráficos do painel", () => {
  it("estados do selo, tipos de desafio e capacidades de IA aparecem por extenso", () => {
    expect(["APPROVED", "SUGGESTED", "REVOKED", "REJECTED"].map((c) => sealStatusName(c, t))).toEqual(["Aprovado", "Sugerido", "Revogado", "Recusado"]);
    expect(challengeName("TEN_X_TEN", t)).toBe("10×10");
    expect(challengeName("GRWM", t)).toBe("Arrume-se Comigo");
    expect(aiCapabilityName("MULTI_PIECE_DETECTOR", t)).toBe("Várias peças numa foto");
  });

  it("código sem tradução cai no rótulo genérico (sem sublinhado)", () => {
    expect(challengeName("novo_desafio", t)).toBe("Novo desafio");
  });
});

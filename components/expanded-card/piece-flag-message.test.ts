import { describe, expect, it } from "vitest";
import pt from "@/lib/i18n/messages/pt-BR.json";
import type { PieceView } from "@/lib/api/types";
import { flagMessage } from "./piece-flag-message";

const messages = pt as Record<string, string>;
const t = (key: string, vars?: Record<string, unknown>) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
const piece = (over: Partial<PieceView>) => ({ name: "Saia verde", favorite: false, disponivel: true, forSale: false, forDonation: false, ...over }) as PieceView;

describe("menu da peça › retorno das marcações", () => {
  it("favoritar e desfavoritar avisam com o nome da peça", () => {
    expect(flagMessage("favorite", piece({ favorite: true }), t)).toBe("Saia verde está nas suas favoritas.");
    expect(flagMessage("favorite", piece({ favorite: false }), t)).toBe("Saia verde saiu das suas favoritas.");
  });

  it("as outras marcações também têm frase própria", () => {
    for (const field of ["disponivel", "forSale", "forDonation"] as const) {
      for (const on of [true, false]) expect(flagMessage(field, piece({ [field]: on }), t)).not.toMatch(/^pieceDetail\./);
    }
  });
});

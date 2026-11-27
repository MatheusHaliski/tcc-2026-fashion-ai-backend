import { describe, expect, it } from "vitest";
import pt from "@/lib/i18n/messages/pt-BR.json";
import { ledgerLabel } from "./ledger-label";

const messages = pt as Record<string, string>;
const t = (key: string, vars?: Record<string, unknown>) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
const modes: Record<string, string> = { RUNWAY: "Passarela" };

describe("FLAIR › extrato da carteira", () => {
  it("motivos viram frase, sem código em minúsculas", () => {
    expect(ledgerLabel("QUEST_GLOW_UP", t, (m) => modes[m])).toBe("Missão Glow up");
    expect(ledgerLabel("QUEST_SEASONAL_LOOK", t, (m) => modes[m])).toBe("Missão Look da estação");
    expect(ledgerLabel("QUEST_NOVA_MISSAO", t, (m) => modes[m])).toBe("Missão Nova missao");
    expect(ledgerLabel("MODE_RUNWAY", t, (m) => modes[m])).toBe("Partida: Passarela");
    expect(ledgerLabel("DUEL", t, (m) => modes[m])).toBe("Duelo");
  });
});

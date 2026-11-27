import { label } from "@/lib/api/taxonomy";

type Translate = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Linha do extrato da carteira FLAIR: o servidor grava o motivo como código ("QUEST_GLOW_UP", "MODE_RUNWAY", "DUEL").
 * A tela mostrava o código em minúsculas ("quest glow up"); aqui ele vira frase ("Missão Glow up", "Partida: Passarela").
 */
export function ledgerLabel(reason: string, t: Translate, modeName: (mode: string) => string | undefined): string {
  const code = reason.toUpperCase();
  const own = `flair.ledger.${code}`;
  const direct = t(own);
  if (direct !== own) return direct;
  if (code.startsWith("QUEST_")) return t("flair.ledger.quest", { name: label(code.slice(6).toLowerCase()) });
  if (code.startsWith("MODE_")) return t("flair.ledger.mode", { name: modeName(code.slice(5)) ?? label(code.slice(5).toLowerCase()) });
  return label(code.toLowerCase());
}

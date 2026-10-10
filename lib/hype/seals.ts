/**
 * RF53 — Selos de Hype FashionAI (regras de apresentação puras, sem React). Os códigos chegam prontos do backend
 * (HypeSeals.of sobre o HypeScore atual, no `summary().seals`); aqui só se decide COMO cada código aparece: qual medalhão
 * "Padrão FashionAI" (lib/seals/templates.json) e qual rótulo. Nada é salvo nem emitido por marca, e o selo nunca
 * alimenta o Hype (sem pay-to-win).
 */
import type { HypeSealCode } from "./types";

/** Prioridade do backend: VIRAL > TRENDING > EMERGING > CLASSIC > RARE. */
export const HYPE_SEAL_ORDER: HypeSealCode[] = ["VIRAL", "TRENDING", "EMERGING", "CLASSIC", "RARE"];

/** No card cabem no máximo 2 Selos de Hype; o detalhe (drawer) mostra todos. */
export const MAX_CARD_HYPE_SEALS = 2;

/**
 * Código → medalhão do tipo Padrão FashionAI (id de lib/seals/templates.json) + chave do rótulo. A arte foi escolhida
 * pelo clima de cada selo: laranja vivo (viral), turquesa em movimento (tendência), verde (emergente), cobre envelhecido
 * (clássico) e vitral (raro). O significado nunca fica só na cor: o rótulo vai no title e no nome acessível.
 */
export const HYPE_SEAL_DESIGN: Record<HypeSealCode, { template: string; labelKey: string }> = {
  VIRAL: { template: "fai/03", labelKey: "sealHype.code.VIRAL" },
  TRENDING: { template: "fai/02", labelKey: "sealHype.code.TRENDING" },
  EMERGING: { template: "fai/06", labelKey: "sealHype.code.EMERGING" },
  CLASSIC: { template: "fai/10", labelKey: "sealHype.code.CLASSIC" },
  RARE: { template: "fai/09", labelKey: "sealHype.code.RARE" },
};

export const isHypeSealCode = (c: unknown): c is HypeSealCode => typeof c === "string" && c in HYPE_SEAL_DESIGN;

/** Códigos válidos, sem repetição, na ordem de prioridade (código desconhecido de uma versão nova é ignorado). */
export function orderHypeSeals(codes?: readonly unknown[] | null): HypeSealCode[] {
  const set = new Set((codes ?? []).filter(isHypeSealCode));
  return HYPE_SEAL_ORDER.filter((c) => set.has(c));
}

/** Os Selos de Hype que aparecem no card (no máximo {@link MAX_CARD_HYPE_SEALS}). */
export const cardHypeSeals = (codes?: readonly unknown[] | null): HypeSealCode[] => orderHypeSeals(codes).slice(0, MAX_CARD_HYPE_SEALS);

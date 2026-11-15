"use client";
/** ACERVO — destaques calculados do contexto: mapa de uso, cor das peças e desejos simulados por compartimento. */
import { useCallback, useMemo } from "react";
import { useTaxonomy } from "@/lib/api/taxonomy";
import type { AcervoDesejo, AcervoPeca } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";

const COR_NEUTRA = "#9A9A93";

/** Compartimentos que guardam alguma peça parada (esquecida ou nunca usada); vazio com o mapa de uso desligado. */
export function useParados(): Set<string> {
  const { uso } = useAcervo();
  return useMemo(() => new Set((uso?.compartimentos ?? []).filter((c) => c.esquecidas + c.nuncaUsadas > 0).map((c) => c.id)), [uso]);
}

/** Peças paradas (esquecidas ou nunca usadas); vazio com o mapa de uso desligado. */
export function usePecasParadas(): Set<string> {
  const { uso } = useAcervo();
  return useMemo(() => new Set((uso?.pecas ?? []).filter((p) => p.esquecida || p.nuncaUsada).map((p) => p.id)), [uso]);
}

/** Cor (hex) da peça pela taxonomia; cinza quando a cor não é conhecida. */
export function useCorDaPeca(): (peca: Pick<AcervoPeca, "color">) => string {
  const taxonomia = useTaxonomy();
  return useCallback((peca) => {
    const hex = peca.color ? taxonomia?.colors?.[peca.color] : undefined;
    return hex && /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : COR_NEUTRA;
  }, [taxonomia]);
}

/** Desejos da simulação de compra em cada compartimento. */
export function useFantasmas(): (compartimentoId: string) => AcervoDesejo[] {
  const { dados, tela } = useAcervo();
  return useCallback(
    (compartimentoId) => dados.desejos.filter((d) => d.compartimentoId === compartimentoId && tela.simulados.includes(d.id)),
    [dados.desejos, tela.simulados],
  );
}

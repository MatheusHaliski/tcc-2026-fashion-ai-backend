"use client";
/** Textos dos elencos: nomes, requisitos do deck e o que cada peça pede, pelos catálogos de i18n (com o código de reserva). */
import { useMemo } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { ElencoRequisito, ElencoVaga, RequisitoStatus } from "@/lib/flair/elencos/types";

const CAMPO: Record<string, string> = { COR: "color", ESTILO: "style", OCASIAO: "occasion" };

export function useElencoText() {
  const tx = useNucleoText();
  return useMemo(() => {
    /** "red" → "vermelhas" (plural, para os requisitos); campo = color, style ou occasion */
    const plural = (campo: string, valor: string) => tx.ou(`flair3d.elencos.plural.${campo}.${valor}`, valor);
    return {
      ...tx,
      elenco: (codigo: string) => tx.ou(`flair3d.elencos.elenco.${codigo}.name`, codigo),
      requisito: (r: ElencoRequisito & Pick<RequisitoStatus, "ok"> & { atual?: number | string | null }, total: number) => {
        const alvo = Number(r.alvo ?? 0);
        const atual = String(r.atual ?? 0);
        const campo = CAMPO[r.tipo];
        const nivel = r.nivel ? tx.ou(`flairCard.tier.${r.nivel}`, r.nivel) : "";
        const chave = campo && alvo >= total ? `${r.tipo}_TODAS` : r.tipo;
        return tx.ou(`flair3d.elencos.req.${chave}`, `${r.tipo} ${atual}/${alvo}`, { alvo, atual, nivel, valor: campo ? plural(campo, r.valor ?? "") : "" });
      },
      /** o que a peça pede, curto: "carta vermelha", "carta de estilo moderno", "qualquer carta" */
      pede: (v: ElencoVaga) => {
        const [campo, valores] = Object.entries(v.pede ?? {})[0] ?? [];
        return campo ? tx.ou(`flair3d.elencos.pede.${campo}.${valores?.[0]}`, `${campo}: ${valores?.[0]}`) : tx.t("flair3d.elencos.pede.livre");
      },
      atributo: (a: string) => tx.t("flair3d.elencos.combina", { attr: tx.ou(`flair3d.elencos.attr.${a}`, a) }),
    };
  }, [tx]);
}

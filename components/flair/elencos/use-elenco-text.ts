"use client";
/** Textos dos elencos: códigos da API (requisitos, atributos, níveis) pelos catálogos de i18n, com o código de reserva. */
import { useMemo } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { ElencoRequisito, RequisitoStatus } from "@/lib/flair/elencos/types";

export function useElencoText() {
  const tx = useNucleoText();
  return useMemo(() => ({
    ...tx,
    elenco: (codigo: string) => tx.ou(`flair3d.elencos.elenco.${codigo}.name`, codigo),
    requisito: (r: ElencoRequisito & Pick<RequisitoStatus, "valor">) => {
      const alvo = String(r.alvo ?? "");
      const valor = String(r.valor ?? "—");
      const atributo = r.atributo ? tx.ou(`flair3d.elencos.attr.${r.atributo}`, r.atributo) : "";
      const nivel = r.nivel ? tx.ou(`flairCard.tier.${r.nivel}`, r.nivel) : "";
      const tipo = r.tipo === "SEM_LINHA_VERMELHA" && r.vaga ? "SEM_LINHA_VERMELHA_VAGA" : r.tipo;
      return tx.ou(`flair3d.elencos.req.${tipo}`, `${r.tipo} ${valor}/${alvo}`, { alvo, valor, atributo, nivel, vaga: r.vaga ?? "" });
    },
    atributo: (a: string) => tx.ou(`flair3d.elencos.attr.${a}`, a),
    atributoCurto: (a: string) => tx.ou(`flair3d.elencos.attrShort.${a}`, a.slice(0, 1)),
  }), [tx]);
}

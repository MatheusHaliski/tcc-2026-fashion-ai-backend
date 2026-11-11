"use client";
/** Textos dos elencos: códigos da API (requisitos, atributos, níveis) pelos catálogos de i18n, com o código de reserva. */
import { useMemo } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { RequisitoStatus } from "@/lib/flair/elencos/types";

export function useElencoText() {
  const tx = useNucleoText();
  return useMemo(() => ({
    ...tx,
    elenco: (codigo: string) => tx.ou(`flair3d.elencos.elenco.${codigo}.name`, codigo),
    requisito: (r: Pick<RequisitoStatus, "tipo" | "alvo" | "valor">) => {
      const alvo = r.alvo ?? "";
      const valor = r.valor ?? "—";
      return tx.ou(`flair3d.elencos.req.${r.tipo}`, `${r.tipo} ${valor}/${alvo}`, { alvo: String(alvo), valor: String(valor) });
    },
    atributo: (a: string) => tx.ou(`flair3d.elencos.attr.${a}`, a),
    atributoCurto: (a: string) => tx.ou(`flair3d.elencos.attrShort.${a}`, a.slice(0, 1)),
  }), [tx]);
}

"use client";
/**
 * Guarda o look da preparação enquanto a pessoa veste (lib/flair/nucleos/rascunho.ts): ao continuar a partida, as peças
 * voltam às vagas. Grava só na preparação; depois da entrega o servidor já tem o look.
 */
import { useEffect } from "react";
import { gravarRascunho, lerRascunho } from "@/lib/flair/nucleos/rascunho";

export { lerRascunho };

/** `vazio`: nada escolhido ainda; `encerrada`: a partida fechou. Nos dois casos o rascunho guardado sai. */
export function useRascunho(chave: string | null | undefined, ativo: boolean, valor: unknown, vazio: boolean, encerrada = false) {
  useEffect(() => {
    if (chave && (ativo || encerrada)) gravarRascunho(chave, valor, vazio || encerrada);
  }, [chave, ativo, valor, vazio, encerrada]);
}

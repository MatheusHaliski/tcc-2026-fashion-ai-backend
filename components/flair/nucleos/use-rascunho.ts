"use client";
/**
 * Guarda o look da preparação enquanto a pessoa veste (lib/flair/nucleos/rascunho.ts): ao continuar a partida, as peças
 * voltam às vagas. Grava só na preparação; depois da entrega o servidor já tem o look.
 */
import { useEffect } from "react";
import { gravarRascunho, lerRascunho } from "@/lib/flair/nucleos/rascunho";

export { lerRascunho };

/** `vazio`: nada escolhido ainda (o rascunho guardado sai). */
export function useRascunho(chave: string | null | undefined, ativo: boolean, valor: unknown, vazio: boolean) {
  useEffect(() => {
    if (chave && ativo) gravarRascunho(chave, valor, vazio);
  }, [chave, ativo, valor, vazio]);
}

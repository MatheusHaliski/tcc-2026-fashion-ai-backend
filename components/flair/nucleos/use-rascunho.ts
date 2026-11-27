"use client";
/**
 * Guarda o look da preparação enquanto a pessoa veste: no navegador, na hora (lib/flair/nucleos/rascunho.ts), e, nos
 * jogos com deck, também no servidor, pouco depois da última mudança (PUT .../partidas/{id}/rascunho). Ao continuar a
 * partida, em qualquer aparelho, as peças voltam às vagas. Grava só na preparação; depois da entrega o servidor já tem
 * o look.
 */
import { useEffect, useRef } from "react";
import { guardarRascunhoNoServidor } from "@/lib/flair/nucleos/api";
import { gravarRascunho, lerRascunho } from "@/lib/flair/nucleos/rascunho";
import type { NucleoEntrega } from "@/lib/flair/nucleos/types";

export { lerRascunho };

/** Espera depois da última mudança do look antes de mandar o rascunho ao servidor, em ms. */
export const RASCUNHO_MS = 1200;

/**
 * `vazio`: nada escolhido ainda; `encerrada`: a partida fechou. Nos dois casos o rascunho guardado no navegador sai.
 * `noServidor`: a chave é o id de uma partida aberta com deck, e o look também vai para o servidor.
 */
export function useRascunho(chave: string | null | undefined, ativo: boolean, valor: unknown, vazio: boolean, encerrada = false, noServidor = false) {
  useEffect(() => {
    if (chave && (ativo || encerrada)) gravarRascunho(chave, valor, vazio || encerrada);
  }, [chave, ativo, valor, vazio, encerrada]);

  /** o look com que a tela abriu não volta ao servidor: só o que a pessoa mudar depois */
  const inicial = useRef(valor);
  useEffect(() => {
    if (!chave || !noServidor || !ativo || valor === inicial.current) return;
    const timer = window.setTimeout(() => {
      // sem resposta do servidor o rascunho do navegador continua valendo e a linha "Salvo" não muda
      guardarRascunhoNoServidor(chave, valor as NucleoEntrega).catch(() => undefined);
    }, RASCUNHO_MS);
    return () => window.clearTimeout(timer);
  }, [chave, noServidor, ativo, valor]);
}

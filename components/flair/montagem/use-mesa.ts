"use client";
/**
 * Mesa de montagem de uma tela (elenco ou Desafio de Montagem): as cartas por vaga, com desfazer, e a montagem
 * guardada neste aparelho, para a pessoa sair e voltar sem perder o que montou. A montagem guardada só é restaurada
 * depois que as cartas da pessoa carregaram (cartas que não existem mais ficam de fora). `legado` lê uma montagem
 * guardada no formato antigo (o rascunho dos elencos), usada só quando não há montagem guardada no formato da mesa.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { desfazer, guardar, lerGuardada, limpar, MESA_VAZIA, por, tirar, type Mesa } from "@/lib/flair/montagem/mesa";

export function useMesa(chave: string, vagas: string[], cartasValidas: string[] | null, podeTrocar?: (cardId: string, vaga: string) => boolean,
  legado?: () => Record<string, string>) {
  const [mesa, setMesa] = useState<Mesa>(MESA_VAZIA);
  const restaurada = useRef(false);
  const troca = useRef(podeTrocar);
  troca.current = podeTrocar;
  const pronta = !!cartasValidas && vagas.length > 0;

  useEffect(() => {
    if (!pronta || restaurada.current) return;
    restaurada.current = true;
    const validas = new Set(cartasValidas);
    let guardada = lerGuardada(chave, vagas, validas);
    if (!Object.keys(guardada).length && legado) {
      guardada = Object.fromEntries(Object.entries(legado()).filter(([vaga, id]) => vagas.includes(vaga) && validas.has(id)));
    }
    if (Object.keys(guardada).length) setMesa({ cartas: guardada, passado: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta, chave]);

  useEffect(() => {
    if (restaurada.current) guardar(chave, mesa.cartas);
  }, [chave, mesa.cartas]);

  return {
    cartas: mesa.cartas,
    podeDesfazer: mesa.passado.length > 0,
    por: useCallback((vaga: string, cardId: string) => setMesa((m) => por(m, vaga, cardId, troca.current)), []),
    tirar: useCallback((vaga: string) => setMesa((m) => tirar(m, vaga)), []),
    limpar: useCallback(() => setMesa(limpar), []),
    desfazer: useCallback(() => setMesa(desfazer), []),
    /** depois da entrega: a montagem guardada não volta na próxima visita */
    esquecer: useCallback(() => guardar(chave, {}), [chave]),
  };
}

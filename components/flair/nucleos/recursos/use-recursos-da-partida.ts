"use client";
/**
 * Os recursos da partida (vida, energia, foco, moedas) e o uso de uma peça do deck como recurso. O medidor sobe na
 * hora (com a quantidade que o servidor já mandou no perfil da peça) e fica com o valor da resposta; se o servidor
 * recusar, volta ao que era e a recusa aparece. Cada toque leva um identificador: repetido, o servidor não gasta de novo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { buscarRecursos, usarPeca } from "@/lib/flair/recursos/api";
import type { PerfilDaPeca, Recurso, RecursosDaPartida } from "@/lib/flair/recursos/types";
import { usoOtimista, usosRestantes } from "@/lib/flair/recursos/uso";

/** Quanto tempo o "+25 Vida" fica na tela depois do uso. */
export const GANHO_MS = 1600;

export interface PecaParaUsar {
  cardId: string;
  nome: string;
  recurso: Recurso;
  quantidade: number;
  restantes: number;
}

export interface RecursosNaTela {
  estado: RecursosDaPartida | null;
  pecas: PecaParaUsar[];
  /** o último uso, para o "+25 Vida" (some depois de GANHO_MS) */
  ganho: { recurso: Recurso; quantidade: number; chave: number } | null;
  ocupado: boolean;
  erro: string | null;
  usar: (cardId: string) => void;
}

function novoPedido(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `uso-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function useRecursosDaPartida(partida: string | null | undefined, cartas: FlairCollectionCard[], perfil: (cardId: string) => PerfilDaPeca | undefined, ligado: boolean): RecursosNaTela {
  const [estado, setEstado] = useState<RecursosDaPartida | null>(null);
  const [ganho, setGanho] = useState<RecursosNaTela["ganho"]>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const contador = useRef(0);

  useEffect(() => {
    if (!partida || !ligado) return;
    const ctrl = new AbortController();
    buscarRecursos(partida, ctrl.signal).then(setEstado, () => undefined);
    return () => ctrl.abort();
  }, [partida, ligado]);

  useEffect(() => {
    if (!ganho) return;
    const t = window.setTimeout(() => setGanho(null), GANHO_MS);
    return () => window.clearTimeout(t);
  }, [ganho]);

  const usar = useCallback((cardId: string) => {
    const p = perfil(cardId);
    if (!partida || !estado || !p || ocupado || usosRestantes(estado, cardId, p) === 0) return;
    const antes = estado;
    setErro(null);
    setOcupado(true);
    setEstado(usoOtimista(antes, cardId, p));
    contador.current += 1;
    setGanho({ recurso: p.recurso, quantidade: p.quantidade, chave: contador.current });
    usarPeca(partida, cardId, novoPedido())
      .then((r) => setEstado(r))
      .catch((e: unknown) => {
        setEstado(antes);
        setGanho(null);
        setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setOcupado(false));
  }, [partida, estado, perfil, ocupado]);

  const pecas = useMemo(() => cartas.flatMap((c): PecaParaUsar[] => {
    const p = perfil(c.id);
    return p ? [{ cardId: c.id, nome: c.name, recurso: p.recurso, quantidade: p.quantidade, restantes: usosRestantes(estado, c.id, p) }] : [];
  }), [cartas, perfil, estado]);

  return { estado: ligado ? estado : null, pecas, ganho, ocupado, erro, usar };
}

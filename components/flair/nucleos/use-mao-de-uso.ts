"use client";
/**
 * A mão da fase de uso nos jogos de zonas (rodada zonas; Flair3dCartaDeUso.java): as cartas do guarda-roupa da pessoa
 * com o lance que a cor de cada uma aciona (POST .../efeitos, campo `uso`). A pessoa arma uma carta antes de chegar à
 * marca; quando a deixa abre, a carta vai no toque daquela marca (use-execucao-do-desfile.ts). Cada carta vale uma vez
 * por fase, até o máximo do servidor; a Especial (Metamorfose) volta depois da recarga. A regra é a do servidor: aqui só
 * se mostra o que ele vai aceitar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { CartaArmada } from "@/components/flair/nucleos/use-execucao-do-desfile";
import { efeitosDasCartas } from "@/lib/flair/nucleos/api";
import { assinarFx } from "@/lib/flair/nucleos/fx-events";
import { cartaDisponivel, type LancesDoPedido, type UsoDaCarta } from "@/lib/flair/nucleos/movimento/lances-de-uso";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/** Quantas cartas a mão mostra (as Especiais primeiro, depois as de mais Hype). */
export const CARTAS_NA_MAO = 6;

export interface CartaDaMao {
  id: string;
  nome: string;
  uso: UsoDaCarta;
}

function ordem(a: FlairCollectionCard, b: FlairCollectionCard): number {
  const esp = Number(b.tier === "ESPECIAL") - Number(a.tier === "ESPECIAL");
  return esp || (b.hype?.HYP ?? 0) - (a.hype?.HYP ?? 0);
}

export function useMaoDeUso(codigo: NucleoCodigo, lances: LancesDoPedido | undefined, partida?: string | null) {
  const ligado = !!lances && lances.cartasMax > 0;
  const banco = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), [ligado], { enabled: ligado });
  const ids = useMemo(() => [...(banco.data?.cards ?? [])].sort(ordem).slice(0, 24).map((c) => c.id), [banco.data]);
  const efeitos = useApi((signal) => efeitosDasCartas(codigo, ids, signal, { partida }), [codigo, ids.join(","), partida], { enabled: ligado && ids.length > 0 });
  const cartas = useMemo<CartaDaMao[]>(() => {
    const nomes = new Map((banco.data?.cards ?? []).map((c) => [c.id, c.name]));
    const usosDoServidor = new Map((efeitos.data?.efeitos ?? []).map((e) => [e.cardId, e.uso]));
    const out: CartaDaMao[] = [];
    for (const id of ids) {
      const uso = usosDoServidor.get(id);
      if (uso) out.push({ id, nome: nomes.get(id) ?? "", uso });
    }
    return out.slice(0, CARTAS_NA_MAO);
  }, [banco.data, efeitos.data, ids]);
  const [armada, setArmada] = useState<string | null>(null);
  const [usos, setUsos] = useState<Map<string, number>>(new Map());
  const ref = useRef({ armada, usos, cartas, lances });
  ref.current = { armada, usos, cartas, lances };

  // a nota da marca diz se a carta foi jogada (o toque a levou): ela sai da mão (ou entra em recarga)
  useEffect(() => assinarFx((e) => {
    if (e.nucleo !== codigo || e.tipo !== "desfile-nota" || !e.carta) return;
    const id = e.carta.id;
    setUsos((u) => new Map(u).set(id, e.marca));
    setArmada((a) => (a === id ? null : a));
  }), [codigo]);

  const disponivel = useCallback((c: CartaDaMao, marca: number) => !!lances && cartaDisponivel(lances, usos, c.id, c.uso, marca), [lances, usos]);

  /** a carta armada para a marca que abre agora, se ainda vale nela */
  const paraAMarca = useCallback((marca: number): CartaArmada | null => {
    const { armada: id, usos: u, cartas: cs, lances: l } = ref.current;
    const c = cs.find((x) => x.id === id);
    return c && l && cartaDisponivel(l, u, c.id, c.uso, marca) ? { id: c.id, uso: c.uso } : null;
  }, []);

  const armar = useCallback((id: string | null) => setArmada((a) => (a === id ? null : id)), []);
  return { cartas, armada, armar, disponivel, paraAMarca, usos };
}

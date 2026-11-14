"use client";
/**
 * Efeito de cada carta da pessoa neste núcleo (POST .../efeitos): os selos do deck, o efeito de entrada e as cartas
 * que brilham no resultado leem daqui. Enquanto o servidor não responde, `itens` devolve undefined (nada se afirma).
 */
import { useCallback, useMemo } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useApi } from "@/lib/hooks/use-api";
import { efeitosDasCartas } from "@/lib/flair/nucleos/api";
import type { EfeitoItem, NucleoCodigo } from "@/lib/flair/nucleos/types";

export function useNucleoEffects(codigo: NucleoCodigo, cartas: FlairCollectionCard[], ligado = true) {
  const ids = useMemo(() => cartas.map((c) => c.id), [cartas]);
  const chave = ids.join(",");
  const efeitos = useApi((signal) => efeitosDasCartas(codigo, ids, signal), [codigo, chave], { enabled: ligado && ids.length > 0 });
  const carregado = !!efeitos.data;
  const porCarta = useMemo(() => {
    const lista = efeitos.data?.efeitos ?? [];
    return new Map<string, EfeitoItem[]>(lista.map((e) => [e.cardId, e.itens]));
  }, [efeitos.data]);
  const itens = useCallback(
    (cardId: string): EfeitoItem[] | undefined => (carregado ? porCarta.get(cardId) ?? [] : undefined),
    [carregado, porCarta],
  );
  return { porCarta, carregado, itens };
}

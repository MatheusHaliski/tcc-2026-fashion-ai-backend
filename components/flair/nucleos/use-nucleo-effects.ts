"use client";
/**
 * Efeito de cada carta da pessoa neste núcleo (POST .../efeitos): os selos do deck, o efeito de entrada e as cartas
 * que brilham no resultado leem daqui. Com a partida aberta, os selos valem para a rodada e o sorteio dela (o tema já
 * revelado); antes, para a rodada escolhida. Enquanto o servidor não responde, `itens` devolve undefined (nada se afirma).
 */
import { useCallback, useMemo } from "react";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useApi } from "@/lib/hooks/use-api";
import { efeitosDasCartas, type OndeDosEfeitos } from "@/lib/flair/nucleos/api";
import type { EfeitoItem, NucleoCodigo } from "@/lib/flair/nucleos/types";
import type { PerfilDaPeca } from "@/lib/flair/recursos/types";
import type { AuraDaCarta } from "@/lib/flair/nucleos/aura-na-partida";

export function useNucleoEffects(codigo: NucleoCodigo, cartas: FlairCollectionCard[], ligado = true, onde: OndeDosEfeitos = {}) {
  const ids = useMemo(() => cartas.map((c) => c.id), [cartas]);
  const chave = ids.join(",");
  const { rodada = null, partida = null, vez = null } = onde;
  const efeitos = useApi((signal) => efeitosDasCartas(codigo, ids, signal, { rodada, partida }), [codigo, chave, rodada, partida, vez], { enabled: ligado && ids.length > 0 });
  const carregado = !!efeitos.data;
  const porCarta = useMemo(() => {
    const lista = efeitos.data?.efeitos ?? [];
    return new Map<string, EfeitoItem[]>(lista.map((e) => [e.cardId, e.itens]));
  }, [efeitos.data]);
  const perfis = useMemo(() => new Map((efeitos.data?.efeitos ?? []).filter((e) => e.perfil).map((e) => [e.cardId, e.perfil!])), [efeitos.data]);
  const auras = useMemo(() => new Map((efeitos.data?.efeitos ?? []).filter((e) => e.aura).map((e) => [e.cardId, e.aura!])), [efeitos.data]);
  /** a Aura da carta nos jogos com Aura na partida (família, faixa de Hype, trunfo, Metamorfose), quando o servidor mandou */
  const aura = useCallback((cardId: string): AuraDaCarta | undefined => auras.get(cardId), [auras]);
  /** o perfil peça-recurso da carta (atributos, recurso do uso, ações destravadas), quando o servidor mandou */
  const perfil = useCallback((cardId: string): PerfilDaPeca | undefined => perfis.get(cardId), [perfis]);
  const itens = useCallback(
    (cardId: string): EfeitoItem[] | undefined => (carregado ? porCarta.get(cardId) ?? [] : undefined),
    [carregado, porCarta],
  );
  return { porCarta, carregado, itens, perfil, aura };
}

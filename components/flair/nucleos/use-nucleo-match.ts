"use client";
/**
 * Partida de um núcleo: definição (API, completada pelo arquivo do núcleo), banco de cartas da pessoa, abertura com o
 * deck e entrega. Núcleo sem deck abre a partida só na hora de entregar (nenhuma partida fica aberta à toa).
 */
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { abrirPartida, buscarNucleo, entregarPartida } from "@/lib/flair/nucleos/api";
import { mesclarDefinicao } from "@/lib/flair/nucleos/registry";
import { toEntrega, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoCodigo, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

export function useNucleoMatch(codigo: NucleoCodigo) {
  const def = useApi((signal) => buscarNucleo(codigo, signal), [codigo]);
  const definicao = useMemo(() => mesclarDefinicao(codigo, def.data), [codigo, def.data]);
  const usaCartas = definicao.recursos.includes("CARTAS");
  const semDeck = !usaCartas || !!definicao.deck?.semDeck;
  const aceitaModelo = !!definicao.avatares?.solo.some((a) => a.tipo === "MODELO_CASA");
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), [usaCartas], { enabled: usaCartas });
  const [partida, setPartida] = useState<NucleoPartida | null>(null);
  const [deck, setDeck] = useState<string[] | null>(null);
  const [resultado, setResultado] = useState<NucleoResultado | null>(null);

  const abrir = useAction(async (escolhido: string[]) => {
    const p = await abrirPartida(codigo, escolhido);
    setPartida(p);
    setDeck(escolhido);
    return p;
  });

  const entrega = useAction(async (sel: Selecao, avatar: AvatarTipo) => {
    const p = partida ?? (await abrirPartida(codigo, deck ?? [], aceitaModelo && avatar === "MODELO_CASA" ? avatar : null));
    setPartida(p);
    const r = await entregarPartida(p.id, toEntrega(sel));
    setResultado(r);
    return r;
  });

  const todas = useMemo(() => bank.data?.cards ?? [], [bank.data]);
  const cartasDaPartida = useMemo(() => (semDeck || !deck ? todas : todas.filter((c) => deck.includes(c.id))), [semDeck, deck, todas]);

  /** de volta ao começo (nova partida com outro deck) */
  const reiniciar = () => {
    setPartida(null);
    setDeck(null);
    setResultado(null);
  };

  return {
    definicao,
    definicaoErro: def.error,
    carregando: def.loading && !def.data,
    banco: bank,
    todas,
    cartasDaPartida,
    semDeck,
    precisaDeck: !semDeck && !partida,
    partida,
    resultado,
    entrar: abrir.run,
    entrando: abrir.busy,
    erroEntrar: abrir.error,
    entregar: entrega.run,
    entregando: entrega.busy,
    erroEntrega: entrega.error,
    reiniciar,
  };
}

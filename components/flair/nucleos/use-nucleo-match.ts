"use client";
/**
 * Partida de um núcleo: definição (API, completada pelo arquivo do núcleo), banco de cartas da pessoa, abertura com o
 * deck, entrega e acionamento. Núcleo sem deck abre a partida na primeira prévia da preparação (a prévia precisa de uma
 * partida aberta) ou, sem prévia, na hora de entregar; quem só olha a tela não abre partida nenhuma.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { abrirPartida, acionarPartida, buscarNucleo, entregarPartida } from "@/lib/flair/nucleos/api";
import { mesclarDefinicao } from "@/lib/flair/nucleos/registry";
import { toEntrega, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoAcionamento, NucleoCodigo, NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

/** O que a pessoa acionou na janela da ação: a carta Especial (só `cardId`) ou a troca (`vaga` e `cardId`); vazio = seguir. */
export interface AcionamentoDaPessoa {
  cardId?: string;
  vaga?: string;
}

function corpoDoAcionamento({ cardId, vaga }: AcionamentoDaPessoa): NucleoAcionamento {
  if (cardId && vaga) return { troca: { vaga, carta: cardId } };
  return cardId ? { carta: cardId } : {};
}

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
  /** última apresentação que não fechou a partida (LABIRINTO: o espelho não abriu) */
  const [tentativa, setTentativa] = useState<NucleoResultado | null>(null);
  /** abertura em curso ou feita nos núcleos sem deck, pela escolha de avatar com que a partida foi aberta */
  const abertura = useRef<{ chave: string; promessa: Promise<NucleoPartida> } | null>(null);

  const abrir = useAction(async (escolhido: string[]) => {
    const p = await abrirPartida(codigo, escolhido);
    setPartida(p);
    setDeck(escolhido);
    return p;
  });

  /** A partida aberta: a do deck ou, nos núcleos sem deck, uma só por escolha de avatar (prévia e entrega dividem a mesma). */
  const garantirPartida = useCallback(
    (avatar: AvatarTipo): Promise<NucleoPartida | null> => {
      if (!semDeck) return Promise.resolve(partida);
      const modelo = aceitaModelo && avatar === "MODELO_CASA" ? avatar : null;
      const chave = modelo ?? "";
      if (abertura.current?.chave === chave) return abertura.current.promessa;
      const promessa = abrirPartida(codigo, [], modelo).then((p) => {
        setPartida(p);
        return p;
      });
      abertura.current = { chave, promessa };
      promessa.catch(() => {
        if (abertura.current?.promessa === promessa) abertura.current = null;
      });
      return promessa;
    },
    [semDeck, partida, aceitaModelo, codigo],
  );

  const entrega = useAction(async (sel: Selecao, avatar: AvatarTipo) => {
    const p = await garantirPartida(avatar);
    if (!p) return undefined;
    const r = await entregarPartida(p.id, toEntrega(sel));
    setResultado(r);
    return r;
  });

  /** Avança a partida EM_ACAO, com a carta Especial ou a troca quando a pessoa aciona; a resposta vira o resultado. */
  const acionamento = useAction(async (pedido: AcionamentoDaPessoa) => {
    if (!partida) return undefined;
    const r = await acionarPartida(partida.id, corpoDoAcionamento(pedido));
    setResultado(r);
    return r;
  });

  /** A partida segue ABERTA depois da entrega (LABIRINTO): guarda a tentativa e libera a preparação de novo. */
  const retomar = () => {
    setTentativa(resultado);
    setResultado(null);
  };

  const todas = useMemo(() => bank.data?.cards ?? [], [bank.data]);
  const cartasDaPartida = useMemo(() => (semDeck || !deck ? todas : todas.filter((c) => deck.includes(c.id))), [semDeck, deck, todas]);

  /** de volta ao começo (nova partida com outro deck) */
  const reiniciar = () => {
    setPartida(null);
    setDeck(null);
    setResultado(null);
    setTentativa(null);
    abertura.current = null;
    acionamento.setError(null);
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
    tentativa,
    garantirPartida,
    retomar,
    acionar: acionamento.run,
    acionando: acionamento.busy,
    erroAcionar: acionamento.error,
    entrar: abrir.run,
    entrando: abrir.busy,
    erroEntrar: abrir.error,
    entregar: entrega.run,
    entregando: entrega.busy,
    erroEntrega: entrega.error,
    reiniciar,
  };
}

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
import { acionarPartida, buscarNucleo, entregarPartida } from "@/lib/flair/nucleos/api";
import { abridorDaPartida } from "@/lib/flair/multi/abertura";
import { mesclarDefinicao } from "@/lib/flair/nucleos/registry";
import { definicaoDaRodada, temRodadas } from "@/lib/flair/nucleos/rodadas";
import { toEntrega, type Selecao } from "@/lib/flair/nucleos/selection";
import { corpoDoAcionamento, type AcionamentoDaPessoa } from "@/lib/flair/nucleos/acionamento";
import type { AvatarTipo, NucleoCodigo, NucleoPartida, NucleoResultado, NucleoRetomada } from "@/lib/flair/nucleos/types";

export type { AcionamentoDaPessoa };

/** `salaId`: a sala multiplayer com a mesma semente (?sala=); a partida abre por ela. */
export function useNucleoMatch(codigo: NucleoCodigo, salaId: string | null = null) {
  const abrirPartida = useMemo(() => abridorDaPartida(codigo, salaId), [codigo, salaId]);
  const def = useApi((signal) => buscarNucleo(codigo, signal), [codigo]);
  /** a rodada escolhida antes de entrar (jogo sem rodadas para escolher: null, vale o objetivo da definição) */
  const [rodada, setRodada] = useState<string | null>(null);
  const inteira = useMemo(() => mesclarDefinicao(codigo, def.data), [codigo, def.data]);
  const definicao = useMemo(() => definicaoDaRodada(inteira, rodada), [inteira, rodada]);
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
    const p = await abrirPartida(escolhido, null, rodada);
    setPartida(p);
    setDeck(escolhido);
    return p;
  });

  /** A partida aberta: a do deck ou, nos núcleos sem deck, uma só por escolha de avatar (prévia e entrega dividem a mesma). */
  const garantirPartida = useCallback(
    (avatar: AvatarTipo): Promise<NucleoPartida | null> => {
      if (!semDeck) return Promise.resolve(partida);
      const modelo = aceitaModelo && avatar === "MODELO_CASA" ? avatar : null;
      const chave = `${modelo ?? ""}:${rodada ?? ""}`;
      if (abertura.current?.chave === chave) return abertura.current.promessa;
      const promessa = abrirPartida([], modelo, rodada).then((p) => {
        setPartida(p);
        return p;
      });
      abertura.current = { chave, promessa };
      promessa.catch(() => {
        if (abertura.current?.promessa === promessa) abertura.current = null;
      });
      return promessa;
    },
    [semDeck, partida, aceitaModelo, abrirPartida, rodada],
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

  /** "Continuar partida": a partida que ficou aberta volta com o deck, o look vestido e o ponto em que parou */
  const continuar = (r: NucleoRetomada) => {
    const p = { ...r.partida, vestidas: r.vestidas, rascunho: r.rascunho };
    const modelo = p.participantes?.some((x) => x.tipo === "MODELO_CASA") ? "MODELO_CASA" : "";
    abertura.current = { chave: `${modelo}:${p.rodada ?? ""}`, promessa: Promise.resolve(p) };
    setRodada(p.rodada ?? null);
    setPartida(p);
    setDeck(p.deck ?? []);
    setResultado(r.resultado);
    setTentativa(r.tentativa);
  };

  /** de volta ao começo (nova partida com outro deck) */
  const reiniciar = () => {
    setPartida(null);
    setDeck(null);
    setResultado(null);
    setTentativa(null);
    setRodada(null);
    abertura.current = null;
    acionamento.setError(null);
  };

  return {
    definicao,
    inteira,
    rodada,
    escolherRodada: setRodada,
    precisaRodada: temRodadas(inteira) && !rodada,
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
    continuar,
  };
}

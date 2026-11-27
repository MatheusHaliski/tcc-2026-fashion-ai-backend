"use client";
/**
 * Um elenco em quebra-cabeça: formação (API, completada pela formação local), cartas da pessoa, a mesa (cartas por
 * vaga, com desfazer e guardada neste aparelho), a conferência no servidor a cada mudança (/conferir) e a entrega com a
 * edição. Quando a conferência diz que o deck inteiro encaixou, a entrega sai sozinha (uma vez por montagem): é o
 * quebra-cabeça se completando. A conferência guarda as cartas que julgou: peça com carta diferente ainda está sendo
 * conferida.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { useMesa } from "@/components/flair/montagem/use-mesa";
import { buscarElenco, conferirElenco, entregarElenco } from "@/lib/flair/elencos/api";
import { mesclarElenco } from "@/lib/flair/elencos/formacoes";
import type { ElencoConferencia, ElencoEntregaResultado } from "@/lib/flair/elencos/types";

type Conferida = ElencoConferencia & { de: Record<string, string> };

export function useElenco(codigo: string) {
  const def = useApi((signal) => buscarElenco(codigo, signal), [codigo]);
  const elenco = useMemo(() => mesclarElenco(codigo, def.data), [codigo, def.data]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const banco = useMemo(() => bank.data?.cards ?? [], [bank.data]);
  const chaves = useMemo(() => (elenco?.vagas ?? []).map((v) => v.chave), [elenco]);
  const ids = useMemo(() => (bank.data ? banco.map((c) => c.id) : null), [bank.data, banco]);
  const mesa = useMesa(`elenco.${codigo}`, chaves, ids, () => true);
  const cartas = mesa.cartas;
  const chave = JSON.stringify(cartas);
  const temCartas = Object.keys(cartas).length > 0;
  const conf = useApi<Conferida>(async (signal) => ({ ...(await conferirElenco(codigo, cartas, signal)), de: cartas }), [codigo, chave], { enabled: temCartas });
  const [resultado, setResultado] = useState<(ElencoEntregaResultado & { de: Record<string, string> }) | null>(null);
  const entrega = useAction(async () => {
    const r = await entregarElenco(codigo, cartas);
    setResultado({ ...r, de: cartas });
    if (r.ok) mesa.esquecer();
    return r;
  });
  const mudar = <A extends unknown[]>(jogada: (...args: A) => void) => (...args: A) => {
    setResultado(null);
    jogada(...args);
  };
  const conferencia = temCartas ? resultado ?? conf.data : resultado;
  const fresca = !!conf.data && JSON.stringify(conf.data.de) === chave;
  // o deck inteiro encaixou: entrega uma vez por montagem (um erro não repete sozinho; o botão continua lá)
  const tentada = useRef("");
  useEffect(() => {
    if (!conf.data?.ok || !fresca || resultado || entrega.busy || tentada.current === chave) return;
    tentada.current = chave;
    void entrega.run();
  }, [conf.data, fresca, resultado, entrega, chave]);
  return {
    elenco,
    offline: !!def.error,
    carregando: def.loading && !def.data,
    banco,
    carregandoCartas: bank.loading && !bank.data,
    cartas,
    conferencia,
    /** as cartas que a conferência julgou */
    conferidas: conferencia ? resultado?.de ?? conf.data?.de ?? {} : {},
    conferindo: conf.loading,
    erroConferir: temCartas ? conf.error : null,
    por: mudar(mesa.por),
    tirar: mudar(mesa.tirar),
    desfazer: mudar(mesa.desfazer),
    podeDesfazer: mesa.podeDesfazer,
    resultado,
    entregar: entrega.run,
    entregando: entrega.busy,
    erroEntrega: entrega.error,
  };
}

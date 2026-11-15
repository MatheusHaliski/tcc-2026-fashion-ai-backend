"use client";
/**
 * Um elenco do FLAIR Card Building Challenge: formação (API, completada pela formação local), cartas da pessoa, a mesa
 * (cartas por vaga, com desfazer e guardada neste aparelho), a conferência no servidor a cada mudança (/conferir) e a
 * entrega com a edição. A conferência guarda as cartas que julgou: linha com carta diferente ainda está sendo conferida.
 */
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { useMesa } from "@/components/flair/montagem/use-mesa";
import { buscarElenco, conferirElenco, entregarElenco } from "@/lib/flair/elencos/api";
import { mesclarElenco } from "@/lib/flair/elencos/formacoes";
import type { ElencoConferencia, ElencoEntregaResultado } from "@/lib/flair/elencos/types";
import { gravarRascunho, lerRascunho } from "@/lib/flair/elencos/rascunho";

type Conferida = ElencoConferencia & { de: Record<string, string> };

export function useElenco(codigo: string) {
  const def = useApi((signal) => buscarElenco(codigo, signal), [codigo]);
  const elenco = useMemo(() => mesclarElenco(codigo, def.data), [codigo, def.data]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const banco = useMemo(() => bank.data?.cards ?? [], [bank.data]);
  const chaves = useMemo(() => (elenco?.vagas ?? []).map((v) => v.chave), [elenco]);
  const ids = useMemo(() => (bank.data ? banco.map((c) => c.id) : null), [bank.data, banco]);
  const cabe = (cardId: string, vaga: string) => banco.find((c) => c.id === cardId)?.position === elenco?.vagas.find((v) => v.chave === vaga)?.posicao;
  // o elenco em montagem volta ao recarregar (a mesa guarda); um rascunho do formato anterior é lido uma vez e apagado
  const legado = () => {
    const rascunho = lerRascunho(codigo);
    gravarRascunho(codigo, {});
    return rascunho;
  };
  const mesa = useMesa(`elenco.${codigo}`, chaves, ids, cabe, legado);
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
  const conferencia = temCartas ? resultado ?? conf.data : null;

  return {
    elenco,
    offline: !!def.error,
    carregando: def.loading && !def.data,
    banco,
    carregandoCartas: bank.loading && !bank.data,
    cartas,
    conferencia,
    /** as cartas que a conferência julgou */
    conferidas: conferencia?.de ?? {},
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

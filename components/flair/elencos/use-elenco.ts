"use client";
/**
 * Um elenco do FLAIR Card Building Challenge: formação (API, completada pela formação local), cartas da pessoa, as
 * cartas postas por vaga, a conferência no servidor a cada mudança (/conferir) e a entrega com a edição.
 */
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { buscarElenco, conferirElenco, entregarElenco } from "@/lib/flair/elencos/api";
import { mesclarElenco } from "@/lib/flair/elencos/formacoes";
import type { ElencoEntregaResultado } from "@/lib/flair/elencos/types";

export function useElenco(codigo: string) {
  const def = useApi((signal) => buscarElenco(codigo, signal), [codigo]);
  const elenco = useMemo(() => mesclarElenco(codigo, def.data), [codigo, def.data]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const [cartas, setCartas] = useState<Record<string, string>>({});
  const chave = JSON.stringify(cartas);
  const temCartas = Object.keys(cartas).length > 0;
  const conf = useApi((signal) => conferirElenco(codigo, cartas, signal), [codigo, chave], { enabled: temCartas });
  const [resultado, setResultado] = useState<ElencoEntregaResultado | null>(null);
  const entrega = useAction(async () => {
    const r = await entregarElenco(codigo, cartas);
    setResultado(r);
    return r;
  });

  const por = (vaga: string, cardId: string) => {
    setResultado(null);
    setCartas((c) => {
      const semRepetir = Object.fromEntries(Object.entries(c).filter(([, id]) => id !== cardId));
      return { ...semRepetir, [vaga]: cardId };
    });
  };
  const tirar = (vaga: string) => {
    setResultado(null);
    setCartas((c) => {
      const copia = { ...c };
      delete copia[vaga];
      return copia;
    });
  };

  return {
    elenco,
    offline: !!def.error,
    carregando: def.loading && !def.data,
    banco: bank.data?.cards ?? [],
    carregandoCartas: bank.loading && !bank.data,
    cartas,
    conferencia: temCartas ? resultado ?? conf.data : null,
    conferindo: conf.loading,
    erroConferir: temCartas ? conf.error : null,
    por,
    tirar,
    resultado,
    entregar: entrega.run,
    entregando: entrega.busy,
    erroEntrega: entrega.error,
  };
}

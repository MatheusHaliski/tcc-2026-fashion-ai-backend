"use client";
/**
 * Um brief do FLAIR 3D MAKE UP: definição (API, completada pelos briefs locais), cartas do guarda-roupa da pessoa e a
 * entrega com o Prestígio ganho. Sem deck: valem o guarda-roupa e a paleta liberada no nível.
 */
import { useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { useAction, useApi } from "@/lib/hooks/use-api";
import type { FlairCollection } from "@/components/flair/flair-collection";
import { buscarBrief, entregarBrief } from "@/lib/flair/make-up/api";
import { mesclarBrief } from "@/lib/flair/make-up/briefs";
import type { MakeUpResultado } from "@/lib/flair/make-up/types";
import type { Selecao } from "@/lib/flair/nucleos/selection";

export function useMakeUpBrief(codigo: string) {
  const def = useApi((signal) => buscarBrief(codigo, signal), [codigo]);
  const brief = useMemo(() => mesclarBrief(codigo, def.data), [codigo, def.data]);
  const bank = useApi<FlairCollection>((signal) => api.get("/api/me/flair/cards", { signal }), []);
  const [resultado, setResultado] = useState<MakeUpResultado | null>(null);
  const entrega = useAction(async (sel: Selecao) => {
    const r = await entregarBrief(codigo, { cartas: sel.cartas, maquiagem: sel.maquiagem });
    setResultado(r);
    return r;
  });
  const cartas = useMemo(() => bank.data?.cards ?? [], [bank.data]);
  return {
    brief,
    bloqueado: def.error?.status === 403,
    offline: !!def.error && def.error.status !== 403,
    carregando: (def.loading && !def.data) || (bank.loading && !bank.data),
    cartas,
    resultado,
    entregar: entrega.run,
    entregando: entrega.busy,
    erro: entrega.error,
    reiniciar: () => setResultado(null),
  };
}

"use client";
/**
 * A partida em andamento do jogo, se houver ("Continuar partida"): pergunta ao servidor uma vez ao abrir a tela. Depois
 * que a pessoa escolhe continuar ou começar outra, a pergunta sai da tela.
 */
import { useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { buscarEmAndamento } from "@/lib/flair/nucleos/api";
import type { NucleoCodigo, NucleoRetomada } from "@/lib/flair/nucleos/types";

export function useNucleoRetomada(codigo: NucleoCodigo) {
  const q = useApi<NucleoRetomada | null>((signal) => buscarEmAndamento(codigo, signal), [codigo]);
  const [decidida, setDecidida] = useState(false);
  return {
    retomada: decidida ? null : q.data ?? null,
    carregando: !decidida && q.loading,
    decidir: () => setDecidida(true),
  };
}

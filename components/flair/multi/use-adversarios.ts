"use client";
/** A busca de adversários com os filtros da tela: espera a pessoa parar de digitar (300 ms) e cancela a busca anterior. */
import { useEffect, useState } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { buscarAdversarios } from "@/lib/flair/multi/api";
import { consultaDosFiltros } from "@/lib/flair/multi/filtros";
import type { FiltrosAdversario } from "@/lib/flair/multi/types";

export const ESPERA_MS = 300;

export function useAdversarios(filtros: FiltrosAdversario) {
  const chave = consultaDosFiltros(filtros);
  const [pedida, setPedida] = useState(chave);
  useEffect(() => {
    const h = setTimeout(() => setPedida(chave), ESPERA_MS);
    return () => clearTimeout(h);
  }, [chave]);
  const busca = useApi((signal) => buscarAdversarios(filtros, signal), [pedida]);
  return { resultados: busca.data?.resultados ?? [], carregando: busca.loading, erro: busca.error, recarregar: busca.reload };
}

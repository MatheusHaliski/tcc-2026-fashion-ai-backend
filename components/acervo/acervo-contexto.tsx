"use client";
/** ACERVO — contexto da tela: dados, estado comum das duas views, busca espacial e mapa de uso. */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useApi } from "@/lib/hooks/use-api";
import { acervoApi } from "@/lib/acervo/api";
import type { AcervoUso } from "@/lib/acervo/types";
import { useAcervoBusca, type AcervoBuscaEstado } from "@/lib/acervo/use-acervo-busca";
import { useAcervoDados, type AcervoDados } from "@/lib/acervo/use-acervo-dados";
import { useAcervoTela, type AcervoTela } from "@/lib/acervo/use-acervo-tela";

export interface AcervoContexto {
  dados: AcervoDados;
  tela: AcervoTela;
  busca: AcervoBuscaEstado;
  /** mapa de uso, carregado só quando o destaque está ligado */
  uso: AcervoUso | null;
}

const Contexto = createContext<AcervoContexto | null>(null);

export function AcervoProvider({ children }: { children: ReactNode }) {
  const tela = useAcervoTela();
  const dados = useAcervoDados(tela.selecao);
  const busca = useAcervoBusca();
  const uso = useApi<AcervoUso>((signal) => acervoApi.uso(signal), [tela.usoLigado, dados.arvore?.total], { enabled: tela.usoLigado });
  const valor = useMemo(() => ({ dados, tela, busca, uso: tela.usoLigado ? uso.data : null }), [dados, tela, busca, uso.data]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAcervo(): AcervoContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useAcervo fora do AcervoProvider");
  return contexto;
}

"use client";
/**
 * ACERVO — dados da tela: a árvore com as peças, a lista de desejos e o painel financeiro (refeito quando a seleção
 * muda). Mover peça atualiza a tela na hora e confirma no servidor; se o servidor recusar, a tela volta ao que era.
 */
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { useApi } from "@/lib/hooks/use-api";
import { acervoApi } from "./api";
import { comPecasMovidas } from "./arvore";
import type { AcervoArvore, AcervoDesejo, AcervoFinanceiro } from "./types";

export interface AcervoDados {
  arvore: AcervoArvore | null;
  desejos: AcervoDesejo[];
  financeiro: AcervoFinanceiro | null;
  carregando: boolean;
  erro: ReturnType<typeof useApi>["error"];
  ocupado: boolean;
  recarregar: () => void;
  /** Roda uma alteração, recarrega tudo e avisa; devolve se deu certo. */
  executar: (acao: () => Promise<unknown>, aviso?: string) => Promise<boolean>;
  mover: (pieceIds: string[], compartimentoId: string | null, aviso?: string) => Promise<boolean>;
}

export function useAcervoDados(selecao: string[]): AcervoDados {
  const toast = useToast();
  const arvore = useApi<AcervoArvore>((signal) => acervoApi.arvore(signal), []);
  const desejos = useApi<AcervoDesejo[]>((signal) => acervoApi.desejos(signal), []);
  const chaveSelecao = selecao.join(",");
  const financeiro = useApi<AcervoFinanceiro>((signal) => acervoApi.financeiro(selecao, signal), [chaveSelecao]);
  const [ocupado, setOcupado] = useState(false);
  const recarregarArvore = arvore.reload;
  const recarregarDesejos = desejos.reload;
  const recarregarFinanceiro = financeiro.reload;
  const definirArvore = arvore.setData;

  const recarregar = useCallback(() => {
    recarregarArvore();
    recarregarDesejos();
    recarregarFinanceiro();
  }, [recarregarArvore, recarregarDesejos, recarregarFinanceiro]);

  const executar = useCallback(async (acao: () => Promise<unknown>, aviso?: string) => {
    setOcupado(true);
    try {
      await acao();
      recarregar();
      if (aviso) toast.success(aviso);
      return true;
    } catch (erro) {
      toast.fromError(erro);
      return false;
    } finally {
      setOcupado(false);
    }
  }, [recarregar, toast]);

  const mover = useCallback(async (pieceIds: string[], compartimentoId: string | null, aviso?: string) => {
    if (pieceIds.length === 0) return false;
    const antes = arvore.data;
    definirArvore((atual) => (atual ? comPecasMovidas(atual, pieceIds, compartimentoId) : atual));
    try {
      await acervoApi.mover(pieceIds, compartimentoId);
      if (aviso) toast.success(aviso);
      return true;
    } catch (erro) {
      definirArvore(antes);
      toast.fromError(erro);
      return false;
    }
  }, [arvore.data, definirArvore, toast]);

  return {
    arvore: arvore.data,
    desejos: desejos.data ?? [],
    financeiro: financeiro.data,
    carregando: arvore.loading && !arvore.data,
    erro: arvore.error,
    ocupado,
    recarregar,
    executar,
    mover,
  };
}

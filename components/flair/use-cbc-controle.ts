"use client";
/**
 * Teclado e controle num Desafio de Montagem, tão diretos quanto o toque e com os mesmos comandos dos elencos:
 * setas (ou direcional) escolhem a vaga; Espaço (ou A) entra na bandeja; dentro dela as setas escolhem a carta e
 * Espaço (ou A) põe na vaga, e o destaque segue para a próxima vaga vazia; Backspace (ou B) sai da bandeja ou, fora
 * dela, tira a carta da vaga. Devolve o índice da carta em foco na bandeja (ou null).
 */
import { useState } from "react";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import type { useCbcJogo } from "@/components/flair/use-cbc-jogo";
import type { Comando } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

const ACOES: NucleoAcao[] = ["NAVEGAR", "VESTIR", "TIRAR"];
/** colunas das vagas no celular (a seta para cima ou para baixo pula uma linha) */
const COLUNAS = 2;
/** cartas por linha da bandeja que a seta para cima ou para baixo pula */
const POR_LINHA = 4;

const limitar = (n: number, max: number) => Math.min(Math.max(0, max), Math.max(0, n));

export function useCbcControle(j: ReturnType<typeof useCbcJogo>, vagas: string[], ativo: boolean): number | null {
  const [naBandeja, setNaBandeja] = useState(false);
  const [foco, setFoco] = useState(0);

  const onComando = (c: Comando) => {
    const atual = j.atual;
    if (!atual) return;
    const dir = c.dir ?? 1;
    if (c.acao === "NAVEGAR" && naBandeja) {
      setFoco((f) => limitar(f + dir * (c.eixo === "y" ? POR_LINHA : 1), j.opcoes.length - 1));
    } else if (c.acao === "NAVEGAR") {
      const i = vagas.indexOf(atual.key);
      j.selecionar(vagas[limitar(i + dir * (c.eixo === "y" ? COLUNAS : 1), vagas.length - 1)]);
    } else if (c.acao === "VESTIR" && naBandeja) {
      const opcao = j.opcoes[limitar(foco, j.opcoes.length - 1)];
      if (opcao) j.escolher(opcao);
      setFoco(0);
    } else if (c.acao === "VESTIR") {
      j.selecionar(atual.key);
      setNaBandeja(true);
      setFoco(0);
    } else if (c.acao === "TIRAR" && naBandeja) {
      setNaBandeja(false);
    } else if (c.acao === "TIRAR") {
      j.tirar(atual.key);
    }
  };

  useNucleoControls({ acoes: ACOES, onComando, ativo });
  return naBandeja && j.opcoes.length > 0 ? limitar(foco, j.opcoes.length - 1) : null;
}

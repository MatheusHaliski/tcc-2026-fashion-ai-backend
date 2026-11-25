"use client";
/**
 * Os comandos da tela de jogo (teclado, toque e controle, use-nucleo-controls) ligados ao momento da partida:
 * - preparação: o que a redução do tabuleiro faz (navegar, vestir, tirar, trocar de aba, o gesto do □);
 * - pausa (Start ou Esc abre o objetivo): ✕ entrega o look, ○ fecha a pausa;
 * - ação e resultado: o foco passa pelos botões da faixa de baixo (lib/flair/nucleos/foco-da-acao.ts).
 * Extraído de nucleo-game.tsx.
 */
import type { Dispatch } from "react";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import type { BoardAcao } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { comandoNaAcao } from "@/lib/flair/nucleos/foco-da-acao";
import { comandoPermitido, type Momento } from "@/lib/flair/nucleos/moments";
import type { ResourceTab } from "@/lib/flair/nucleos/selection";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

interface Opcoes {
  acoes: NucleoAcao[];
  momento: Momento;
  tabs: ResourceTab[];
  pausado: boolean;
  ativo: boolean;
  /** a ação tem controle próprio (a mão de cartas do Fashion Sports): o foco genérico não entra */
  acaoPropria?: boolean;
  dispatch: Dispatch<BoardAcao>;
  entregar: () => void;
  limparAviso: () => void;
}

export function useNucleoComandos({ acoes, momento, tabs, pausado, ativo, acaoPropria = false, dispatch, entregar, limparAviso }: Opcoes) {
  const onComando = (c: Comando) => {
    // na pausa (o objetivo aberto): ✕ entrega, ○ e Start fecham
    if (pausado && momento === "PREPARACAO" && (c.acao === "VESTIR" || c.acao === "ENTREGAR")) return entregar();
    if (pausado && c.acao === "TIRAR") return dispatch({ type: "comando", comando: { acao: "VER_OBJETIVO" }, tabs });
    if (momento !== "PREPARACAO" && !acaoPropria && c.acao !== "VER_OBJETIVO" && c.acao !== "GIRAR" && comandoNaAcao(c)) return;
    if (!comandoPermitido(momento, c.acao)) return;
    limparAviso();
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  return useNucleoControls({ acoes, onComando, ativo });
}

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
import type { NucleoAcao, NucleoCodigo } from "@/lib/flair/nucleos/types";
import { mapaDoJogo } from "@/lib/flair/entrada/mapa-por-jogo";
import { DESFILE_JOGAVEL } from "@/lib/flair/nucleos/movimento/desfile";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { useEixoDeAndar } from "@/components/flair/nucleos/use-eixo-de-andar";

interface Opcoes {
  codigo: NucleoCodigo;
  acoes: NucleoAcao[];
  momento: Momento;
  tabs: ResourceTab[];
  pausado: boolean;
  ativo: boolean;
  /** a ação tem controle próprio (a mão de cartas do Fashion Sports): o foco genérico não entra */
  acaoPropria?: boolean;
  /** uma cutscene na tela: qualquer comando a encerra; ○ e Start só pulam, os outros também valem no jogo */
  cena?: { tocando: boolean; pular: () => void };
  dispatch: Dispatch<BoardAcao>;
  entregar: () => void;
  limparAviso: () => void;
}

export function useNucleoComandos({ codigo, acoes, momento, tabs, pausado, ativo, acaoPropria = false, cena, dispatch, entregar, limparAviso }: Opcoes) {
  // nos jogos de andar livre, na preparação WASD e o analógico levam a personagem pela sala
  // e na ação do desfile jogável (Passarela, Dress the Star, Batalha), a pessoa desfila até a ponta
  const desfile = momento === "ACAO" && DESFILE_JOGAVEL.has(codigo);
  const andar = mapaDoJogo(codigo, acoes).movimento === "LIVRE" && (momento === "PREPARACAO" || desfile) && ativo && !pausado && !cena?.tocando;
  useEixoDeAndar(andar);
  const onComando = (c: Comando) => {
    // a cutscene acaba com qualquer comando de jogo, que vale também (nenhum toque se perde); ○ e Start só pulam
    if (cena?.tocando && c.acao !== "GIRAR") {
      cena.pular();
      if (c.acao === "TIRAR" || c.acao === "VER_OBJETIVO") return;
    }
    // na pausa (o objetivo aberto): ✕ entrega, ○ e Start fecham
    if (pausado && momento === "PREPARACAO" && (c.acao === "VESTIR" || c.acao === "ENTREGAR")) return entregar();
    if (pausado && c.acao === "TIRAR") return dispatch({ type: "comando", comando: { acao: "VER_OBJETIVO" }, tabs });
    if (desfile && c.acao === "DESFILAR") return emitirFx({ tipo: "desfile-pose", nucleo: codigo });
    if (momento !== "PREPARACAO" && !acaoPropria && c.acao !== "VER_OBJETIVO" && c.acao !== "GIRAR" && comandoNaAcao(c)) return;
    if (!comandoPermitido(momento, c.acao)) return;
    limparAviso();
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  return useNucleoControls({ acoes, onComando, ativo, andar });
}

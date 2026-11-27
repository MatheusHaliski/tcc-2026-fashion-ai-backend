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
import { andaAgora } from "@/lib/flair/nucleos/movimento/quando-anda";
import { DESFILE_JOGAVEL } from "@/lib/flair/nucleos/movimento/desfile";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { execucaoPendente } from "@/lib/flair/nucleos/movimento/execucao-pendente";
import { useEixoDeAndar } from "@/components/flair/nucleos/use-eixo-de-andar";
import { perfilDoJogo } from "@/lib/flair/nucleos/controle/perfil-console";

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
  /** a janela do acionamento está aberta entre dois lances (no Dress Fighter, dá para circular pelo ringue) */
  entreLances?: boolean;
  dispatch: Dispatch<BoardAcao>;
  entregar: () => void;
  limparAviso: () => void;
}

export function useNucleoComandos({ codigo, acoes, momento, tabs, pausado, ativo, acaoPropria = false, cena, entreLances = false, dispatch, entregar, limparAviso }: Opcoes) {
  // nos jogos de andar livre, na preparação WASD e o analógico levam a personagem pela sala
  // na ação do desfile jogável a pessoa desfila até a ponta; na luta, circula pelo ringue entre os lances
  const desfile = momento === "ACAO" && DESFILE_JOGAVEL.has(codigo);
  // no perfil console a fase de uso tem controle próprio (setas, E, F, X): o legado não anda nem aperta a deixa
  const doConsole = desfile && perfilDoJogo(codigo) === "console";
  const andar = andaAgora(codigo, acoes, momento, entreLances) && ativo && !pausado && !cena?.tocando && !doConsole;
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
    // no desfile, os quatro botões vão à deixa da execução; sem deixa pendente, só □ (a pose final) vai à cena
    const botao = c.acao === "POSAR" ? "DESFILAR" : c.acao;
    if (doConsole && (botao === "DESFILAR" || botao === "VESTIR" || botao === "TIRAR" || botao === "TROCAR_ABA")) return;
    if (desfile && (botao === "DESFILAR" || (execucaoPendente() && (botao === "VESTIR" || botao === "TIRAR" || botao === "TROCAR_ABA")))) {
      return emitirFx({ tipo: "desfile-botao", nucleo: codigo, botao });
    }
    // na luta, □ é o golpe: joga a carta em foco na mão do lance (o mesmo que ✕)
    if (codigo === "DRESS_FIGHTER" && momento === "ACAO" && botao === "DESFILAR") return void comandoNaAcao({ acao: "VESTIR" });
    if (momento !== "PREPARACAO" && !acaoPropria && c.acao !== "VER_OBJETIVO" && c.acao !== "GIRAR" && comandoNaAcao(c)) return;
    if (!comandoPermitido(momento, c.acao)) return;
    limparAviso();
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  return useNucleoControls({ acoes, onComando, ativo, andar });
}

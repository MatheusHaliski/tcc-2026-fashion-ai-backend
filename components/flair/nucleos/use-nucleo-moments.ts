"use client";
/**
 * O momento da partida (deck, preparação, ação, resultado) como estado explícito da tela: a máquina de
 * lib/flair/nucleos/moments.ts avança pelos fatos da partida (partida aberta, entrega respondida, ação terminada,
 * jogar de novo) e publica cada troca para a cena (fx-events).
 */
import { useCallback, useEffect, useReducer } from "react";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { momentoInicial, proximoMomento, type Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

export interface NucleoMomentsOptions {
  codigo: NucleoCodigo;
  /** o núcleo não tem deck (zonas do editor, guarda-roupa liberado) */
  semDeck: boolean;
  /** falta montar o deck e abrir a partida */
  precisaDeck: boolean;
  /** o servidor já respondeu a entrega */
  entregue: boolean;
}

export function useNucleoMoments({ codigo, semDeck, precisaDeck, entregue }: NucleoMomentsOptions) {
  const [momento, dispatch] = useReducer(proximoMomento, semDeck, momentoInicial);

  useEffect(() => {
    if (precisaDeck) {
      if (momento !== "DECK") dispatch({ type: "REINICIAR", semDeck: false });
    } else if (momento === "DECK") {
      dispatch({ type: "ENTRAR" });
    } else if (entregue && momento === "PREPARACAO") {
      dispatch({ type: "ENTREGUE" });
    } else if (!entregue && (momento === "ACAO" || momento === "RESULTADO")) {
      dispatch({ type: "REINICIAR", semDeck: true });
    }
  }, [precisaDeck, entregue, momento]);

  useEffect(() => {
    emitirFx({ tipo: "momento", nucleo: codigo, momento });
  }, [codigo, momento]);

  const fimDaAcao = useCallback(() => dispatch({ type: "FIM_ACAO" }), []);
  return { momento: momento as Momento, fimDaAcao };
}

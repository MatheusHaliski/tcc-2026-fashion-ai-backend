"use client";
/**
 * Os avisos que a preparação manda sem a pessoa pedir: a resposta escolhida acende a ação de cena do jogo (fx-events)
 * e cada mudança do look pede a prévia ao servidor. Extraído de nucleo-game.tsx sem mudar o comportamento.
 */
import { useEffect } from "react";
import type { Acionamento } from "@/lib/flair/nucleos/moments";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import type { Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Sinais {
  codigo: NucleoCodigo;
  sel: Selecao;
  acionamento: Acionamento | null;
  preparando: boolean;
  efetiva: AvatarTipo;
  onPrevia?: (sel: Selecao, avatar: AvatarTipo) => void;
}

export function useNucleoSinais({ codigo, sel, acionamento, preparando, efetiva, onPrevia }: Sinais): void {
  useEffect(() => {
    if (sel.resposta && acionamento?.tipo === "RESPOSTA") emitirFx({ tipo: "acionamento", nucleo: codigo, acionamento: "RESPOSTA" });
  }, [sel.resposta, acionamento?.tipo, codigo]);
  useEffect(() => {
    if (preparando) onPrevia?.(sel, efetiva);
  }, [preparando, sel, efetiva, onPrevia]);
}

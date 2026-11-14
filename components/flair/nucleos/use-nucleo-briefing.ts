"use client";
/**
 * A apresentação da partida na tela de jogo: o briefing da vez (lib/flair/nucleos/briefing.ts), o resumo dele para a
 * dica sob o deck e, no Look Relâmpago, o look-alvo que o avatar veste enquanto o cartão está aberto.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { resumoDoBriefing } from "@/components/flair/nucleos/nucleo-briefing";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { briefingDaPartida } from "@/lib/flair/nucleos/briefing";
import type { NucleoPartida, NucleoResultado } from "@/lib/flair/nucleos/types";

export function useNucleoBriefing(partida: NucleoPartida | null | undefined, tentativa: NucleoResultado | null | undefined) {
  const tx = useNucleoText();
  const briefing = useMemo(() => briefingDaPartida(partida, tentativa), [partida, tentativa]);
  /** chave do briefing que a pessoa já fechou (ou cujo tempo acabou) */
  const [fechado, setFechado] = useState<string | null>(null);
  const chave = briefing?.chave ?? null;
  useEffect(() => {
    if (!chave) setFechado(null);
  }, [chave]);
  const fechar = useCallback(() => setFechado(chave), [chave]);
  const aberto = !!briefing && fechado !== briefing.chave;
  return {
    briefing,
    aberto,
    fechar,
    /** a dica que fica sob o deck: o briefing em uma linha */
    resumo: briefing ? resumoDoBriefing(tx, briefing) : null,
    /** o look-alvo, só enquanto o cartão dele está aberto */
    alvoAVista: aberto && briefing?.alvo ? briefing.alvo : null,
  };
}

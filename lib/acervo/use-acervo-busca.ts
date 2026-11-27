"use client";
/**
 * ACERVO — busca espacial: o texto ("camisa branca M") vai ao servidor depois de uma pausa na digitação; a resposta
 * diz quais peças batem e em quais compartimentos elas estão, e as duas views acendem esses compartimentos.
 */
import { useEffect, useMemo, useState } from "react";
import { acervoApi } from "./api";
import type { AcervoBusca } from "./types";

const PAUSA_MS = 300;

export interface AcervoBuscaEstado {
  texto: string;
  setTexto: (texto: string) => void;
  buscando: boolean;
  resultado: AcervoBusca | null;
  /** compartimentos que guardam alguma peça encontrada */
  acesos: Set<string>;
  /** peças encontradas */
  achadas: Set<string>;
}

export function useAcervoBusca(): AcervoBuscaEstado {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<AcervoBusca | null>(null);
  const [buscando, setBuscando] = useState(false);
  const limpo = texto.trim();

  useEffect(() => {
    if (!limpo) {
      setResultado(null);
      setBuscando(false);
      return;
    }
    const controle = new AbortController();
    setBuscando(true);
    const espera = setTimeout(() => {
      acervoApi.busca(limpo, controle.signal)
        .then((r) => {
          if (!controle.signal.aborted) setResultado(r);
        })
        .catch(() => {
          if (!controle.signal.aborted) setResultado({ termos: [], pecas: [], compartimentos: [], semLugar: 0 });
        })
        .finally(() => {
          if (!controle.signal.aborted) setBuscando(false);
        });
    }, PAUSA_MS);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [limpo]);

  const acesos = useMemo(() => new Set((resultado?.compartimentos ?? []).map((c) => c.id)), [resultado]);
  const achadas = useMemo(() => new Set((resultado?.pecas ?? []).map((p) => p.id)), [resultado]);
  return { texto, setTexto, buscando, resultado, acesos, achadas };
}

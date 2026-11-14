"use client";
/**
 * ACERVO — estado da tela, comum às duas views: o lugar escolhido no diretório, as peças marcadas (subtotal e
 * marcadores numerados), a peça com a ficha aberta, o modo (Meu espaço ou Dream Space) e os destaques ligados
 * (Raio-X, mapa de uso, desejos simulados).
 */
import { useCallback, useState } from "react";
import type { AcervoLocal } from "./arvore";
import type { AcervoModo } from "./types";

export type AcervoVista = "CENTRAL" | "ESPACO";
export type AcervoAba = "COMPRADO" | "DESEJOS";

export interface AcervoTela {
  vista: AcervoVista;
  setVista: (vista: AcervoVista) => void;
  /** Acervo comprado ou lista de desejos (sempre separados). */
  aba: AcervoAba;
  setAba: (aba: AcervoAba) => void;
  local: AcervoLocal;
  setLocal: (local: AcervoLocal) => void;
  /** Abre a view "Meu espaço" já no compartimento. */
  abrirNoEspaco: (compartimentoId: string) => void;
  selecao: string[];
  alternarSelecao: (pieceId: string) => void;
  limparSelecao: () => void;
  pecaAberta: string | null;
  abrirPeca: (pieceId: string | null) => void;
  modo: AcervoModo;
  setModo: (modo: AcervoModo) => void;
  raioX: boolean;
  setRaioX: (ligado: boolean) => void;
  usoLigado: boolean;
  setUsoLigado: (ligado: boolean) => void;
  /** Desejos que entram como peça-fantasma no closet (simulação de compra). */
  simulados: string[];
  alternarSimulado: (desejoId: string) => void;
}

const alternar = (lista: string[], id: string): string[] => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

export function useAcervoTela(): AcervoTela {
  const [vista, setVista] = useState<AcervoVista>("CENTRAL");
  const [aba, setAba] = useState<AcervoAba>("COMPRADO");
  const [local, setLocal] = useState<AcervoLocal>({ tipo: "TODAS" });
  const [selecao, setSelecao] = useState<string[]>([]);
  const [pecaAberta, abrirPeca] = useState<string | null>(null);
  const [modo, setModo] = useState<AcervoModo>("MEU_ESPACO");
  const [raioX, setRaioX] = useState(false);
  const [usoLigado, setUsoLigado] = useState(false);
  const [simulados, setSimulados] = useState<string[]>([]);

  const abrirNoEspaco = useCallback((compartimentoId: string) => {
    setLocal({ tipo: "COMPARTIMENTO", id: compartimentoId });
    setVista("ESPACO");
  }, []);
  const alternarSelecao = useCallback((pieceId: string) => setSelecao((atual) => alternar(atual, pieceId)), []);
  const limparSelecao = useCallback(() => setSelecao([]), []);
  const alternarSimulado = useCallback((desejoId: string) => setSimulados((atual) => alternar(atual, desejoId)), []);

  return {
    vista,
    setVista,
    aba,
    setAba,
    local,
    setLocal,
    abrirNoEspaco,
    selecao,
    alternarSelecao,
    limparSelecao,
    pecaAberta,
    abrirPeca,
    modo,
    setModo,
    raioX,
    setRaioX,
    usoLigado,
    setUsoLigado,
    simulados,
    alternarSimulado,
  };
}

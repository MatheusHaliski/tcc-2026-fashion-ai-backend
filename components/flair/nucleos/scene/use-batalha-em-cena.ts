"use client";
/**
 * A Batalha de Looks na cena 3D: o adversário veste o look da casa que o servidor revelou na última rodada comparada
 * (antes da primeira entrega ele fica com a roupa do papel: o look dele só aparece depois da entrega) e o painel de LED
 * mostra a soma dos dois até agora. Fora da Batalha não muda nada.
 */
import { useMemo } from "react";
import type { Look3dPiece } from "@/components/three/common";
import { fechoDaBatalha, pecasDoAdversario, rodadasDaBatalha, somaDaBatalha } from "@/lib/flair/nucleos/batalha-placar";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

interface BatalhaEmCena {
  /** a roupa por papel, para os figurantes humanos (gente/figurantes.ts) */
  roupas: Record<string, Look3dPiece[]> | null;
  /** "160 × 135": só números, como pede o painel */
  placar: string | null;
}

const NADA: BatalhaEmCena = { roupas: null, placar: null };

export function useBatalhaEmCena(codigo: string, resultado: NucleoResultado | null | undefined, anterior: NucleoResultado | null | undefined): BatalhaEmCena {
  return useMemo(() => {
    if (codigo !== "BATALHA_LOOKS") return NADA;
    const rodadas = rodadasDaBatalha(resultado, anterior);
    const pecas = pecasDoAdversario(rodadas);
    // no fim, a soma do servidor com a execução do desfile final (a mesma da tabela)
    const soma = fechoDaBatalha(resultado) ?? somaDaBatalha(rodadas);
    return { roupas: pecas ? { ADVERSARIO: pecas } : null, placar: soma ? `${soma.voce} × ${soma.adversario}` : null };
  }, [codigo, resultado, anterior]);
}

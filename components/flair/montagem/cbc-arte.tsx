"use client";
/**
 * A arte de um Desafio de Montagem pelo cenário: o quebra-cabeça dinâmico (vídeo ou símbolo FAI em movimento,
 * lib/flair/montagem/dinamico) quando o cenário tem um, senão a cena desenhada em canvas (lib/flair/cenas).
 * `estiloDaArte` dá ao contêiner a proporção do quadro dinâmico (quadrado ou 4:3 no lugar do 16:10 das cenas).
 */
import type { CSSProperties } from "react";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { QuebraCabecaVivo } from "@/components/flair/montagem/quebra-cabeca-vivo";
import { cenaDoCenario } from "@/lib/flair/cenas/catalogo";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import { quebraCabecaDinamico } from "@/lib/flair/montagem/dinamico/catalogo";

interface Props {
  cenario: string;
  pecas?: PecaEstado[] | null;
  completa?: boolean;
  selecionada?: number;
  decorativa?: boolean;
}

export function CbcArte({ cenario, pecas = null, completa = false, selecionada, decorativa }: Props) {
  const qc = quebraCabecaDinamico(cenario);
  if (qc) return <QuebraCabecaVivo qc={qc} pecas={pecas} completa={completa} selecionada={selecionada} decorativa={decorativa} />;
  return <CenaViva cena={cenaDoCenario(cenario)} pecas={pecas} completa={completa} decorativa={decorativa} />;
}

/** Classe e proporção do contêiner da arte (só os cenários dinâmicos mudam). */
export function estiloDaArte(cenario: string): { className?: string; style?: CSSProperties } {
  const qc = quebraCabecaDinamico(cenario);
  return qc ? { className: "is-dinamico", style: { ["--qc-ar" as string]: `${qc.largura} / 100` } } : {};
}

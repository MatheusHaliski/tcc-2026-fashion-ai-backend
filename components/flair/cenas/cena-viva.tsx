"use client";
/**
 * Cena dinâmica dos Desafios de Montagem e dos elencos: um desenho 2D animado, pintado em canvas pelo motor de
 * lib/flair/cenas. Com `pecas`, o desenho é o quebra-cabeça: cada peça é uma janela para a mesma animação (encaixada,
 * mostra a cena no lugar; solta, mostra a cena deslocada com ela; faltando, não mostra). Sem `pecas`, a cena inteira
 * (miniaturas e memórias). `completa` fecha a arte com o floreio. O rótulo descreve a cena para leitores de tela.
 */
import { cn } from "@/components/ui";
import { useCenaViva } from "@/components/flair/cenas/use-cena-viva";
import { useI18n } from "@/lib/i18n/i18n";
import type { Cena } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";

interface Props {
  cena: Cena;
  pecas?: PecaEstado[] | null;
  completa?: boolean;
  /** só o quadro parado da cena (sem animação) */
  parada?: boolean;
  /** decorativa: fica fora da leitura (o texto ao lado já diz o que é) */
  decorativa?: boolean;
  className?: string;
}

/** Texto que descreve a cena e, com peças, o andamento do quebra-cabeça. */
export function useRotuloDaCena(cena: Cena, pecas?: PecaEstado[] | null, completa?: boolean): string {
  const { t } = useI18n();
  const descricao = `${t(`flair3d.cenas.${cena.id}.name`)}: ${t(`flair3d.cenas.${cena.id}.description`)}`;
  if (!pecas) return descricao;
  if (completa) return t("flair3d.cenas.puzzle.complete", { cena: descricao, total: pecas.length });
  const conta = (e: PecaEstado) => pecas.filter((p) => p === e).length;
  return t("flair3d.cenas.puzzle.progress", {
    cena: descricao,
    total: pecas.length,
    encaixadas: conta("verde"),
    quase: conta("laranja"),
    soltas: conta("vermelha") + conta("chegando"),
    faltando: conta("coberta"),
  });
}

export function CenaViva({ cena, pecas = null, completa = false, parada = false, decorativa = false, className }: Props) {
  const ref = useCenaViva(cena, pecas, completa, parada);
  const rotulo = useRotuloDaCena(cena, pecas, completa);
  return (
    <canvas
      ref={ref}
      className={cn("cena-viva", className)}
      width={640}
      height={400}
      data-cena={cena.id}
      data-variante={cena.variante}
      data-pecas={pecas ? pecas.join(",") : undefined}
      data-completa={completa || undefined}
      role={decorativa ? undefined : "img"}
      aria-label={decorativa ? undefined : rotulo}
      aria-hidden={decorativa || undefined}
    />
  );
}

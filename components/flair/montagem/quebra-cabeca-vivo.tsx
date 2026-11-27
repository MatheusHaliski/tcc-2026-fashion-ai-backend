"use client";
/**
 * Quebra-cabeça DINÂMICO de um Desafio de Montagem: cada peça é uma janela para a mesma fonte em movimento (o vídeo
 * da cena ou o símbolo FAI animado), recortada num só canvas e por isso sincronizada. Peça vazia: só o contorno;
 * carta posta e ainda sem julgamento: a peça chega fraca, pulsando; sintonia baixa: fora do lugar e sem cor; média:
 * quase no lugar; alta: encaixada. Completo, o quadro inteiro em movimento. Sem `pecas`, o quadro inteiro (miniatura).
 * O rótulo descreve a cena e o andamento para leitores de tela.
 */
import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import type { QuebraCabecaDinamico } from "@/lib/flair/montagem/dinamico/catalogo";
import { useQuebraCabecaVivo } from "@/components/flair/montagem/use-quebra-cabeca-vivo";

interface Props {
  qc: QuebraCabecaDinamico;
  pecas?: PecaEstado[] | null;
  completa?: boolean;
  /** só o quadro parado (sem animação) */
  parada?: boolean;
  /** índice da peça da vaga em destaque */
  selecionada?: number;
  decorativa?: boolean;
  className?: string;
}

export function useRotuloDoQuebraCabeca(qc: QuebraCabecaDinamico, pecas?: PecaEstado[] | null, completa?: boolean): string {
  const { t } = useI18n();
  const descricao = `${t(`cbc.dinamico.${qc.cenario}.name`)}: ${t(`cbc.dinamico.${qc.cenario}.description`)}`;
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

export function QuebraCabecaVivo({ qc, pecas = null, completa = false, parada = false, selecionada = -1, decorativa = false, className }: Props) {
  const ref = useQuebraCabecaVivo(qc, pecas, completa, parada, selecionada);
  const rotulo = useRotuloDoQuebraCabeca(qc, pecas, completa);
  return (
    <canvas
      ref={ref}
      className={cn("qc-vivo", className)}
      width={640}
      height={Math.round((640 * 100) / qc.largura)}
      style={{ ["--qc-ar" as string]: `${qc.largura} / 100` }}
      data-cenario={qc.cenario}
      data-forma={qc.forma}
      data-fonte={qc.fonte.tipo}
      data-pecas={pecas ? pecas.join(",") : undefined}
      data-completa={completa || undefined}
      data-testid="quebra-cabeca-vivo"
      role={decorativa ? undefined : "img"}
      aria-label={decorativa ? undefined : rotulo}
      aria-hidden={decorativa || undefined}
    />
  );
}

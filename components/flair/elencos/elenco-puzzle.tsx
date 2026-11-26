"use client";
/**
 * O quebra-cabeça do elenco: a imagem cortada nas peças do recorte (quadrantes, encaixes, setores ou cacos), uma por
 * vaga. Ao fundo, a imagem apagada mostra o que falta. Peça vazia: só o contorno. Carta posta e ainda sem julgamento:
 * a peça aparece fraca, pulsando. Carta que não cumpre o pedido: a peça fica torta, fora do lugar e sem cor. Carta que
 * cumpre: a peça voa até o lugar e encaixa em cor. Completo, a imagem inteira. `montando` anima todas as peças
 * chegando uma a uma (o modal dos logos sem vídeo). Tocar numa peça escolhe a vaga dela; soltar uma carta numa peça
 * põe a carta ali. Movimento reduzido: as peças mudam de estado sem voar (regra global de 01).
 */
import { useId } from "react";
import { cn } from "@/components/ui";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { EstadoPeca } from "@/lib/flair/elencos/progresso";
import type { QuebraCabeca } from "@/lib/flair/elencos/quebra-cabecas";

interface Props {
  qc: QuebraCabeca;
  nome: string;
  /** estado de cada vaga, na ordem das peças */
  estados: EstadoPeca[];
  chaves: string[];
  selecionada?: string;
  completo?: boolean;
  montando?: boolean;
  onPeca?: (chave: string) => void;
}

export function ElencoPuzzle({ qc, nome, estados, chaves, selecionada, completo, montando, onPeca }: Props) {
  const tx = useElencoText();
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = qc.largura;
  const total = qc.pecas.length;
  const certas = completo ? total : estados.filter((e) => e === "encaixada").length;
  const imagem = <image href={qc.imagem} x={0} y={0} width={w} height={100} preserveAspectRatio="xMidYMid slice" />;
  return (
    <figure className={cn("ep-puzzle", completo && "is-complete", montando && "is-assembling")} data-forma={qc.forma} data-testid={montando ? "elenco-montagem" : "elenco-puzzle"}
      style={{ ["--ep-ratio" as string]: `${w} / 100` }}>
      <svg viewBox={`0 0 ${w} 100`} role="img" aria-label={tx.t("flair3d.elencos.puzzle", { nome, n: certas, total })}>
        <defs>
          {qc.pecas.map((p, i) => <clipPath key={i} id={`${base}-${i}`}><path d={p.d} /></clipPath>)}
        </defs>
        <g className="ep-ghost">{imagem}</g>
        {qc.pecas.map((p, i) => {
          const estado: EstadoPeca = completo ? "encaixada" : estados[i] ?? "vazia";
          const chave = chaves[i] ?? `p${i + 1}`;
          // de onde a peça chega: para fora do centro da imagem, proporcional à distância
          const voo = { ["--dx" as string]: `${((p.cx - w / 2) * 0.7).toFixed(2)}px`, ["--dy" as string]: `${((p.cy - 50) * 0.7).toFixed(2)}px`, ["--i" as string]: i };
          return (
            <g key={chave} className={cn("ep-peca", `is-${estado}`)} data-state={estado} style={voo}>
              <g className="ep-arte" clipPath={`url(#${base}-${i})`}>{imagem}</g>
              <path d={p.d} className={cn("ep-contorno", selecionada === chave && "is-selected")} data-slot={onPeca ? chave : undefined}
                onClick={onPeca ? () => onPeca(chave) : undefined} aria-hidden vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      <ol className="sr-only" data-testid={montando ? undefined : "elenco-pecas"}>
        {qc.pecas.map((_, i) => {
          const estado = completo ? "encaixada" : estados[i] ?? "vazia";
          return <li key={i} className="ep-peca-item" data-state={estado}>{tx.t("flair3d.elencos.piece", { n: i + 1, estado: tx.t(`flair3d.elencos.state.${estado}`) })}</li>;
        })}
      </ol>
    </figure>
  );
}

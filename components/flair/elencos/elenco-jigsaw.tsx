"use client";
/**
 * Quebra-cabeça (em cima): a arte do elenco cortada em tantas peças quanto as linhas, na ordem das linhas. Peça de
 * linha verde em cor, laranja só em traço (tons de cinza), vermelha escura e sem link coberta. Na entrega com todos os
 * requisitos, a arte se revela inteira, com as fotos das peças da pessoa nas posições da formação e "edição N".
 */
import { cn } from "@/components/ui";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { gradeDoQuebraCabeca, type PecaEstado } from "@/lib/flair/elencos/board";

export interface FotoRevelada {
  chave: string;
  x: number;
  y: number;
  url: string | null;
  nome: string;
}

interface Props {
  arte: string;
  nome: string;
  estados: PecaEstado[];
  revelado: { edicao: number; fotos: FotoRevelada[] } | null;
}

export function ElencoJigsaw({ arte, nome, estados, revelado }: Props) {
  const tx = useElencoText();
  const { colunas, fileiras } = gradeDoQuebraCabeca(estados.length);
  const pos = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  return (
    <figure className={cn("el-jigsaw", revelado && "is-revealed")} data-testid="elenco-jigsaw">
      <div className="el-pieces" role="img" aria-label={tx.t("flair3d.elencos.jigsaw", { nome, verdes: estados.filter((e) => e === "verde").length, total: estados.length })}
        style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)`, gridTemplateRows: `repeat(${fileiras}, 1fr)` }}>
        {estados.map((estado, i) => {
          const c = i % colunas;
          const r = Math.floor(i / colunas);
          return (
            <span key={i} className={cn("el-piece", `is-${revelado ? "verde" : estado}`)} data-state={revelado ? "verde" : estado}
              style={{ backgroundImage: `url("${arte}")`, backgroundSize: `${colunas * 100}% ${fileiras * 100}%`, backgroundPosition: `${pos(c, colunas)}% ${pos(r, fileiras)}%` }} />
          );
        })}
      </div>
      {revelado && (
        <div className="el-reveal" data-testid="elenco-reveal">
          {revelado.fotos.map((f) => (
            <span key={f.chave} className="el-photo" style={{ left: `${f.x}%`, top: `${f.y}%` }} title={f.nome}>
              {f.url ? <img src={f.url} alt={f.nome} /> : <em>{f.nome}</em>}
            </span>
          ))}
        </div>
      )}
      {revelado && <figcaption className="el-edition">{tx.t("flair3d.elencos.edition", { n: revelado.edicao })}</figcaption>}
    </figure>
  );
}

"use client";
/**
 * Quebra-cabeça (em cima): a arte do elenco recortada em peças com encaixe, uma por linha do tabuleiro, na ordem das
 * linhas. Enquanto as duas vagas da linha não têm carta, o lugar da peça fica vazio (só o contorno). Com as cartas
 * postas, a peça aparece solta e escura (link fraco), chega perto em tons de cinza (link médio) e encaixa sozinha, em
 * cor, quando o link fica forte. Na entrega com todos os requisitos, a arte se completa, com as fotos das peças da
 * pessoa nas posições da formação e "edição N". Movimento reduzido: as peças mudam de lugar sem transição.
 */
import { useId } from "react";
import { cn } from "@/components/ui";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import { ARTE_A, ARTE_L, folgaDaPeca, recortesDoQuebraCabeca } from "@/lib/flair/elencos/jigsaw";

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
  const id = useId();
  const { recortes } = recortesDoQuebraCabeca(estados.length);
  const verdes = estados.filter((e) => e === "verde").length;
  return (
    <figure className={cn("el-jigsaw", revelado && "is-revealed")} data-testid="elenco-jigsaw">
      <svg className="el-pieces" viewBox={`0 0 ${ARTE_L} ${ARTE_A}`} preserveAspectRatio="none" role="img"
        aria-label={tx.t("flair3d.elencos.jigsaw", { nome, verdes, total: estados.length })}>
        <defs>
          {recortes.map((r) => (
            <clipPath key={r.indice} id={`${id}-p${r.indice}`}>
              <path d={r.d} />
            </clipPath>
          ))}
        </defs>
        {recortes.map((r) => {
          const linha = r.indice < estados.length;
          let estado: PecaEstado | "moldura" = linha ? estados[r.indice] : "moldura";
          if (revelado) estado = "verde";
          const folga = folgaDaPeca(r.indice, estado === "moldura" ? "verde" : estado);
          return (
            <g key={r.indice} className={cn(linha ? "el-piece" : "el-frame", `is-${estado}`)} data-state={linha ? estado : undefined}
              style={{ transform: `translate(${folga.dx}px, ${folga.dy}px) rotate(${folga.giro}deg)`, transformOrigin: `${r.cx}px ${r.cy}px` }}>
              {estado !== "coberta" && <image href={arte} width={ARTE_L} height={ARTE_A} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-p${r.indice})`} />}
              <path className="el-cut" d={r.d} />
            </g>
          );
        })}
      </svg>
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

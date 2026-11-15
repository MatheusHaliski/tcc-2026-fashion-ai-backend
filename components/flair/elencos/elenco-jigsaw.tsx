"use client";
/**
 * Quebra-cabeça (em cima): a cena dinâmica do elenco recortada em peças com encaixe, uma por linha do tabuleiro, na
 * ordem das linhas. Cada peça é uma janela para a mesma animação. Enquanto as duas vagas da linha não têm carta, o
 * lugar da peça fica vazio (só o contorno). Com as duas cartas postas, a peça entra na hora, ainda sem cor de nível
 * (chegando); quando o servidor julga o link, fica solta e escura (fraco), quase no lugar e sem cor (médio) ou encaixa
 * sozinha, em cor (forte). Na entrega com todos os requisitos, a arte se completa com o floreio, as fotos das peças da
 * pessoa nas posições da formação e "edição N". Movimento reduzido: quadro parado e peças que mudam de lugar na hora.
 */
import { cn } from "@/components/ui";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import type { Cena } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";

export interface FotoRevelada {
  chave: string;
  x: number;
  y: number;
  url: string | null;
  nome: string;
}

interface Props {
  cena: Cena;
  estados: PecaEstado[];
  revelado: { edicao: number; fotos: FotoRevelada[] } | null;
}

export function ElencoJigsaw({ cena, estados, revelado }: Props) {
  const tx = useElencoText();
  const pecas: PecaEstado[] = revelado ? estados.map(() => "verde") : estados;
  return (
    <figure className={cn("el-jigsaw", revelado && "is-revealed")} data-testid="elenco-jigsaw">
      <CenaViva cena={cena} pecas={pecas} completa={!!revelado} className="el-pieces" />
      <ol className="sr-only" data-testid="elenco-pieces">
        {pecas.map((estado, i) => (
          <li key={i} className={cn("el-piece", `is-${estado}`)} data-state={estado}>
            {tx.t("flair3d.cenas.piece", { n: i + 1, estado: tx.t(`flair3d.cenas.state.${estado}`) })}
          </li>
        ))}
      </ol>
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

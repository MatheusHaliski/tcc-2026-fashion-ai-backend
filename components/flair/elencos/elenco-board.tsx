"use client";
/**
 * Tabuleiro do elenco (embaixo): as vagas na formação (coluna, linha), as linhas entre vagas na cor do nível que o
 * servidor devolve (vermelha, laranja, verde) com os ícones dos atributos que ligaram, e a química (0 a 3) de cada carta.
 */
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { fileirasDe, linkDaLinha, nivelDe, posicaoDaVaga } from "@/lib/flair/elencos/board";
import type { ElencoConferencia, ElencoDefinicao } from "@/lib/flair/elencos/types";

interface Props {
  elenco: ElencoDefinicao;
  cartas: Record<string, string>;
  banco: FlairCollectionCard[];
  conf: ElencoConferencia | null;
  selecionada: string;
  onVaga: (chave: string) => void;
}

export function ElencoBoard({ elenco, cartas, banco, conf, selecionada, onVaga }: Props) {
  const tx = useElencoText();
  const fileiras = fileirasDe(elenco.vagas);
  const pos = new Map(elenco.vagas.map((v) => [v.chave, posicaoDaVaga(v, fileiras)]));
  return (
    <div className="el-board" data-testid="elenco-board" style={{ ["--el-rows" as string]: fileiras }}>
      <svg className="el-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {elenco.linhas.map((l) => {
          const a = pos.get(l.a);
          const b = pos.get(l.b);
          if (!a || !b) return null;
          const nivel = cartas[l.a] && cartas[l.b] ? nivelDe(linkDaLinha(l, conf)?.nivel) : null;
          return <line key={`${l.a}-${l.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cn("el-line", nivel ? `is-${nivel.toLowerCase()}` : "is-empty")} data-link={`${l.a}-${l.b}`} data-level={nivel ?? "NONE"} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {elenco.linhas.map((l) => {
        const a = pos.get(l.a);
        const b = pos.get(l.b);
        const link = cartas[l.a] && cartas[l.b] ? linkDaLinha(l, conf) : null;
        if (!a || !b || !link || !link.atributos.length) return null;
        return (
          <span key={`attr-${l.a}-${l.b}`} className="el-attrs" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}
            aria-label={tx.t("flair3d.elencos.link", { a: l.a, b: l.b, lista: link.atributos.map(tx.atributo).join(", ") })}>
            {link.atributos.map((at) => <i key={at} title={tx.atributo(at)} aria-hidden>{tx.atributoCurto(at)}</i>)}
          </span>
        );
      })}
      {elenco.vagas.map((v) => {
        const p = pos.get(v.chave)!;
        const card = banco.find((c) => c.id === cartas[v.chave]);
        const quimica = conf?.quimicaCartas?.[v.chave] ?? 0;
        return (
          <button key={v.chave} type="button" className={cn("el-slot", card && "is-filled", selecionada === v.chave && "is-selected")} style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={tx.t("flair3d.elencos.slot", { pos: tx.posicao(v.posicao), carta: card?.name ?? tx.t("flair3d.elencos.empty"), n: quimica })}
            aria-current={selecionada === v.chave || undefined} onClick={() => onVaga(v.chave)} data-slot={v.chave}>
            <span className="el-slot-pos">{tx.posicao(v.posicao)}</span>
            {card?.imageUrl ? <img src={card.imageUrl} alt="" /> : null}
            <span className="el-slot-name">{card?.name ?? tx.t("flair3d.elencos.empty")}</span>
            {card && (
              <span className="el-chem" aria-hidden>
                {[1, 2, 3].map((i) => <b key={i} className={cn(i <= quimica && "is-on")} />)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

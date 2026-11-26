"use client";
/**
 * Tabuleiro do elenco (embaixo): as vagas na formação (coluna, linha), as linhas entre vagas na cor do nível que o
 * servidor devolve (vermelha, laranja, verde) com os ícones dos atributos que ligaram, e a química (0 a 3) de cada
 * carta. Cada vaga diz o que aceita; tocar escolhe a vaga (a bandeja mostra as cartas dela) e a carta posta pode ser
 * arrastada para outra vaga (troca) ou para a bandeja (tira). Enquanto o servidor julga, a linha fica "conferindo":
 * nunca mostra um nível que ele não devolveu. Cada linha se desenha de uma vaga à outra quando ganha o nível.
 */
import type { PointerEvent } from "react";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { mediaUrl } from "@/lib/api/client";
import { gradeDe, linkDaLinha, nivelDe, posicaoDaVaga } from "@/lib/flair/elencos/board";
import type { ElencoConferencia, ElencoDefinicao } from "@/lib/flair/elencos/types";

interface Props {
  elenco: ElencoDefinicao;
  cartas: Record<string, string>;
  /** as cartas que o /conferir julgou (linha com carta diferente disso ainda está sendo conferida) */
  conferidas?: Record<string, string>;
  banco: FlairCollectionCard[];
  conf: ElencoConferencia | null;
  selecionada: string;
  onVaga: (chave: string) => void;
  pegar?: (cardId: string, origem: string | null) => (e: PointerEvent<HTMLElement>) => void;
}

export function ElencoBoard({ elenco, cartas, conferidas, banco, conf, selecionada, onVaga, pegar }: Props) {
  const tx = useElencoText();
  const grade = gradeDe(elenco.vagas);
  const pos = new Map(elenco.vagas.map((v) => [v.chave, posicaoDaVaga(v, grade)]));
  const julgada = (a: string, b: string) => !conferidas || (conferidas[a] === cartas[a] && conferidas[b] === cartas[b]);
  return (
    <div className="el-board" data-testid="elenco-board" style={{ ["--el-rows" as string]: grade.fileiras }}>
      <svg className="el-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {elenco.linhas.map((l) => {
          const a = pos.get(l.a);
          const b = pos.get(l.b);
          if (!a || !b) return null;
          const postas = !!cartas[l.a] && !!cartas[l.b];
          const nivel = postas && julgada(l.a, l.b) ? nivelDe(linkDaLinha(l, conf)?.nivel) : null;
          const estado = nivel ?? (postas ? "PENDING" : "NONE");
          return (
            <line key={`${l.a}-${l.b}-${estado}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-link={`${l.a}-${l.b}`} data-level={estado} vectorEffect="non-scaling-stroke"
              className={cn("el-line", nivel ? `is-${nivel.toLowerCase()}` : postas ? "is-pending" : "is-empty")} style={{ transformOrigin: `${a.x}px ${a.y}px` }} />
          );
        })}
      </svg>
      {elenco.linhas.map((l) => {
        const a = pos.get(l.a);
        const b = pos.get(l.b);
        const link = cartas[l.a] && cartas[l.b] && julgada(l.a, l.b) ? linkDaLinha(l, conf) : null;
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
            aria-current={selecionada === v.chave || undefined} onClick={() => onVaga(v.chave)} data-slot={v.chave}
            onPointerDown={card && pegar ? pegar(card.id, v.chave) : undefined}>
            <span className="el-slot-pos" title={tx.posicao(v.posicao)}>
              <abbr aria-hidden>{v.posicao}</abbr>
              <span>{tx.posicao(v.posicao)}</span>
            </span>
            {card ? (
              <span key={card.id} className="el-slot-art">
                {card.imageUrl ? <img src={mediaUrl(card.imageUrl)} alt="" draggable={false} /> : null}
              </span>
            ) : <span className="el-slot-plus" aria-hidden>+</span>}
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

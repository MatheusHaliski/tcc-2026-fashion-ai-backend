"use client";
/** Gaveta de cartas de uma vaga: as cartas FLAIR da pessoa filtradas pela posição da vaga; escolher põe a carta. */
import { useEffect, useRef } from "react";
import { cn } from "@/components/ui";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";

interface Props {
  posicao: string;
  cartas: FlairCollectionCard[];
  foco: number;
  atual: string | null;
  onEscolher: (card: FlairCollectionCard) => void;
  onFechar: () => void;
}

export function ElencoDrawer({ posicao, cartas, foco, atual, onEscolher, onFechar }: Props) {
  const tx = useElencoText();
  const ref = useRef<HTMLElement>(null);
  // a gaveta abre embaixo do tabuleiro: rola até ela para as cartas aparecerem inteiras (antes ficavam abaixo da dobra)
  useEffect(() => { ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [posicao]);
  return (
    <section ref={ref} className="el-drawer" role="dialog" aria-modal="false" aria-labelledby="el-drawer-title" data-testid="elenco-drawer">
      <div className="n3d-objective-head">
        <h2 id="el-drawer-title" className="type-label">{tx.t("flair3d.elencos.drawer.title", { pos: tx.posicao(posicao) })}</h2>
        <button type="button" className="btn btn-sm" onClick={onFechar}>{tx.t("flair3d.elencos.drawer.close")}</button>
      </div>
      <p className="type-caption text-muted">{tx.t("flair3d.elencos.drawer.hypeNote")}</p>
      {cartas.length === 0 ? (
        <p className="n3d-empty">{tx.t("flair3d.elencos.drawer.empty")}</p>
      ) : (
        <div className="n3d-grid">
          {cartas.map((c, i) => (
            <button key={c.id} type="button" className={cn("n3d-res", i === foco && "is-focus", atual === c.id && "is-on")} aria-pressed={atual === c.id}
              aria-label={tx.t("flair3d.elencos.drawer.place", { nome: c.name })} onClick={() => onEscolher(c)}>
              <FlairGameCard card={c} size="sm" flip={false} interactive={false} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

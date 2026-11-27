"use client";
/**
 * Régua de vagas do look, entre o palco e o deck: uma casa por vaga (parte de cima, parte de baixo, calçado,
 * acessório, peça inteira) com a miniatura da carta vestida. Tocar numa casa filtra o deck para aquela vaga; tocar de
 * novo tira o filtro. No resultado, as cartas que pontuaram brilham uma a uma, com os pontos de cada uma.
 */
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoCard } from "@/components/flair/nucleos/nucleo-card";
import { NucleoIcon } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { ResourceTab } from "@/lib/flair/nucleos/selection";

export interface BrilhoDaVaga {
  /** ordem em que a carta brilha (0, 1, 2...) */
  ordem: number;
  /** texto dos pontos ou do efeito da carta (já traduzido) */
  texto: string;
}

interface Props {
  vagas: { aba: number; tab: ResourceTab }[];
  /** cartas vestidas por vaga */
  vestidas: Record<string, string>;
  cards: FlairCollectionCard[];
  /** vaga que filtra o deck (null = sem filtro) */
  vaga: string | null;
  onVaga: (id: string) => void;
  /** na ação e no resultado a régua só mostra o look */
  bloqueada?: boolean;
  /** cartas que pontuaram (resultado), por vaga */
  brilho?: Record<string, BrilhoDaVaga>;
}

export function NucleoSlotRuler({ vagas, vestidas, cards, vaga, onVaga, bloqueada = false, brilho }: Props) {
  const tx = useNucleoText();
  if (vagas.length === 0) return null;
  return (
    <div className="n3d-ruler" role="group" aria-label={tx.t("flair3d.ui.ruler.title")} data-testid="nucleo-slot-ruler">
      {vagas.map(({ tab }) => {
        const card = cards.find((c) => c.id === vestidas[tab.id]);
        const nome = tx.aba(tab);
        const luz = brilho?.[tab.id];
        const rotulo = card ? tx.t("flair3d.ui.ruler.filled", { vaga: nome, nome: card.name }) : tx.t("flair3d.ui.ruler.empty", { vaga: nome });
        const estilo = luz ? ({ "--n3d-ordem": luz.ordem } as CSSProperties) : undefined;
        return (
          <button
            key={tab.id}
            type="button"
            className={cn("n3d-slot", card && "is-filled", vaga === tab.id && "is-active", luz && "is-glow")}
            style={estilo}
            aria-pressed={vaga === tab.id}
            aria-label={rotulo}
            title={rotulo}
            disabled={bloqueada}
            data-slot={tab.id}
            onClick={() => onVaga(tab.id)}
          >
            {card ? <NucleoCard card={card} tamanho="mini" /> : <NucleoIcon name={tab.icone} size={18} />}
            {luz && <span className="n3d-slot-points tabular">{luz.texto}</span>}
          </button>
        );
      })}
    </div>
  );
}

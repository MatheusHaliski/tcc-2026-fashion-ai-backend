"use client";
/**
 * Carta do deck (5 por 7): só a foto da peça, o nível (cor da moldura), a posição (ícone) e o efeito neste jogo (um
 * selo curto). Nome, marca e Hype aparecem na carta ampliada. A mesma carta, sem selo, é a miniatura da régua de vagas.
 */
import { label } from "@/lib/api/taxonomy";
import { defaultGarmentColor } from "@/lib/catalog/default-garment";
import { pieceImageUrl } from "@/lib/pieces/piece-image";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoIcon } from "@/components/flair/nucleos/nucleo-icons";
import type { AbaIcone } from "@/lib/flair/nucleos/types";

const ICONE: Record<string, AbaIcone> = { SUP: "sup", INF: "inf", CAL: "cal", ACE: "ace", VES: "ves" };

interface Props {
  card: FlairCollectionCard;
  /** "deck" = carta da fileira; "mini" = miniatura da régua de vagas */
  tamanho?: "deck" | "mini";
  /** texto do selo do efeito (já traduzido); null = sem selo. Com mais de um efeito, um por linha ("\n") */
  selo?: string | null;
  /** selo cinza: a carta não pontua neste jogo */
  semEfeito?: boolean;
  /** texto do selo "em uso" quando a carta já está vestida */
  emUso?: string | null;
}

export function NucleoCard({ card, tamanho = "deck", selo = null, semEfeito = false, emUso = null }: Props) {
  // a cor cadastrada à vista na carta (auditoria 3: as dicas pediam cor e a carta não a mostrava)
  const cor = card.tags?.colors?.[0];
  const classe = cn("n3d-card", `is-${tamanho}`, `tier-${card.tier.toLowerCase()}`, card.rare && "is-rare");
  return (
    <span className={classe} data-tier={card.tier}>
      <span className="n3d-card-photo">
        {card.imageUrl ? <img src={pieceImageUrl({ imageUrl: card.imageUrl, category: card.category, subcategory: card.subcategory, color: card.tags?.colors?.[0] })} alt="" loading="lazy" decoding="async" /> : null}
      </span>
      {tamanho === "deck" && (
        <span className="n3d-card-pos" aria-hidden>
          <NucleoIcon name={ICONE[card.position] ?? "ace"} size={14} />
        </span>
      )}
      {tamanho === "deck" && cor && (
        <span className="n3d-card-cor" data-cor={cor} title={label(cor)}>
          <i style={{ background: defaultGarmentColor(null, cor) }} aria-hidden />
          {label(cor)}
        </span>
      )}
      {emUso && <span className="n3d-card-inuse">{emUso}</span>}
      {selo && <span className={cn("n3d-card-fx", semEfeito && "is-none", selo.includes("\n") && "is-todos")}>{selo}</span>}
    </span>
  );
}

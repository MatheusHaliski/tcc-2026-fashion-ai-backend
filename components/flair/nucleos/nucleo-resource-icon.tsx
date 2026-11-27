"use client";
/**
 * Um item da fileira de recursos: carta FLAIR (carta compacta 5 por 7 com o selo do efeito), amostra de cor,
 * acabamento, família de maquiagem ou opção de resposta. Selecionado (foco do controle) sobe 12 px e ganha contorno
 * na cor da marca; vestido ou aplicado mostra o selo "em uso"; a carta que não cabe na vaga escolhida fica com 40% de
 * opacidade e continua tocável para dizer o motivo.
 */
import type { PointerEvent } from "react";
import { cn } from "@/components/ui";
import { NucleoCard } from "@/components/flair/nucleos/nucleo-card";
import type { ResourceItem } from "@/lib/flair/nucleos/selection";

interface Props {
  item: ResourceItem;
  rotulo: string;
  foco: boolean;
  aplicado: boolean;
  onClick: () => void;
  /** false = a carta não é da vaga escolhida na régua */
  cabe?: boolean;
  /** selo do efeito da carta neste jogo (já traduzido) */
  selo?: string | null;
  semEfeito?: boolean;
  /** texto do selo "em uso" */
  emUso?: string;
  /** toque longo (carta ampliada) */
  toque?: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
  };
  bloqueado?: boolean;
}

export function NucleoResourceIcon({ item, rotulo, foco, aplicado, onClick, cabe = true, selo, semEfeito, emUso, toque, bloqueado }: Props) {
  const classe = cn("n3d-res", `n3d-res-${item.kind}`, foco && "is-focus", aplicado && "is-on", !cabe && "is-nofit");
  let corpo;
  if (item.kind === "carta") {
    corpo = <NucleoCard card={item.card} selo={selo} semEfeito={semEfeito} emUso={aplicado ? emUso : null} />;
  } else if (item.kind === "cor" || item.kind === "familia") {
    corpo = <span className="n3d-swatch" style={{ background: item.hex }} aria-hidden />;
  } else if (item.kind === "acabamento" || item.kind === "maqAcabamento") {
    corpo = <span className={cn("n3d-swatch", "n3d-finish", `is-${item.codigo.toLowerCase()}`)} aria-hidden />;
  } else {
    corpo = null;
  }
  return (
    <button
      type="button"
      className={classe}
      aria-pressed={aplicado}
      aria-label={rotulo}
      title={rotulo}
      disabled={bloqueado}
      data-focus={foco || undefined}
      data-fit={cabe ? undefined : "no"}
      onClick={onClick}
      {...toque}
    >
      {corpo}
      {item.kind !== "carta" && <span className="n3d-res-label">{rotulo}</span>}
    </button>
  );
}

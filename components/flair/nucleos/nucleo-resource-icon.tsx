"use client";
/**
 * Um item da janela de recursos: carta FLAIR (a mesma carta das coleções, só a frente), amostra de cor, acabamento,
 * família de maquiagem ou opção de resposta. Em foco (navegação por controle) ganha contorno; aplicado, a marca ✓.
 */
import { cn } from "@/components/ui";
import { FlairGameCard } from "@/components/flair/flair-game-card";
import type { ResourceItem } from "@/lib/flair/nucleos/selection";

export function NucleoResourceIcon({ item, rotulo, foco, aplicado, onClick }: { item: ResourceItem; rotulo: string; foco: boolean; aplicado: boolean; onClick: () => void }) {
  const classe = cn("n3d-res", `n3d-res-${item.kind}`, foco && "is-focus", aplicado && "is-on");
  let corpo;
  if (item.kind === "carta") {
    corpo = <FlairGameCard card={item.card} size="sm" flip={false} interactive={false} />;
  } else if (item.kind === "cor" || item.kind === "familia") {
    corpo = <span className="n3d-swatch" style={{ background: item.hex }} aria-hidden />;
  } else if (item.kind === "acabamento" || item.kind === "maqAcabamento") {
    corpo = <span className={cn("n3d-swatch", "n3d-finish", `is-${item.codigo.toLowerCase()}`)} aria-hidden />;
  } else {
    corpo = null;
  }
  return (
    <button type="button" className={classe} aria-pressed={aplicado} aria-label={rotulo} title={rotulo} onClick={onClick} data-focus={foco || undefined}>
      {corpo}
      {item.kind !== "carta" && <span className="n3d-res-label">{rotulo}</span>}
    </button>
  );
}

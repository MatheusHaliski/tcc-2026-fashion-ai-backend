import type { CSSProperties } from "react";
import { rarityOf, suggestStyle, type PieceTraits, type RarityInput } from "@/lib/fashion-style";

/** Selo de raridade + estética no canto da carta (assinatura visual recorrente). Não intercepta cliques. */
export function FashionCardSeal({ piece, rarity }: { piece: PieceTraits; rarity: RarityInput }) {
  const r = rarityOf(rarity);
  const s = suggestStyle(piece);
  const style = { "--seal-border": r.border, "--seal-glow": r.glow, "--seal-accent": s.glow, position: "absolute", right: 8, bottom: 8, pointerEvents: "none", display: "flex", gap: 6, alignItems: "center", padding: "2px 8px", borderRadius: 999, border: `1px solid ${r.border}`, boxShadow: `0 0 10px ${r.glow}`, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 10, fontWeight: 700 } as CSSProperties;
  return (
    <div className="fashion-card-seal" style={style} data-rarity={r.id} data-style={s.id} aria-label={`${r.label} · ${s.name}`}>
      <span aria-hidden style={{ color: r.border }}>{"★".repeat(r.stars)}</span>
      <span>{s.name}</span>
    </div>
  );
}

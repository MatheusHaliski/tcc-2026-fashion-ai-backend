"use client";
import { mediaUrl } from "@/lib/api/client";
import type { StoreItem } from "./wardrobe-creator-model";

/** Amostra do item na loja: faixas com as cores/materiais dos blocos + logo/arte da marca. */
export function StoreSwatch({ item, className = "h-20" }: { item: StoreItem; className?: string }) {
  const parts = item.kind === "WARDROBE" && item.bundle?.length ? item.bundle.map((b) => ({ k: b.slotType, color: b.finish?.color ?? "#ccc", metal: (b.finish?.metalness ?? 0) > 0.8 })) : [{ k: item.slotType, color: item.finish?.color ?? "#ccc", metal: (item.finish?.metalness ?? 0) > 0.8 }];
  const logo = item.logoUrl ?? item.creator?.logoUrl ?? null;
  return (
    <div className={`relative flex overflow-hidden rounded ${className}`} style={item.artUrl ? { backgroundImage: `url(${mediaUrl(item.artUrl)})`, backgroundSize: "cover" } : undefined}>
      {!item.artUrl && parts.map((p) => <span key={p.k} className="flex-1" style={{ background: p.metal ? `linear-gradient(135deg, ${p.color}, #ffffff 45%, ${p.color})` : item.finish?.material === "VIDRO" ? `${p.color}99` : p.color }} title={p.k} />)}
      {logo && <img src={mediaUrl(logo)} alt="" className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-white object-contain p-0.5 shadow" />}
      {item.labelText && <span className="absolute left-1 top-1 rounded bg-black/50 px-1 type-caption text-white">{item.labelText}</span>}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { CbcSlotResult } from "@/lib/flair/cbc";
import type { GameSceneCredit, GlassSlot, SceneFx } from "@/lib/flair/games";
import { useGameLabels } from "@/components/flair/games/game-card";
import { PhotoSceneHit } from "@/components/flair/games/photo-scene-hit";

export interface PhotoPin { key: string; n: number; x: number; y: number; label: string; fx: SceneFx; size: number }

/**
 * Cenário fotográfico do Glass Empire: uma fotografia real do ambiente (loja, vitrine, camarim, boate, palco, camarote…)
 * que reage às cartas. A cena começa apagada e dessaturada e ganha luz e cor à medida que as vagas são preenchidas; cada
 * carta é uma {@link PhotoSceneHit} na posição da vaga, com o efeito e a Aura Hype que o servidor calculou (glass.slots);
 * a montagem perfeita acende a luz dourada com um reflexo de lente. A arte é decorativa (aria-hidden): as vagas são os
 * botões e a última inserção é anunciada numa região viva. O crédito da fotografia (licença livre) fica sob a cena.
 */
export function PhotoSceneArt({ photo, credit, pins, placed, results, glass, perfect }: {
  photo: string; credit?: GameSceneCredit | null; pins: PhotoPin[]; placed: Record<string, FlairCollectionCard | undefined>;
  results?: CbcSlotResult[]; glass?: GlassSlot[]; perfect?: boolean;
}) {
  const src = mediaUrl(photo) ?? photo;
  const bySlot = new Map((results ?? []).map((r) => [r.slot, r]));
  const byGlass = new Map((glass ?? []).map((g) => [g.slot, g]));
  const filled = pins.filter((p) => placed[p.key]);
  const latest = useLatest(placed);
  const life = pins.length ? filled.length / pins.length : 0;
  return (
    <>
      <div className={cn("gep", perfect && "is-perfect", filled.length > 0 && "is-awake")} style={{ "--gep-life": life.toFixed(3), "--gep-crowd": Math.max(0.35, Math.min(1, 1 / Math.sqrt(Math.max(1, filled.length)))).toFixed(2) } as CSSProperties} aria-hidden>
        <img className="gep-photo" src={src} alt="" decoding="async" />
        <span className="gep-grade" />
        {filled.map((p) => (
          <PhotoSceneHit key={`${p.key}:${placed[p.key]!.id}`} photo={src} x={p.x} y={p.y} size={p.size} fx={p.fx} card={placed[p.key]!} label={p.label}
            result={bySlot.get(p.key)} glass={byGlass.get(p.key)} latest={p.key === latest} />
        ))}
        <span className="gep-vignette" />
        {perfect && <span className="gep-flare" />}
        <span className="gep-pins">{pins.map((p) => <b key={p.key} className={cn("gep-pin", placed[p.key] && "is-lit")} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.n}</b>)}</span>
      </div>
      <Announce pin={pins.find((p) => p.key === latest)} glass={latest ? byGlass.get(latest) : undefined} perfect={perfect} />
      {credit && <PhotoCredit credit={credit} />}
    </>
  );
}

/** A vaga que recebeu carta por último (para abrir a legenda dela e anunciar a inserção). */
function useLatest(placed: Record<string, FlairCollectionCard | undefined>): string | null {
  const prev = useRef<Record<string, string | undefined>>({});
  const [latest, setLatest] = useState<string | null>(null);
  const signature = Object.entries(placed).map(([k, c]) => `${k}:${c?.id ?? ""}`).join("|");
  useEffect(() => {
    const now: Record<string, string | undefined> = Object.fromEntries(Object.entries(placed).map(([k, c]) => [k, c?.id]));
    const changed = Object.keys(now).find((k) => now[k] && now[k] !== prev.current[k]);
    if (changed) setLatest(changed);
    else if (latest && !now[latest]) setLatest(null);
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return latest;
}

function Announce({ pin, glass, perfect }: { pin?: PhotoPin; glass?: GlassSlot; perfect?: boolean }) {
  const { t } = useI18n(); const L = useGameLabels();
  const text = pin && glass ? t("games.scene.announce", { slot: pin.label, effect: L.effect(glass.effect.kind), bonus: glass.effect.bonus, from: L.band(glass.hypeBand), to: L.band(glass.matchBand) }) : "";
  return <p className="sr-only" role="status" aria-live="polite">{text}{perfect ? ` ${t("games.scene.perfect")}` : ""}</p>;
}

function PhotoCredit({ credit }: { credit: GameSceneCredit }) {
  const { t } = useI18n();
  return (
    <p className="gep-credit">
      {t("games.scene.credit", { title: credit.title || "—", creator: credit.creator || "—", license: credit.license })}{" "}
      {credit.source && <a href={credit.source} target="_blank" rel="noopener noreferrer">{t("games.scene.source")}</a>}
    </p>
  );
}

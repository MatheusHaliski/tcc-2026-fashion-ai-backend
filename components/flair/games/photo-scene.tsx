"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { CbcSlotResult } from "@/lib/flair/cbc";
import type { GameSceneCredit, Flair3dSlot, SceneFx } from "@/lib/flair/games";
import { useGameLabels } from "@/components/flair/games/game-card";
import { PhotoSceneHit } from "@/components/flair/games/photo-scene-hit";
import { PhotoSceneLinks } from "@/components/flair/games/photo-scene-links";

export interface PhotoPin { key: string; n: number; x: number; y: number; label: string; fx: SceneFx; size: number }

/**
 * Cenário fotográfico do FLAIR 3D MAKE UP: uma fotografia real do ambiente (loja, vitrine, camarim, boate, palco, camarote…)
 * que reage às cartas. A cena começa apagada e dessaturada e ganha luz e cor à medida que as vagas são preenchidas; cada
 * carta é uma {@link PhotoSceneHit} na posição da vaga, com o efeito e a Aura Hype que o servidor calculou (flair3d.slots);
 * a montagem perfeita acende a luz dourada com um reflexo de lente. A arte é decorativa (aria-hidden): as vagas são os
 * botões e a última inserção é anunciada numa região viva. O crédito da fotografia (licença livre) fica sob a cena.
 */
export function PhotoSceneArt({ photo, credit, pins, placed, results, flair3d, perfect }: {
  photo: string; credit?: GameSceneCredit | null; pins: PhotoPin[]; placed: Record<string, FlairCollectionCard | undefined>;
  results?: CbcSlotResult[]; flair3d?: Flair3dSlot[]; perfect?: boolean;
}) {
  const src = mediaUrl(photo) ?? photo;
  const bySlot = new Map((results ?? []).map((r) => [r.slot, r]));
  const byFlair3d = new Map((flair3d ?? []).map((g) => [g.slot, g]));
  const filled = pins.filter((p) => placed[p.key]);
  const latest = useLatest(placed);
  const life = pins.length ? filled.length / pins.length : 0;
  return (
    <>
      <div className={cn("gep", perfect && "is-perfect", filled.length > 0 && "is-awake")} style={{ "--gep-life": life.toFixed(3), "--gep-crowd": Math.max(0.35, Math.min(1, 1 / Math.sqrt(Math.max(1, filled.length)))).toFixed(2) } as CSSProperties} aria-hidden>
        <img className="gep-photo" src={src} alt="" decoding="async" />
        <span className="gep-grade" />
        <PhotoSceneLinks pins={pins} results={results} flair3d={flair3d} filledKeys={new Set(filled.map((p) => p.key))} />
        {filled.map((p) => (
          <PhotoSceneHit key={`${p.key}:${placed[p.key]!.id}`} photo={src} x={p.x} y={p.y} size={p.size} fx={p.fx} card={placed[p.key]!} label={p.label}
            result={bySlot.get(p.key)} flair3d={byFlair3d.get(p.key)} latest={p.key === latest} />
        ))}
        <span className="gep-vignette" />
        {perfect && <span className="gep-flare" />}
        <span className="gep-pins">{pins.map((p) => <b key={p.key} className={cn("gep-pin", placed[p.key] && "is-lit")} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.n}</b>)}</span>
      </div>
      <Announce pin={pins.find((p) => p.key === latest)} flair3d={latest ? byFlair3d.get(latest) : undefined} perfect={perfect} />
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

function Announce({ pin, flair3d, perfect }: { pin?: PhotoPin; flair3d?: Flair3dSlot; perfect?: boolean }) {
  const { t } = useI18n(); const L = useGameLabels();
  const text = pin && flair3d ? t("games.scene.announce", { slot: pin.label, effect: L.effect(flair3d.effect.kind), bonus: flair3d.effect.bonus, from: L.band(flair3d.hypeBand), to: L.band(flair3d.matchBand) }) : "";
  return <p className="sr-only" role="status" aria-live="polite">{text}{perfect ? ` ${t("games.scene.perfect")}` : ""}</p>;
}

/** Crédito da fotografia (licença livre) sob a cena; também usado no palco dos confrontos. */
export function PhotoCredit({ credit }: { credit: GameSceneCredit }) {
  const { t } = useI18n();
  return (
    <p className="gep-credit">
      {t("games.scene.credit", { title: credit.title || "—", creator: credit.creator || "—", license: credit.license })}{" "}
      {credit.source && <a href={credit.source} target="_blank" rel="noopener noreferrer">{t("games.scene.source")}</a>}
    </p>
  );
}

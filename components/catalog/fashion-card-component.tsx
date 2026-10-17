"use client";
import { useRef, useEffect, type CSSProperties, type PointerEvent } from "react";
import type { FashionCardData } from "@/lib/catalog/fashion-card";
import { clampStat } from "@/lib/catalog/fashion-card";

import { useI18n } from "@/lib/i18n/i18n";

const MAX_TILT = 12;

/** Card do catálogo; com auraType 'IMPERSONATION' mostra o loop do usuário vestindo a peça, com aura Out of Bounds e tilt 3D. */
export function FashionCardComponent({ card }: { card: FashionCardData }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const impersonation = card.auraType === "IMPERSONATION" && !!card.impersonationData?.renderedCardMediaUrl;
  const media = impersonation ? card.impersonationData!.renderedCardMediaUrl : card.imageUrl;
  const isVideo = impersonation && /\.(mp4|webm)(\?|$)/i.test(media);

  const tilt = (x: number, y: number) => {   // x,y em -1..1
    const el = ref.current; if (!el) return;
    el.style.setProperty("--tilt-x", `${(-y * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * MAX_TILT).toFixed(2)}deg`);
  };
  const reset = () => tilt(0, 0);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tilt(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };

  useEffect(() => {   // giroscópio (mobile), só quando o navegador não exige permissão
    if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return;
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
    };
    window.addEventListener("deviceorientation", h);
    return () => window.removeEventListener("deviceorientation", h);
  }, []);

  const stats: [string, number][] = [
    [t("impersonation.stat.versatility"), card.stats.versatility], [t("impersonation.stat.hypeIndex"), card.stats.hypeIndex], [t("impersonation.stat.legacyScore"), card.stats.legacyScore],
  ];
  return (
    <div ref={ref} className={`fcard-aura fcard-rarity-${card.rarity.toLowerCase()}${impersonation ? " is-impersonation" : ""}`}
      data-aura-type={card.auraType} data-vfx={impersonation ? card.impersonationData!.powerVfx : undefined}
      onPointerMove={onMove} onPointerLeave={reset} style={{ "--tilt-x": "0deg", "--tilt-y": "0deg" } as CSSProperties}>
      {impersonation && <div className="fcard-aura-glow" aria-hidden />}
      <div className="fcard-aura-media">
        {isVideo
          ? <video src={media} autoPlay loop muted playsInline aria-label={card.name} />
          : <img src={media} alt={card.name} />}
        {impersonation && <span className="fcard-aura-badge">{t("impersonation.title")}</span>}
        <div className="fcard-aura-overlay">
          <strong>{card.name}</strong>
          {stats.map(([k, v]) => (
            <div key={k} className="fcard-aura-stat"><span>{k}</span><i style={{ width: `${clampStat(v)}%` }} /><b>{clampStat(v)}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}

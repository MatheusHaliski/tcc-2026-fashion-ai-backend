"use client";
import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import type { CatalogProduct } from "@/lib/api/catalog";
import { clampStats, VFX_COLORS } from "@/lib/fashion-card";
import { RARITY_INFO, type Rarity } from "@/lib/fashion-style";

const MAX_TILT = 12;
const RARITY_KEY: Record<string, Rarity> = { COMMON: "COMMON", RARE: "RARE", LEGENDARY: "LEGENDARY", COLLAB_DROP: "LEGENDARY" };
const isVideo = (u: string) => /\.(mp4|webm)(\?|$)/i.test(u);

/** Fashion Card com 3D tilt (ponteiro e giroscópio) e Aura Impersonation: loop do usuário vestindo a peça. */
export function FashionCardComponent({ product }: { product: CatalogProduct }) {
  const ref = useRef<HTMLDivElement>(null);
  const card = product.fashionCard;
  const imp = card?.auraType === "IMPERSONATION" ? card.impersonationData : null;
  const media = imp?.renderedCardMediaUrl || null;
  const vfx = imp ? VFX_COLORS[imp.powerVfx] : null;
  const rarity = RARITY_INFO[RARITY_KEY[card?.rarity ?? "COMMON"]];
  const stats = card ? clampStats(card.stats) : null;

  const tilt = (x: number, y: number) => {   // x, y em -1..1
    const el = ref.current; if (!el) return;
    el.style.setProperty("--rx", `${(-y * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * MAX_TILT).toFixed(2)}deg`);
  };
  const reset = () => tilt(0, 0);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    tilt(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };

  useEffect(() => {   // giroscópio: só onde o navegador já libera o evento sem pedir permissão
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return;
    const needsPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    if (needsPermission) return;
    const on = (e: DeviceOrientationEvent) => tilt(Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45)), Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 45)));
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, []);

  const style = { "--rx": "0deg", "--ry": "0deg", "--aura": vfx?.glow ?? rarity.glow, "--accent": vfx?.accent ?? rarity.border, position: "relative", perspective: 800, overflow: "visible" } as CSSProperties;
  const photo = product.catalogImage ? undefined : product.imageUrl;

  return (
    <div ref={ref} className="fashion-card" style={style} data-aura-type={card?.auraType ?? "STATIC"} data-rarity={card?.rarity ?? "COMMON"} onPointerMove={onMove} onPointerLeave={reset}>
      {imp && <div className="fashion-card-aura-oob" aria-hidden data-vfx={imp.powerVfx} style={{ position: "absolute", inset: -24, pointerEvents: "none", zIndex: 0, borderRadius: 32, background: `radial-gradient(closest-side, var(--aura), transparent 70%)`, filter: "blur(14px)", opacity: .7 }} />}
      <div style={{ position: "relative", zIndex: 1, transform: "rotateX(var(--rx)) rotateY(var(--ry))", transformStyle: "preserve-3d", transition: "transform .12s ease-out", border: `2px solid ${rarity.border}`, borderRadius: 16, boxShadow: `0 0 18px ${rarity.glow}`, background: "#0b0b10", overflow: "visible" }}>
        <div className="fashion-card-media" style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4" }}>
          {media ? (
            isVideo(media)
              ? <video src={media} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <img src={media} alt={product.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : photo ? <img src={photo} alt={product.productName} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
        </div>
        {imp && <span className="fashion-card-badge" style={{ position: "absolute", top: 8, left: 8, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: "#000", background: "var(--accent)" }}>Aura Impersonation{vfx ? ` · ${vfx.label}` : ""}</span>}
        <div className="fashion-card-info" style={{ padding: 8, color: "#fff" }}>
          <strong style={{ fontSize: 13 }}>{product.productName}</strong>
          <div style={{ fontSize: 10, color: rarity.border }}>{"★".repeat(rarity.stars)} {card?.rarity === "COLLAB_DROP" ? "Collab Drop" : rarity.label}</div>
          {stats && (
            <dl className="fashion-card-stats" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px", fontSize: 10, margin: "6px 0 0" }}>
              <dt>Versatilidade</dt><dd style={{ margin: 0 }}>{stats.versatility}</dd>
              <dt>Hype</dt><dd style={{ margin: 0 }}>{stats.hypeIndex}</dd>
              <dt>Legado</dt><dd style={{ margin: 0 }}>{stats.legacyScore}</dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

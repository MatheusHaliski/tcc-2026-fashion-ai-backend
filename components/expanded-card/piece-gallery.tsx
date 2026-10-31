"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { CatalogCardImage } from "@/lib/api/catalog";
import { MediaImage } from "@/components/media-image";

import { CatalogPhoto, photoAspect } from "@/components/catalog/catalog-photo";

import { useI18n } from "@/lib/i18n/i18n";

import { backdropGradient } from "@/components/studio";

export type Slide = { alternatives?: (string | null | undefined)[]; key: string; src: string; alt: string; caption: string; fit: "contain" | "cover"; backdrop?: { center: string; edge: string }; crop?: CatalogCardImage | null };

export function PieceGallery({ slides, onOpen, overlay }: { slides: Slide[]; onOpen: (i: number) => void; overlay?: ReactNode }) {
  const { t } = useI18n();
  const [i, setI] = useState(0); const [bg, setBg] = useState<string | undefined>(undefined);
  const slideRef = useRef<HTMLButtonElement>(null); const imgRef = useRef<HTMLImageElement>(null);
  const n = slides.length; const k = Math.min(i, n - 1); const s = slides[k];
  const measure = () => {
    const box = slideRef.current, img = imgRef.current; const bd = s?.backdrop;
    if (!box || !img || !bd || !img.naturalWidth) { setBg(undefined); return; }
    const W = box.clientWidth, H = box.clientHeight, sc = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    setBg(backdropGradient({ left: (W - w) / 2, top: (H - h) / 2, width: w, height: h }, bd.center, bd.edge));
  };
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); });
  // a lista de fundos chega depois da foto: recalcula o degradê quando as cores do estúdio mudam
  useEffect(measure, [k, s?.backdrop?.center, s?.backdrop?.edge]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="pd-slide" />;
  return (
    <div className="pd-gallery" role="group" aria-roledescription={t("pieceDetail.carrossel")} aria-label={t("pieceDetail.fotos")}>
      <button ref={slideRef} type="button" className={s.crop ? "pd-slide is-catalog-crop" : "pd-slide"} style={{ ...(s.backdrop ? { background: bg ?? s.backdrop.edge } : {}), ...(s.crop ? { aspectRatio: photoAspect(s.crop.aspect) } : {}) }} onClick={() => onOpen(k)} aria-label={t("pieceDetail.ampliar", { name: s.alt })}>
        {s.crop ? <CatalogPhoto requiredFrame image={s.crop} alternatives={s.alternatives} alt="" /> : <MediaImage ref={imgRef} src={s.src} fallbackSources={s.alternatives} alt="" className={s.fit === "contain" ? "is-contain" : "is-cover"} onLoad={measure} />}
        {overlay}
      </button>
      {n > 1 && (
        <>
          <span className="pd-slide-tag" aria-hidden>{s.caption}</span>
          <button type="button" className="pd-nav is-prev" aria-label={t("pieceDetail.anterior")} onClick={() => setI((k - 1 + n) % n)}>‹</button>
          <button type="button" className="pd-nav is-next" aria-label={t("pieceDetail.proxima")} onClick={() => setI((k + 1) % n)}>›</button>
          <div className="pd-dots">{slides.map((x, j) => <button key={x.key} type="button" className="pd-dot" aria-current={j === k ? "true" : undefined} aria-label={t("pieceDetail.foto_n", { n: j + 1, total: n, name: x.caption })} onClick={() => setI(j)} />)}</div>
        </>
      )}
    </div>
  );
}

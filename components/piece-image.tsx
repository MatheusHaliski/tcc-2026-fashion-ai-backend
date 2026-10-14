"use client";
import { useEffect, useState } from "react";
import { isImageLoaded, preloadFirst } from "@/lib/image-preload";
import { mediaUrl } from "@/lib/api/client";

type Sources = readonly (string | null | undefined)[];
const resolve = (sources: Sources) => [...new Set(sources.map((s) => mediaUrl(s)).filter((u): u is string => !!u))];

/** True once every list has settled (loaded or exhausted its fallbacks), so a grid can reveal its images together. */
export function useImageBatch(lists: readonly Sources[]) {
  const key = lists.map((l) => resolve(l).join(",")).join("|");
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(lists.map((l) => preloadFirst(resolve(l)))).then(() => { if (live) setDone(key); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return done === key;
}

/** Fixed-size box: skeleton until the image is decoded, then fade-in. Falls back thumbnail -> original -> placeholder. */
export function PieceImage({ sources, alt = "", className = "", priority = false, hold = false }: { sources: Sources; alt?: string; className?: string; priority?: boolean; hold?: boolean }) {
  const urls = resolve(sources);
  const key = urls.join(",");
  const [state, setState] = useState<{ key: string; src: string | null } | null>(() => {
    const hit = urls.find(isImageLoaded);
    return hit ? { key, src: hit } : null;
  });
  useEffect(() => {
    let live = true;
    preloadFirst(urls).then((src) => { if (live) setState({ key, src }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const settled = state?.key === key;
  const src = settled ? state.src : null;
  const shown = settled && !hold;
  return (
    <span className={`piece-image relative block overflow-hidden ${className}`} data-state={!shown ? "loading" : src ? "ready" : "fallback"}>
      {!shown && <span aria-hidden className="piece-image-skeleton absolute inset-0 animate-pulse bg-black/5" />}
      {shown && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} draggable={false} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300 opacity-100" />
      )}
    </span>
  );
}

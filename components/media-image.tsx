"use client";
import Image from "next/image";
import { useEffect, useState, type ImgHTMLAttributes, type Ref } from "react";
import { warmMediaImage } from "@/lib/media-memory-cache";
import { mediaUrl } from "@/lib/api/client";

/** Static assets can use Next's responsive derivatives. Authenticated/signed images keep their original transport. */
function MediaImageAttempt({ src, fallbackSources = [], srcSet, width = 640, height = 800, sizes = "(max-width: 639px) 50vw, 320px", loading = "lazy", ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; fallbackSources?: (string | null | undefined)[]; ref?: Ref<HTMLImageElement> }) {
  const sources = [...new Set([src, ...fallbackSources].map(mediaUrl).filter((url): url is string => !!url))];
  const [attempt, setAttempt] = useState(0);
  const current = sources[attempt];
  useEffect(()=>{ if(current) warmMediaImage(current); },[current]);
  if (!current) return null;
  const onError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (event) => { props.onError?.(event); setAttempt((value) => value + 1); };
  const effectiveSrcSet = attempt === 0 ? srcSet : undefined;
  const local = /^\/(?:assets_[^/]+|_derived|aura_sem_GIF|bg_chrome|presets_recomendados)\//.test(current) && !current.includes("?");
  if (local && !effectiveSrcSet && !current.endsWith(".svg")) {
    return <Image {...props} key={current} src={current} onError={onError} alt={props.alt ?? ""} width={Number(width)} height={Number(height)} sizes={sizes} loading={loading} />;
  }
  return <img {...props} key={current} src={current} onError={onError} srcSet={effectiveSrcSet} width={width} height={height} sizes={sizes} loading={loading} decoding="async" />;
}

/** Reset failed candidates when this image or its alternatives change. */
export function MediaImage(props: ImgHTMLAttributes<HTMLImageElement> & { src: string; fallbackSources?: (string | null | undefined)[]; ref?: Ref<HTMLImageElement> }) {
  return <MediaImageAttempt key={[props.src, ...(props.fallbackSources ?? [])].join("|")} {...props} />;
}

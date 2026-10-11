"use client";
import Image from "next/image";
import type { ImgHTMLAttributes } from "react";

/** Static assets can use Next's responsive derivatives. Authenticated/signed images keep their original transport. */
export function MediaImage({ src, srcSet, width = 640, height = 800, sizes = "(max-width: 639px) 50vw, 320px", loading = "lazy", ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const local = /^\/(?:assets_[^/]+|_derived|aura_sem_GIF|bg_chrome|presets_recomendados)\//.test(src) && !src.includes("?");
  if (local && !srcSet && !src.endsWith(".svg")) {
    return <Image {...props} src={src} alt={props.alt ?? ""} width={Number(width)} height={Number(height)} sizes={sizes} loading={loading} />;
  }
  return <img {...props} src={src} srcSet={srcSet} width={width} height={height} sizes={sizes} loading={loading} decoding="async" />;
}

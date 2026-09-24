"use client";
import { useState } from "react";
import { useBrandLogo } from "@/lib/brand-logos";

/**
 * Logo de marca em qualquer tela. A imagem vem do buscador de logos (internet → storage próprio). Enquanto a busca
 * não termina, ou quando nada confiável foi achado, aparece o monograma com as iniciais.
 */
export function BrandLogo({ name, src, size = 28, shape = "round", withName = false, className = "", title }: {
  name: string | null | undefined; src?: string | null; size?: number; shape?: "round" | "square"; withName?: boolean; className?: string; title?: string;
}) {
  const { url, info, monogram, onKnownError, fromKnown } = useBrandLogo(name, src);
  const [broken, setBroken] = useState(false);
  if (!name) return null;
  const show = url && !broken;
  const tip = title ?? (info?.source && info.source !== "MONOGRAMA" ? `${name} · logo via ${SOURCE[info.source] ?? info.source}` : name);
  return (
    <span className={`brand-logo ${shape === "square" ? "is-square" : ""} ${className}`} title={tip}>
      <span className="brand-logo-mark" style={{ width: size, height: size, ...(show ? {} : { background: monogram.color, fontSize: Math.max(9, size * 0.4) }) }} aria-hidden={withName}>
        {show ? <img src={url} alt={withName ? "" : `logo ${name}`} loading="lazy" onError={() => (fromKnown ? onKnownError() : setBroken(true))} />
          : <b>{monogram.initials}</b>}
      </span>
      {withName && <span className="brand-logo-name">{name}</span>}
    </span>
  );
}
const SOURCE: Record<string, string> = { WIKIDATA: "Wikidata/Wikimedia", IA_BUSCA_WEB: "busca na web (IA)", FAVICON_SITE: "site oficial", PERFIL_MARCA: "perfil da marca", MANUAL: "admin" };

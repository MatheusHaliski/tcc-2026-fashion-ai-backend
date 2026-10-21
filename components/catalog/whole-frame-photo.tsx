"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import { TOTAL_FRAME, fitWhole, isLightBackground, type WholeFrame } from "@/lib/photo-framing";

const dimensions = new Map<string, { w: number; h: number }>();

/**
 * Total frame: a foto inteira posicionada para a peça caber no quadro 3:4 com margem igual, sobre fundo liso e com
 * sombra de apoio. Foto de fundo claro se funde ao fundo do quadro (multiply); fundo de outra cor vira o fundo do quadro.
 * Sem as medidas da foto no metadado, mede ao carregar. Erro de carga → `onFail` (quem chama volta ao enquadramento de sempre).
 */
export function WholeFramePhoto({ frame, alt, className, onFail }: { frame: WholeFrame; alt: string; className?: string; onFail?: () => void }) {
  const known = frame.width && frame.height ? { w: frame.width, h: frame.height } : dimensions.get(frame.url) ?? null;
  const [size, setSize] = useState(known);
  useEffect(() => { setSize(frame.width && frame.height ? { w: frame.width, h: frame.height } : dimensions.get(frame.url) ?? null); }, [frame.url, frame.width, frame.height]);
  const fit = size ? fitWhole(frame.box, size.w, size.h, frame.truncated) : null;
  const blend = !frame.alpha && isLightBackground(frame.background);
  const background = frame.alpha || blend || !frame.background ? TOTAL_FRAME.background : frame.background;
  const vars = { background, "--tf-floor": fit ? `${fit.floor}%` : undefined, "--tf-span": fit ? `${fit.span}%` : undefined } as CSSProperties;
  return (
    <span className={cn("catalog-photo is-whole", frame.alpha && "has-alpha", blend && "is-blend", fit && !fit.grounded && "has-floor", className)}
      style={vars} data-mode="whole">
      <img src={mediaUrl(frame.url)} alt={alt} loading="lazy" decoding="async"
        style={fit ? fit.style : { opacity: 0 }}
        onLoad={(e) => { if (!size) { const img = e.currentTarget; if (img.naturalWidth && img.naturalHeight) {
          const measured = { w: img.naturalWidth, h: img.naturalHeight };
          dimensions.set(frame.url, measured);
          if (dimensions.size > 256) dimensions.delete(dimensions.keys().next().value!);
          setSize(measured);
        } } }}
        onError={onFail} />
    </span>
  );
}

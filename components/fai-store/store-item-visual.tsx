"use client";
import type { CSSProperties } from "react";
import { CatalogPhoto } from "@/components/catalog/catalog-photo";
import { ACABAMENTO_HEX, COR_HEX } from "@/lib/acervo/opcoes";
import type { AcervoAcabamento, AcervoCor } from "@/lib/acervo/types";
import type { FaiStoreItem } from "@/lib/fai-store/api";

const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
const colors = (v: unknown, fallback: string[]) => (Array.isArray(v) && v.every((c) => typeof c === "string") && v.length ? (v as string[]) : fallback);

/** Paleta estável a partir do código quando o preset não traz cores (presets de Aura da FAI guardam só o modo). */
function seeded(code: string): string[] {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [`hsl(${h} 80% 62%)`, `hsl(${(h + 70) % 360} 75% 55%)`, `hsl(${(h + 160) % 360} 70% 45%)`];
}

function AuraSwatch({ item }: { item: FaiStoreItem }) {
  const palette = colors(item.visual?.palette, seeded(item.id));
  const style = { "--aura-a": palette[0], "--aura-b": palette[1] ?? palette[0], "--aura-c": palette[2] ?? palette[0] } as CSSProperties;
  return <div className="fai-store-aura" style={style}><span className="fai-store-aura-ring" /><span className="fai-store-aura-core" /></div>;
}

function Wardrobe({ visual }: { visual: Record<string, unknown> | null }) {
  const tone = COR_HEX[str(visual?.cor, "NOGUEIRA") as AcervoCor] ?? COR_HEX.NOGUEIRA;
  const handle = ACABAMENTO_HEX[str(visual?.puxadorAcabamento, "LATAO") as AcervoAcabamento] ?? ACABAMENTO_HEX.LATAO;
  const door = str(visual?.porta, "ABRIR");
  const glass = door === "VIDRO" || visual?.material === "VIDRO";
  const open = door === "SEM_PORTA";
  return (
    <svg viewBox="0 0 120 140" className="fai-store-svg" aria-hidden>
      <rect x="14" y="10" width="92" height="120" rx="3" fill={tone.base} stroke={tone.veio} strokeWidth="2" />
      {open ? <>
        <line x1="22" y1="34" x2="98" y2="34" stroke={handle} strokeWidth="3" />
        {[30, 44, 58, 72, 86].map((x) => <path key={x} d={`M${x} 34 l-6 10 h12 z`} fill="none" stroke={tone.veio} strokeWidth="1.5" />)}
        <rect x="20" y="96" width="80" height="28" fill={tone.veio} opacity=".45" />
      </> : <>
        <rect x="20" y="16" width="38" height="108" fill={glass ? "#ffffff55" : tone.base} stroke={tone.veio} />
        <rect x="62" y="16" width="38" height="108" fill={glass ? "#ffffff55" : tone.base} stroke={tone.veio} />
        {visual?.puxador !== "SEM_PUXADOR" && visual?.puxador !== "CAVA" && <>
          <rect x="52" y="58" width="3" height={visual?.puxador === "BOTAO" ? 4 : 22} fill={handle} />
          <rect x="65" y="58" width="3" height={visual?.puxador === "BOTAO" ? 4 : 22} fill={handle} />
        </>}
      </>}
    </svg>
  );
}

function AcervoItem({ visual }: { visual: Record<string, unknown> | null }) {
  const finish = ACABAMENTO_HEX[str(visual?.acabamento, "LATAO") as AcervoAcabamento] ?? ACABAMENTO_HEX.LATAO;
  const kind = str(visual?.item, "PUXADOR");
  return (
    <svg viewBox="0 0 120 140" className="fai-store-svg" aria-hidden>
      {kind === "PUXADOR" && [30, 60, 90].map((x) => <rect key={x} x={x - 4} y="30" width="8" height="80" rx="4" fill={finish} />)}
      {kind === "LUZ" && <><rect x="14" y="30" width="92" height="8" rx="4" fill={finish} /><path d="M20 40 L100 40 L112 120 L8 120 Z" fill="#FFE8A8" opacity=".55" /></>}
      {kind === "GAVETA" && <><rect x="14" y="44" width="92" height="56" rx="4" fill="#1C1C1C" stroke={finish} strokeWidth="3" />{[38, 60, 82].map((x) => <line key={x} x1={x} y1="50" x2={x} y2="94" stroke={finish} strokeWidth="2" />)}</>}
      {kind === "CABIDEIRO" && <><line x1="10" y1="34" x2="110" y2="34" stroke={finish} strokeWidth="5" />{[30, 52, 74, 96].map((x) => <path key={x} d={`M${x} 34 v6 l-14 16 h28 z`} fill="#5C4F7A" />)}</>}
    </svg>
  );
}

function CardFrame({ item }: { item: FaiStoreItem }) {
  const border = colors(item.visual?.border, ["#B8914A", "#F3DFA2"]);
  const style = { "--frame-a": border[0], "--frame-b": border[1] ?? border[0], "--frame-surface": str(item.visual?.surface, "#1C1A17") } as CSSProperties;
  return (
    <div className="fai-store-frame" style={style} data-kind={item.type === "LOOK_CARD" ? "look" : "piece"}>
      <div className="fai-store-frame-inner">{item.type === "LOOK_CARD" ? <><i /><i /><i /><i /></> : <i />}</div>
    </div>
  );
}

/** "Foto" do item na grade e no card expandido: a peça do catálogo, ou uma amostra desenhada a partir dos dados do item. */
export function StoreItemVisual({ item }: { item: FaiStoreItem }) {
  if (item.type === "BRAND_PIECE" && item.product) {
    return <CatalogPhoto image={item.product.catalogImage} fallbackUrl={item.product.imageUrl} alt={item.name} className="h-full w-full" category={item.product.category} />;
  }
  if (item.type === "WARDROBE") return <Wardrobe visual={item.visual} />;
  if (item.type === "ACERVO_ITEM") return <AcervoItem visual={item.visual} />;
  if (item.type === "PIECE_CARD" || item.type === "LOOK_CARD") return <CardFrame item={item} />;
  return <AuraSwatch item={item} />;
}

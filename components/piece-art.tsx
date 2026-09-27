"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { resolveCardArt, BRICKS, brickColor, ART_INDEX, studioOf } from "@/lib/card-art";
import { CardArtLayer, Blossom, Leaf, Palm, Snowflake, Sun } from "@/components/card-art";
import type { ArtEffects, ArtFamily, ArtVariant, PieceArt, Season } from "@/lib/piece-art";

/**
 * RF11 · camadas do card (de trás para a frente):
 *   1. superfície externa  — `article.pc` (borda, raio, recorte de tudo que é decorativo);
 *   2. área artística      — `.pc-art`: arte do Background Studio + composição da família + efeitos de fundo;
 *   3. container           — `.pc-content`: cabeçalho, área da peça, ações e identificação (o que é interativo);
 *   4. área da peça        — `.pc-media`: a foto aprovada, com recorte próprio (a arte nunca passa por cima dela);
 *   5. efeitos decorativos — aura atrás do container e luz de contorno na borda dele; nenhum recebe clique ou foco.
 * A área artística fica entre a borda externa e o container, nas quatro laterais: as laterais têm a mesma largura em
 * todas as famílias (a foto fica com a mesma escala na grade) e topo/base variam com a composição.
 */

/** Pseudoaleatório determinístico (servidor e cliente iguais). */
const rnd = (i: number, salt = 1) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
const v = (o: Record<string, string | number | undefined>) => o as unknown as CSSProperties;

/** Fundo padrão de cada família quando a pessoa não escolheu arte (a área artística nunca fica vazia). */
const SEASON_BASE: Record<Season, string> = {
  SPRING: "linear-gradient(165deg, #FCE7EF 0%, #F7EDE4 45%, #E3F1DF 100%)",
  SUMMER: "linear-gradient(180deg, #BFE6F4 0%, #FFE9B8 70%, #F6D59A 100%)",
  AUTUMN: "linear-gradient(165deg, #F6DDB8 0%, #E7AE77 55%, #B8643D 100%)",
  WINTER: "linear-gradient(180deg, #EEF4FA 0%, #D7E4F1 60%, #C1D3E6 100%)",
};
const FAMILY_BASE: Record<ArtFamily, string> = {
  classic: "linear-gradient(155deg, #F1EBE1 0%, #E4D8C6 100%)",
  bento: "#EFE6DA",
  blocks: "linear-gradient(180deg, #E4E7DF, #CDD5C3)",
  seasonal: SEASON_BASE.SPRING,
  xray: "radial-gradient(circle at 50% 38%, #17364F 0%, #0A1826 70%, #060E17 100%)",
  runway: "linear-gradient(180deg, #221A28 0%, #120E15 60%, #0A080C 100%)",
};
/** Cor de destaque da arte (aura, luz de contorno): paleta do preset AURA, senão a da família. */
const FAMILY_ACCENT: Record<ArtFamily, string> = { classic: "#E8C9A0", bento: "#D98C5F", blocks: "#F2CD37", seasonal: "#F4A7C0", xray: "#6FE7FF", runway: "#FFD27A" };
const SEASON_ACCENT: Record<Season, string> = { SPRING: "#F4A7C0", SUMMER: "#FFC24A", AUTUMN: "#D97706", WINTER: "#9CC7F0" };

export function accentOf(bg: Record<string, unknown> | null | undefined, art: PieceArt): string {
  const s = studioOf(bg);
  const variant = s.aura?.variantId ? ART_INDEX.variants[s.aura.variantId] : undefined;
  const palette = variant ? ART_INDEX.presets[variant.presetId]?.palette : undefined;
  if (palette?.length) return palette[Math.min(1, palette.length - 1)];
  return art.template.family === "seasonal" ? SEASON_ACCENT[art.template.season] : FAMILY_ACCENT[art.template.family];
}

/**
 * O movimento ambiente só roda com o card na tela (IntersectionObserver). Ref de callback: o card ampliado aparece só
 * depois de carregar a peça, e o observador precisa começar quando o elemento existe, não quando o componente monta.
 */
export function useInView<T extends Element>(): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null); const [inView, setInView] = useState(true);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el); return () => io.disconnect();
  }, [el]);
  return [setEl, inView];
}

/**
 * Área artística (camada 2): arte do Studio (ou o fundo padrão da família), a composição da família/variação e os efeitos
 * de fundo. `aria-hidden` e `pointer-events: none` no CSS — nada aqui é conteúdo nem controle.
 */
export function ArtStage({ bg, art, density, pieceHex }: { bg?: Record<string, unknown> | null; art: PieceArt; density: "compact" | "expanded"; pieceHex?: string | null }) {
  const resolved = resolveCardArt(bg);
  // feed leve: no card compacto a arte é estática (sem animação de preset e, no lugar do vídeo, o pôster dele)
  const user = density === "expanded" || resolved.kind === "none" ? resolved
    : { ...resolved, animation: null, video: undefined, image: resolved.image ?? resolved.video?.poster ?? undefined };
  const { family, variant, season } = art.template;
  const fx = art.effects;
  const base = family === "seasonal" ? SEASON_BASE[season] : FAMILY_BASE[family];
  return (
    <div className="pc-art" aria-hidden data-family={family} data-variant={variant}>
      {user.kind === "none" ? <div className="pc-base" style={{ background: base }} /> : <CardArtLayer art={user} />}
      <FamilyComposition family={family} variant={variant} season={season} pieceHex={pieceHex} hasUserArt={user.kind !== "none"} />
      {fx.texture !== "none" && <span className={`pc-fx-texture is-${fx.texture}`} />}
      {fx.finish !== "none" && <span className={`pc-fx-finish is-${fx.finish}`} />}
      {fx.glow && <span className="pc-fx-glow" />}
      {fx.relief && <span className="pc-fx-relief" />}
      {fx.collage && <Collage />}
      {fx.particles && <Particles moving={fx.motion && density === "expanded"} />}
      {fx.aura.on && <span className="pc-fx-aura" style={v({ "--aura-i": fx.aura.intensity.toFixed(2), "--aura-r": fx.aura.reach.toFixed(2) })} />}
    </div>
  );
}

/** Classes e variáveis que a superfície externa (article) recebe da arte. */
export function artSurfaceProps(bg: Record<string, unknown> | null | undefined, art: PieceArt, density: "compact" | "expanded") {
  const fx: ArtEffects = art.effects;
  const cls = ["pc", `pc-${density}`, `em-${art.composition.emphasis}`, fx.rim && "fx-rim", fx.glass && "fx-glass", fx.relief && "fx-relief", density === "expanded" && fx.motion && "fx-motion"].filter(Boolean).join(" ");
  const style = v({ "--pc-accent": accentOf(bg, art), ...(art.surface.color ? { "--container-bg": art.surface.color } : {}) });
  return { className: cls, style, "data-family": art.template.family, "data-variant": art.template.variant, "data-surface": art.surface.style };
}

function FamilyComposition({ family, variant, season, pieceHex, hasUserArt }: { family: ArtFamily; variant: ArtVariant; season: Season; pieceHex?: string | null; hasUserArt: boolean }) {
  switch (family) {
    case "classic": return variant === "b" ? <div className="pc-classic-b"><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /></div> : <div className="pc-classic-a" />;
    case "bento": return <Bento variant={variant} tinted={hasUserArt} />;
    case "blocks": return <Blocks variant={variant} pieceHex={pieceHex} />;
    case "seasonal": return <Seasonal variant={variant} season={season} />;
    case "xray": return <XRay variant={variant} />;
    case "runway": return <Runway variant={variant} />;
  }
}

/** Bento: painéis de proporções diferentes só na área artística (a roupa nunca é fatiada; nenhum painel é botão). */
function Bento({ variant, tinted }: { variant: ArtVariant; tinted: boolean }) {
  const tiles = variant === "a"
    ? ["t1", "t2", "t3", "l1", "l2", "r1", "r2", "b1", "b2"]
    : ["L", "t2", "r1", "r2", "b1", "b2", "dot"];
  return <div className={`pc-bento v-${variant} ${tinted ? "is-tinted" : ""}`}>{tiles.map((k) => <i key={k} className={k} />)}</div>;
}

/** Blocos modulares genéricos (sem marca): tijolos com pinos e placa-base, sombras localizadas; a foto fica lisa. */
function Blocks({ variant, pieceHex }: { variant: ArtVariant; pieceHex?: string | null }) {
  const main = brickColor(pieceHex ?? undefined);
  const palette = [main, BRICKS[2], BRICKS[1], BRICKS[0], BRICKS[3], BRICKS[6]];
  if (variant === "b") return (
    <div className="pc-blocks v-b">
      <span className="plate" />
      {["left", "right"].map((side, s) => <span key={side} className={`tower ${side}`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className="brick" style={{ background: palette[(i + s * 2) % palette.length] }} />)}</span>)}
    </div>
  );
  return (
    <div className="pc-blocks v-a">
      <span className="row top">{Array.from({ length: 6 }, (_, i) => <i key={i} className="brick" style={{ background: palette[i % palette.length], flexGrow: 1 + Math.round(rnd(i, 3) * 2) }} />)}</span>
      <span className="col left">{Array.from({ length: 5 }, (_, i) => <i key={i} className="brick" style={{ background: palette[(i + 2) % palette.length], flexGrow: 1 + Math.round(rnd(i, 5)) }} />)}</span>
      <span className="col right">{Array.from({ length: 5 }, (_, i) => <i key={i} className="brick" style={{ background: palette[(i + 4) % palette.length], flexGrow: 1 + Math.round(rnd(i, 7)) }} />)}</span>
      <span className="plate" />
    </div>
  );
}

const SEASON_ITEM: Record<Season, (i: number) => ReactNode> = {
  SPRING: (i) => <Blossom color={["#F9A8D4", "#FBCFE8", "#F472B6", "#FDE2EC"][i % 4]} />,
  SUMMER: (i) => (i % 3 === 0 ? <Sun /> : <span className="shell" />),
  AUTUMN: (i) => <Leaf color={["#C2410C", "#B45309", "#9A3412", "#D97706"][i % 4]} />,
  WINTER: () => <Snowflake />,
};
/** Sazonal: moldura ilustrada (guirlanda no topo, peças pousadas nas laterais, chão da estação) ou janela em arco. */
function Seasonal({ variant, season }: { variant: ArtVariant; season: Season }) {
  if (variant === "b") return (
    <div className={`pc-season v-b s-${season.toLowerCase()}`}>
      <span className="arch">
        {season === "SUMMER" && <><span className="sun-disc"><Sun /></span><span className="palm l"><Palm /></span><span className="palm r"><Palm flip /></span><span className="sea" /></>}
        {season === "WINTER" && <><span className="moon" /><span className="hill h1" /><span className="hill h2" /></>}
        {season === "SPRING" && <><span className="canopy" />{[0, 1, 2, 3, 4].map((i) => <span key={i} className="bloom" style={v({ left: `${14 + i * 17}%`, top: `${30 + rnd(i) * 30}%` })}><Blossom color={["#F9A8D4", "#F472B6", "#FBCFE8"][i % 3]} /></span>)}</>}
        {season === "AUTUMN" && <>{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="leafy" style={v({ left: `${8 + i * 15}%`, top: `${20 + rnd(i, 2) * 50}%`, "--rot": `${Math.round(rnd(i, 4) * 300)}deg` })}><Leaf color={["#C2410C", "#B45309", "#D97706"][i % 3]} /></span>)}</>}
      </span>
      <span className="ground" />
    </div>
  );
  return (
    <div className={`pc-season v-a s-${season.toLowerCase()}`}>
      <span className="garland"><svg viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden><path d="M0 6 C40 22 80 26 100 18 C125 8 160 10 200 22" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="g-item" style={v({ left: `${6 + i * 17}%`, "--rot": `${Math.round(rnd(i, 3) * 60 - 30)}deg` })}>{SEASON_ITEM[season](i)}</span>)}
      </span>
      {[0, 1, 2, 3].map((i) => <span key={i} className={`pin ${i % 2 ? "r" : "l"}`} style={v({ top: `${30 + i * 16}%`, "--rot": `${Math.round(rnd(i, 6) * 80 - 40)}deg` })}>{SEASON_ITEM[season](i + 2)}</span>)}
      <span className="ground" />
    </div>
  );
}

/** Raio-X: transparências, contornos e planos sobrepostos só na área artística — decoração, nunca análise da peça. */
function XRay({ variant }: { variant: ArtVariant }) {
  if (variant === "b") return <div className="pc-xray v-b"><i className="plane p1" /><i className="plane p2" /><i className="plane p3" /><i className="scan" /><i className="ring" /></div>;
  return <div className="pc-xray v-a"><i className="grid" /><i className="outline o1" /><i className="outline o2" />{["tl", "tr", "bl", "br"].map((c) => <i key={c} className={`reg ${c}`} />)}<i className="dim h" /><i className="dim v" /></div>;
}

/** Passarela: palco editorial ao redor da área da peça — luzes, chão, cortinas e letreiro; nenhuma pessoa. */
function Runway({ variant }: { variant: ArtVariant }) {
  if (variant === "b") return (
    <div className="pc-runway v-b">
      <span className="curtain l" /><span className="curtain r" /><span className="valance" />
      <span className="bulbs">{Array.from({ length: 11 }, (_, i) => <i key={i} />)}</span>
    </div>
  );
  return (
    <div className="pc-runway v-a">
      {[18, 50, 82].map((x, i) => <span key={x} className="beam" style={v({ left: `${x}%`, "--i": i })} />)}
      <span className="rig">{[18, 50, 82].map((x) => <i key={x} style={{ left: `${x}%` }} />)}</span>
      <span className="floor"><svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>{[-40, -20, 0, 20, 40, 60, 80, 100, 120, 140].map((x) => <line key={x} x1={50} y1={0} x2={x} y2={20} stroke="rgba(255,255,255,.18)" strokeWidth=".4" />)}</svg></span>
    </div>
  );
}

function Collage() {
  return (
    <div className="pc-collage">
      <span className="tape t1" /><span className="tape t2" />
      <svg className="torn" viewBox="0 0 60 40" aria-hidden><path d="M2 6 L10 2 L18 7 L27 1 L36 6 L45 2 L58 8 L55 20 L59 33 L46 38 L36 34 L24 39 L13 34 L3 37 L5 22 Z" fill="rgba(255,250,240,.9)" stroke="rgba(0,0,0,.12)" /></svg>
      <span className="sticker" />
    </div>
  );
}

function Particles({ moving }: { moving: boolean }) {
  // partículas só nas faixas da área artística (esquerda, direita, topo e base), nunca sobre o conteúdo
  const pts = Array.from({ length: 16 }, (_, i) => {
    const band = i % 4; const a = rnd(i, 2), b = rnd(i, 3);
    const pos = band === 0 ? { left: `calc(var(--pc-x) * ${(0.2 + a * 0.6).toFixed(2)})`, top: `${8 + b * 84}%` }
      : band === 1 ? { right: `calc(var(--pc-x) * ${(0.2 + a * 0.6).toFixed(2)})`, top: `${8 + b * 84}%` }
      : band === 2 ? { top: `calc(var(--pc-top) * ${(0.2 + a * 0.6).toFixed(2)})`, left: `${8 + b * 84}%` }
      : { bottom: `calc(var(--pc-bottom) * ${(0.2 + a * 0.6).toFixed(2)})`, left: `${8 + b * 84}%` };
    return { ...pos, "--s": `${2 + Math.round(rnd(i, 4) * 3)}px`, "--d": `${-rnd(i, 5) * 6}s` };
  });
  return <div className={`pc-particles ${moving ? "is-moving" : ""}`}>{pts.map((p, i) => <i key={i} style={v(p)} />)}</div>;
}

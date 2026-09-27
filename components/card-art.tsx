"use client";
import type { CSSProperties } from "react";
import type { CardArt } from "@/lib/card-art";

/** Pseudoaleatório determinístico (mesmo resultado no servidor e no cliente). */
const rnd = (i: number, salt = 1) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
const vars = (o: Record<string, string | number>) => o as unknown as CSSProperties;

/** Palco do card: a arte do Background Studio atrás do container (passe-partout), com a animação CSS do preset. */
export function CardArtLayer({ art }: { art: CardArt }) {
  if (art.kind === "none") return null;
  return (
    <div className={`card-art ${art.animation ? `anim-${art.animation}` : ""} art-${art.kind}`} style={{ background: art.base }} aria-hidden data-art={art.label}>
      {art.image && <img src={art.image} alt="" className="card-art-img" />}
      {art.video && <video className="card-art-img" src={art.video.src} poster={art.video.poster ?? undefined} autoPlay muted loop playsInline preload="metadata" />}
      {art.material && <img src={art.material} alt="" className={`card-art-img card-art-material ${art.image || art.video ? "is-overlay" : "is-solo"}`} />}
      {art.season && <SeasonDecor season={art.season} />}
    </div>
  );
}

export const Snowflake = () => (
  <svg viewBox="-10 -10 20 20" aria-hidden><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
    {[0, 60, 120].map((r) => <g key={r} transform={`rotate(${r})`}><line x1="-8.5" y1="0" x2="8.5" y2="0" /><path d="M5.5 0 l2 -2 M5.5 0 l2 2 M-5.5 0 l-2 -2 M-5.5 0 l-2 2" /></g>)}
  </g></svg>
);
export const Leaf = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden><path fill={color} d="M12 1 l2.2 4.6 4.3-1.6-1.2 4.6 4.7 1-3.9 3.1 2 3.2-4.9-.6-.7 4.9L12 16.9 9.5 20.2l-.7-4.9-4.9.6 2-3.2L2 9.6l4.7-1-1.2-4.6 4.3 1.6z" /><path d="M12 13v10" stroke="#5a2b10" strokeWidth="1.2" /></svg>
);
export const Blossom = ({ color }: { color: string }) => (
  <svg viewBox="-12 -12 24 24" aria-hidden>{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-6" rx="4" ry="6" fill={color} transform={`rotate(${r})`} />)}<circle r="2.6" fill="#F6C343" /></svg>
);
export const Palm = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 80 120" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M44 118 C42 92 38 66 46 40" stroke="#6B4423" strokeWidth="7" fill="none" strokeLinecap="round" />
    {[98, 84, 70, 56].map((y) => <path key={y} d={`M${40 + (118 - y) * 0.06} ${y} l8 -3`} stroke="#4A2E17" strokeWidth="1.4" />)}
    <g fill="#2F8F4E">
      <path d="M46 40 C30 26 14 28 4 40 C18 32 32 34 46 42Z" /><path d="M46 40 C36 18 20 10 8 12 C24 18 36 28 46 42Z" />
      <path d="M46 40 C54 18 68 12 78 16 C64 20 54 30 47 42Z" /><path d="M46 40 C62 30 74 36 80 50 C68 40 58 38 47 43Z" />
      <path d="M46 40 C44 22 50 8 60 2 C54 14 50 28 48 42Z" fill="#3BA55C" />
    </g>
    <g fill="#7A4B22"><circle cx="43" cy="45" r="3.4" /><circle cx="49" cy="46" r="3.2" /><circle cx="46" cy="49" r="3" /></g>
  </svg>
);
export const Sun = () => (
  <svg viewBox="-50 -50 100 100" aria-hidden>
    <defs><radialGradient id="sun-glow"><stop offset="0" stopColor="#FFF6C8" /><stop offset=".55" stopColor="#FFD24A" /><stop offset="1" stopColor="#FFB020" stopOpacity="0" /></radialGradient></defs>
    <circle r="46" fill="url(#sun-glow)" opacity=".55" />
    <g className="sun-rays" stroke="#FFC933" strokeWidth="3" strokeLinecap="round">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-24" x2="0" y2="-34" transform={`rotate(${i * 30})`} />)}</g>
    <circle r="18" fill="#FFD54A" stroke="#FFB300" strokeWidth="2" />
  </svg>
);

/**
 * Decoração das cartelas sazonais: flocos de neve caindo (inverno), sol com raios e coqueiros (verão), folhas caindo
 * (outono) e pétalas + flores (primavera). Some a animação com "reduzir movimento".
 */
export function SeasonDecor({ season, count, once }: { season: string; count?: number; once?: boolean }) {
  // once: nas anatomias do card a decoração cai uma vez (quando o card aparece) e fica pousada nas bordas.
  if (once) return <SeasonOnce season={season} count={count ?? 10} />;
  if (season === "WINTER") {
    const n = count ?? 18;
    return (<div className="season-decor winter" aria-hidden>
      {Array.from({ length: n }, (_, i) => <i key={i} className="fall flake" style={vars({ left: `${rnd(i) * 100}%`, "--size": `${8 + rnd(i, 2) * 12}px`, "--dur": `${5 + rnd(i, 3) * 6}s`, "--delay": `${-rnd(i, 4) * 10}s`, "--drift": `${(rnd(i, 5) - 0.5) * 40}px`, opacity: 0.55 + rnd(i, 6) * 0.45 })}><Snowflake /></i>)}
      <span className="snow-ground" />
    </div>);
  }
  if (season === "SUMMER") {
    return (<div className="season-decor summer" aria-hidden>
      <span className="sun"><Sun /></span>
      <span className="palm left"><Palm /></span><span className="palm right"><Palm flip /></span>
      <span className="sea" />
      {Array.from({ length: 6 }, (_, i) => <i key={i} className="sparkle" style={vars({ left: `${10 + rnd(i) * 80}%`, top: `${15 + rnd(i, 2) * 50}%`, "--delay": `${-rnd(i, 3) * 3}s` })} />)}
    </div>);
  }
  if (season === "AUTUMN") {
    const colors = ["#C2410C", "#B45309", "#9A3412", "#D97706", "#7C2D12"];
    return (<div className="season-decor autumn" aria-hidden>
      {Array.from({ length: count ?? 14 }, (_, i) => <i key={i} className="fall leaf" style={vars({ left: `${rnd(i) * 100}%`, "--size": `${12 + rnd(i, 2) * 12}px`, "--dur": `${6 + rnd(i, 3) * 6}s`, "--delay": `${-rnd(i, 4) * 12}s`, "--drift": `${(rnd(i, 5) - 0.5) * 70}px` })}><Leaf color={colors[i % colors.length]} /></i>)}
      <span className="leaf-pile" />
    </div>);
  }
  const petals = ["#F9A8D4", "#FBCFE8", "#F472B6", "#FDE2EC"];
  return (<div className="season-decor spring" aria-hidden>
    <span className="branch"><svg viewBox="0 0 120 60" aria-hidden><path d="M0 8 C30 14 60 10 118 30" stroke="#6B4F3A" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M40 12 C48 22 52 30 50 40" stroke="#6B4F3A" strokeWidth="2" fill="none" /></svg>
      {[[22, 6], [46, 8], [70, 16], [96, 22], [50, 34]].map(([x, y], i) => <span key={i} className="bloom" style={{ left: `${(x / 120) * 100}%`, top: `${(y / 60) * 100}%` }}><Blossom color={petals[i % petals.length]} /></span>)}
    </span>
    {Array.from({ length: count ?? 14 }, (_, i) => <i key={i} className="fall petal" style={vars({ left: `${rnd(i) * 100}%`, "--size": `${8 + rnd(i, 2) * 8}px`, "--dur": `${6 + rnd(i, 3) * 5}s`, "--delay": `${-rnd(i, 4) * 10}s`, "--drift": `${(rnd(i, 5) - 0.5) * 60}px` })}><Blossom color={petals[i % petals.length]} /></i>)}
  </div>);
}

/** Decoração sazonal de uma só vez: cada elemento cai do topo e pousa perto das bordas, sem cobrir as peças. */
function SeasonOnce({ season, count }: { season: string; count: number }) {
  const autumn = ["#C2410C", "#B45309", "#9A3412", "#D97706", "#7C2D12"], petals = ["#F9A8D4", "#FBCFE8", "#F472B6", "#FDE2EC"];
  return (<div className="season-decor once" aria-hidden>
    {Array.from({ length: count }, (_, i) => {
      const side = i % 2 ? 1 : -1, left = side < 0 ? 2 + rnd(i) * 16 : 82 + rnd(i) * 14, rest = 18 + rnd(i, 2) * 70;
      const el = season === "WINTER" ? <Snowflake /> : season === "AUTUMN" ? <Leaf color={autumn[i % autumn.length]} /> : season === "SPRING" ? <Blossom color={petals[i % petals.length]} /> : null;
      if (!el) return null;
      return <i key={i} className={`fall once ${season === "WINTER" ? "flake" : season === "AUTUMN" ? "leaf" : "petal"}`} style={vars({ left: `${left}%`, "--rest": `${rest}%`, "--size": `${10 + rnd(i, 3) * 8}px`, "--d": `${rnd(i, 4) * 0.6}s`, "--drift": `${side * 10}px`, "--rot": `${Math.round(rnd(i, 5) * 300)}deg` })}>{el}</i>;
    })}
    {season === "SUMMER" && <span className="sun once"><Sun /></span>}
  </div>);
}

/** Holofotes da Passarela: um feixe por peça, do teto até ela, com intensidade proporcional às curtidas (light 0–1). */
export function Spotlights({ beams }: { beams: { x: number; h: number; light?: number }[] }) {
  return (<div className="runway-spots" aria-hidden>{beams.map((b, i) => <span key={i} className="spot" style={vars({ left: `${b.x}%`, height: `${b.h}%`, width: `${40 + 60 * (b.light ?? 0.5)}px`, marginLeft: `${-(20 + 30 * (b.light ?? 0.5))}px`, "--light": (b.light ?? 0.5).toFixed(2), "--i": i })} />)}</div>);
}


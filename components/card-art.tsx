"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CardArt } from "@/lib/card-art";

/** Pseudoaleatório determinístico (mesmo resultado no servidor e no cliente). */
const rnd = (i: number, salt = 1) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
const vars = (o: Record<string, string | number>) => o as unknown as CSSProperties;

/**
 * Palco do card: a arte do Background Studio atrás do container (passe-partout), com a animação CSS do preset e, por
 * cima de tudo, a animação escolhida no segmento Cor (neve, pétalas, folhas caindo; brilho passando) — na faixa entre a
 * borda do card e o container, nunca sobre a foto ou os textos.
 */
export function CardArtLayer({ art }: { art: CardArt }) {
  // o navegador recusou o vídeo (autoplay bloqueado): o pôster ganha a animação CSS do preset em vez de ficar parado
  const [stuck, setStuck] = useState(false);
  if (art.kind === "none") return null;
  const fallback = stuck && art.video ? art.still ?? "drift" : null;
  const anim = [art.animation ? `anim-${art.animation.toLowerCase()}` : "", fallback ? `anim-${fallback.toLowerCase()}` : "", art.motion === "shimmer" ? "anim-shimmer" : ""].filter(Boolean).join(" ");
  const splash = art.presetId === "aura_splash";
  return (
    <div className={`card-art ${anim} art-${art.kind}${splash ? " art-aura-splash" : ""}`} style={{ background: art.base, position: "absolute", inset: 0, overflow: "hidden" }} aria-hidden data-art={art.label} data-motion={art.motion ?? undefined}>
      {art.image && art.frame && <div className="card-art-frame" style={{ borderImageSource: `url("${art.image}")` }} />}
      {art.image && !art.frame && <img src={art.image} alt="" className="card-art-img" />}
      {art.video && <ArtVideo src={art.video.src} poster={art.video.poster} onStuck={setStuck} />}
      {splash && <SplashSpread />}
      {art.material && <img src={art.material} alt="" className={`card-art-img card-art-material ${art.image || art.video ? "is-overlay" : "is-solo"}`} />}
      {art.season && <SeasonDecor season={art.season} />}
      {art.motion && art.motion !== "shimmer" && <MotionFall kind={art.motion} />}
    </div>
  );
}

/**
 * Vídeo da arte (Aura em vídeo, mosaico) que não trava. O autoplay é um pedido, não uma garantia: o navegador recusa no
 * iPhone em Modo de Pouca Energia, com economia de bateria, ou com vídeos demais na página — e sem isto o vídeo ficava
 * no pôster até recarregar. Aqui o arquivo só entra perto da tela e sai quando ela se afasta (o feed acumula páginas e
 * cada vídeo montado ocupa um decodificador), toca quando aparece e pausa quando sai, e tenta de novo quando a aba
 * volta, quando a página volta do histórico e no primeiro toque ou tecla da pessoa. Recusado, avisa {@code onStuck}.
 */
export function ArtVideo({ src, poster, onStuck }: { src: string; poster?: string | null; onStuck?: (stuck: boolean) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const stuckRef = useRef(onStuck); stuckRef.current = onStuck;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // muted como atributo, não só como propriedade: o Safari decide o autoplay olhando o atributo
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    if (typeof IntersectionObserver === "undefined") { v.autoplay = true; v.src = src; return; }   // sem observador: o autoplay do navegador decide
    let seen = false;
    let retry: (() => void) | null = null;
    const mark = (stuck: boolean) => stuckRef.current?.(stuck);
    const dropRetry = () => { if (retry) { document.removeEventListener("pointerdown", retry, true); document.removeEventListener("keydown", retry, true); retry = null; } };
    const tryPlay = () => {
      if (!seen || document.visibilityState === "hidden" || !v.getAttribute("src")) return;
      let p: Promise<void> | undefined;
      try { p = v.play(); } catch { return; }
      p?.then(() => { dropRetry(); mark(false); }, (e: DOMException) => {
        if (e?.name !== "NotAllowedError") return;                 // AbortError: pausou ou trocou de arquivo no meio, não é bloqueio
        mark(true);
        if (!retry) {                                              // depois de um gesto da pessoa o navegador libera o play
          retry = () => { dropRetry(); tryPlay(); };
          document.addEventListener("pointerdown", retry, true); document.addEventListener("keydown", retry, true);
        }
      });
    };
    // perto da tela (300 px): o arquivo entra; longe: sai, liberando rede e decodificador (o feed acumula páginas)
    const nearIO = new IntersectionObserver(([e]) => {
      const near = e.isIntersecting;
      // compara com o arquivo pedido: trocar de Aura com o card perto da tela tem de trocar o vídeo, não só o pôster
      if (near && v.getAttribute("src") !== src) { v.src = src; tryPlay(); }
      else if (!near && v.getAttribute("src")) { v.pause(); v.removeAttribute("src"); v.load(); }
    }, { rootMargin: "300px 0px" });
    // visível: toca; fora da tela: pausa (fica pronto para voltar sem baixar de novo)
    const seenIO = new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) tryPlay(); else if (!v.paused) v.pause(); });
    nearIO.observe(v); seenIO.observe(v);
    const onVisible = () => { if (document.visibilityState === "visible") tryPlay(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tryPlay);
    v.addEventListener("canplay", tryPlay);
    return () => {
      nearIO.disconnect(); seenIO.disconnect(); dropRetry();
      // trocou o arquivo (ou desmontou): solta o anterior e o aviso de bloqueio dele
      if (v.getAttribute("src")) { v.pause(); v.removeAttribute("src"); v.load(); }
      stuckRef.current?.(false);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tryPlay);
      v.removeEventListener("canplay", tryPlay);
    };
  }, [src]);
  // sem autoPlay: quem toca é o play() quando o vídeo está visível (o atributo fazia tocar fora da tela)
  return <video ref={ref} className="card-art-img" poster={poster ?? undefined} muted loop playsInline preload="metadata" />;
}

function SplashSpread() {
  return (
    <svg className="aura-splash-spread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <g className="goo-flow goo-flow-pink">
        <path fill="#FF2D7A" d="M-8 54 C5 46 10 37 22 43 C30 47 32 57 42 54 C53 50 56 37 67 40 C79 43 82 53 92 47 L108 42 L106 57 C95 64 85 69 76 63 C65 56 61 66 50 69 C38 73 31 62 23 61 C13 60 4 69 -8 72Z" />
        <path className="goo-highlight" d="M-2 56 C10 50 14 42 22 47 C29 51 33 60 42 58 C52 55 57 43 67 44 C77 45 83 57 93 52" />
        <circle cx="17" cy="36" r="1.8" /><circle cx="81" cy="39" r="1.3" />
      </g>
      <g className="goo-flow goo-flow-gold">
        <path fill="#FFD23F" d="M8 82 C18 76 18 65 29 64 C40 63 45 72 54 69 C67 65 70 54 81 58 C91 62 95 75 105 73 L108 87 C96 91 86 83 79 78 C70 73 65 84 55 87 C42 91 35 80 28 79 C20 78 17 88 7 92Z" />
        <path className="goo-highlight" d="M17 81 C24 76 24 69 30 69 C38 68 44 77 53 75 C64 73 71 61 80 64 C87 66 91 76 98 78" />
        <circle cx="36" cy="59" r="1.2" /><circle cx="91" cy="55" r="1.7" />
      </g>
      <g className="goo-flow goo-flow-cyan">
        <path fill="#2EC4FF" d="M-7 24 C5 31 13 28 18 20 C23 12 29 9 36 14 C43 20 40 29 47 32 C54 35 63 27 70 29 C78 32 79 39 88 38 L106 32 L105 43 C92 49 83 45 75 41 C66 36 58 44 48 42 C35 40 35 27 29 24 C23 21 20 34 11 37 C4 40 -2 35 -8 33Z" />
        <path className="goo-highlight" d="M-1 28 C8 33 15 32 20 24 C25 17 29 14 34 19 C39 24 37 32 47 36 C56 40 63 32 70 34 C77 36 82 43 91 42" />
        <circle cx="57" cy="22" r="1.4" /><circle cx="96" cy="26" r="1.1" />
      </g>
      <g className="goo-drops">
        <circle cx="11" cy="45" r="1.4" /><circle cx="31" cy="34" r="1" /><circle cx="61" cy="57" r="1.2" />
        <circle cx="73" cy="19" r="1.5" /><circle cx="88" cy="67" r="1" /><circle cx="44" cy="83" r="1.3" />
      </g>
    </svg>
  );
}

/**
 * Neve, pétalas ou folhas caindo pela faixa de arte (as mesmas peças das cartelas sazonais, sem o cenário). A faixa entre
 * a borda do card e o container é estreita: as peças são pequenas e 4 em cada 5 caem pelas laterais (a faixa que fica
 * sempre à vista); as demais atravessam o topo e a base.
 */
export function MotionFall({ kind, count = 30 }: { kind: "snow" | "petals" | "leaves"; count?: number }) {
  const leaves = ["#C2410C", "#B45309", "#9A3412", "#D97706", "#7C2D12"], petals = ["#F9A8D4", "#FBCFE8", "#F472B6", "#EC4899"];
  const leftOf = (i: number) => { const r = rnd(i, 11); return i % 5 === 4 ? r * 100 : i % 2 ? r * 7 : 93 + r * 7; };
  return (
    <div className={`season-decor motion-${kind}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={`fall ${kind === "snow" ? "flake" : kind === "leaves" ? "leaf" : "petal"}`}
          style={vars({ left: `calc(${leftOf(i)}% - 4px)`, "--size": `${(kind === "leaves" ? 8 : kind === "snow" ? 8 : 6) + rnd(i, 12) * 5}px`, "--dur": `${4.5 + rnd(i, 13) * 5}s`, "--delay": `${-rnd(i, 14) * 10}s`, "--drift": `${(rnd(i, 15) - 0.5) * 16}px`, opacity: 0.8 + rnd(i, 16) * 0.2 })}>
          {kind === "snow" ? <Snowflake /> : kind === "leaves" ? <Leaf color={leaves[i % leaves.length]} /> : <Blossom color={petals[i % petals.length]} />}
        </i>
      ))}
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

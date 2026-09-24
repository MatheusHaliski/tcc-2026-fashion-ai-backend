"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";

/** RF4 · Estúdio — fundo de estúdio (cor do centro + cor da borda do degradê). */
export interface StudioBackdrop { id: string; label: string; hex?: string; edge?: string; }
export interface StudioStage { name: string; provider: string; ms: number; ok: boolean; fallback?: boolean; note?: string; }
export interface StudioInfo {
  url: string; thumbUrl?: string; detailUrl?: string | null; enhancedUrl?: string; backdrop: string; backdropLabel?: string; stages?: StudioStage[];
  metrics?: { sharpnessBefore?: number; sharpnessAfter?: number; contrastBefore?: number; contrastAfter?: number; resolutionBefore?: string; resolutionAfter?: string; fillPercent?: number; noiseSigma?: number };
  framing?: { aspect?: string; width?: number; height?: number; fill?: number; bleed?: string[]; flush?: string[] };
  logo?: { box?: number[]; confidence?: number; source?: string } | null; ghost?: string[];
  provider?: string; fallbackUsed?: boolean; forced?: boolean;
}

const SIDE_LABEL: Record<string, string> = { bottom: "base", top: "topo", left: "esquerda", right: "direita" };

const STAGE_LABEL: Record<string, string> = {
  LIMPEZA: "Limpeza", NITIDEZ: "Nitidez e contorno", MANEQUIM_INVISIVEL: "Manequim invisível", LOGO: "Logo", ESTUDIO_IA: "Estúdio por IA",
  VOLUME_LUZ: "Volume e luz", ENQUADRAMENTO: "Enquadramento", FUNDO_ESTUDIO: "Fundo de estúdio", SOMBRA: "Sombra",
  COMPOSICAO: "Composição", DETALHE: "Detalhe do logo", VALIDACAO: "Validação",
};

/** Cor da borda do degradê do fundo (preenche as sobras quando a foto não tem o formato do quadro). */
export function backdropEdge(list: StudioBackdrop[], id?: string | null): string {
  return list.find((b) => b.id === id)?.edge ?? "#1c2433";
}

export function backdropCenter(list: StudioBackdrop[], id?: string | null): string {
  return list.find((b) => b.id === id)?.hex ?? backdropEdge(list, id);
}

/**
 * O mesmo degradê radial do estúdio (centro a 50% × 40% da foto, raio 0,78 do lado maior, suavização smoothstep),
 * posicionado sobre a foto exibida: o fundo continua além da foto sem emenda, em qualquer tela.
 */
function continuedBackdrop(rect: DOMRect | null, center: string, edge: string): string {
  if (!rect || rect.width === 0) return edge;
  const cx = rect.left + rect.width * 0.5, cy = rect.top + rect.height * 0.4, r = Math.max(rect.width, rect.height) * 0.78;
  const stop = (t: number) => { const s = t * t * (3 - 2 * t); return `color-mix(in srgb, ${edge} ${Math.round(s * 100)}%, ${center}) ${Math.round(t * r)}px`; };
  return `radial-gradient(circle at ${Math.round(cx)}px ${Math.round(cy)}px, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(stop).join(", ")})`;
}

let cache: StudioBackdrop[] | null = null;
export function useStudioBackdrops(): StudioBackdrop[] {
  const [list, setList] = useState<StudioBackdrop[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    api.get<StudioBackdrop[]>("/api/studio/backdrops", { anonymous: true }).then((l) => { cache = l; if (alive) setList(l); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return list;
}

/** Chips de fundo: amostra do degradê + nome (a cor nunca é o único indicador). */
export function BackdropChips({ value, onPick, busy, label = "Fundo do estúdio" }: { value?: string | null; onPick: (id: string) => void; busy?: boolean; label?: string }) {
  const list = useStudioBackdrops();
  if (!list.length) return null;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {list.map((b) => {
        const active = (value ?? "auto") === b.id;
        const swatch = b.hex ? `radial-gradient(circle at 50% 40%, ${b.hex}, ${b.edge ?? b.hex})` : "conic-gradient(#2D55C9, #F1E8D8, #5E636D, #2D55C9)";
        return (
          <button key={b.id} type="button" role="radio" aria-checked={active} disabled={busy} onClick={() => onPick(b.id)}
            className={`chip inline-flex items-center gap-1.5 ${active ? "is-active" : ""}`} title={b.label}>
            <span aria-hidden className="inline-block h-4 w-4 rounded-full border border-line-soft" style={{ background: swatch }} />
            {b.id === "auto" ? "Automático" : b.label}
          </button>
        );
      })}
    </div>
  );
}

/** Etapas do pipeline + antes/depois (nitidez, contraste, resolução). */
export function StudioReport({ info }: { info: StudioInfo }) {
  const m = info.metrics ?? {};
  const gain = (a?: number, b?: number) => (a && b ? `${b >= a ? "+" : ""}${Math.round(((b - a) / a) * 100)}%` : "—");
  return (
    <div className="type-caption text-muted">
      <ol className="flex flex-wrap gap-1" aria-label="etapas do estúdio">
        {(info.stages ?? []).map((s, i) => (
          <li key={i} className={`badge ${s.ok ? "" : "opacity-60"}`} title={`${s.provider}${s.note ? ` · ${s.note}` : ""}`}>
            {s.ok ? "✓" : "–"} {STAGE_LABEL[s.name] ?? s.name} <span className="tabular">{s.ms} ms</span>
          </li>
        ))}
      </ol>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div><dt>Nitidez</dt><dd className="tabular text-ink">{gain(m.sharpnessBefore, m.sharpnessAfter)}</dd></div>
        <div><dt>Contraste</dt><dd className="tabular text-ink">{gain(m.contrastBefore, m.contrastAfter)}</dd></div>
        <div><dt>Resolução</dt><dd className="tabular text-ink">{m.resolutionBefore ?? "—"} → {m.resolutionAfter ?? "—"}</dd></div>
      </dl>
      <ul className="mt-2 space-y-0.5">
        {info.framing && <li><strong className="text-ink">Enquadramento:</strong> {info.framing.aspect} · a peça ocupa {Math.round((info.framing.fill ?? 0) * 100)}% do quadro{info.framing.bleed?.length ? (info.framing.bleed.every((b) => info.framing?.flush?.includes(b)) ? ` · rente à ${info.framing.bleed.map((b) => SIDE_LABEL[b] ?? b).join(" e ")} (nada cortado)` : ` · sangra na ${info.framing.bleed.map((b) => SIDE_LABEL[b] ?? b).join(" e ")} (o corte da foto fica fora do quadro)`) : " · peça inteira, margem mínima"}</li>}
        <li><strong className="text-ink">Manequim invisível:</strong> {info.ghost?.length ? info.ghost.join(" · ") : "nada a preencher"}</li>
        <li><strong className="text-ink">Logo:</strong> {info.logo ? `encontrado (${info.logo.source === "ia" ? "IA de visão" : "detector local"}) · foco e foto de detalhe` : "nenhum identificado"}</li>
      </ul>
      <p className="mt-1">Motor: {info.provider ?? "local"}{info.fallbackUsed ? " (plano B local)" : ""}{info.forced ? " · recorte conferido por você" : ""}</p>
    </div>
  );
}

/**
 * Tela cheia: a foto de estúdio ocupa a tela inteira, e a cor do fundo continua além da foto (sem tarja preta).
 * Setas ou teclado alternam entre a foto principal e o detalhe do logo; Esc fecha.
 */
/** Lados em que a peça sangra (corte da foto): na tela cheia, a foto encosta nesses lados da tela. */
export function sangria(framing?: StudioInfo["framing"] | null): string[] {
  return (framing?.bleed ?? []).filter((b) => !(framing?.flush ?? []).includes(b));
}

export function StudioLightbox({ images, edge, center, start = 0, onClose }: { images: { src: string; alt: string; anchor?: string[]; cover?: boolean }[]; edge: string; center?: string; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const imgRef = useRef<HTMLImageElement>(null); const [rect, setRect] = useState<DOMRect | null>(null);
  const measure = useCallback(() => setRect(imgRef.current?.getBoundingClientRect() ?? null), []);
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, [measure]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % images.length);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);
  useEffect(() => { measure(); }, [i, measure]);
  const img = images[i];
  if (!img) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={img.alt} onClick={onClose}
      className={`fixed inset-0 z-50 flex ${img.anchor?.includes("bottom") ? "items-end" : img.anchor?.includes("top") ? "items-start" : "items-center"} ${img.anchor?.includes("left") ? "justify-start" : img.anchor?.includes("right") ? "justify-end" : "justify-center"}`}
      style={{ background: continuedBackdrop(rect, center ?? edge, edge) }}>
      {/* detalhe do logo já é um recorte: preenche a tela inteira, centrado no logo */}
      <img ref={imgRef} src={img.src} alt={img.alt} className={img.cover ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain"} onLoad={measure} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="chip absolute right-3 top-3" onClick={onClose} aria-label="fechar tela cheia">✕ Fechar</button>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2" onClick={(e) => e.stopPropagation()}>
          {images.map((m, k) => <button key={k} type="button" className={`chip ${k === i ? "is-active" : ""}`} aria-pressed={k === i} onClick={() => setI(k)}>{m.alt.split(" — ")[1] ?? `Foto ${k + 1}`}</button>)}
        </div>
      )}
    </div>
  );
}

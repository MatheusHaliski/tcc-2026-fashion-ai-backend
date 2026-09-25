"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n, tr } from "@/lib/i18n/i18n";

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
  get LIMPEZA() { return tr("studio.limpeza"); }, get NITIDEZ() { return tr("studio.nitidez_e_contorno"); }, get MANEQUIM_INVISIVEL() { return tr("studio.sem_manequim_fantasma"); }, get LOGO() { return tr("room3d.wardrobeCreator.logo_2"); }, get ESTUDIO_IA() { return tr("studio.estudio_por_ia"); },
  get VOLUME_LUZ() { return tr("studio.volume_e_luz"); }, get ENQUADRAMENTO() { return tr("studio.enquadramento"); }, get FUNDO_ESTUDIO() { return tr("studio.fundo_de_estudio"); }, get SOMBRA() { return tr("studio.sombra"); },
  get COMPOSICAO() { return tr("room.composicao"); }, get DETALHE() { return tr("common.detalhe_do_logo"); }, get VALIDACAO() { return tr("studio.validacao"); },
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
export function BackdropChips({ value, onPick, busy, label = tr("studio.fundo_do_estudio") }: { value?: string | null; onPick: (id: string) => void; busy?: boolean; label?: string }) {
  const { t } = useI18n();
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
            {b.id === "auto" ? t("settings.auto") : b.label}
          </button>
        );
      })}
    </div>
  );
}

/** Etapas do pipeline + antes/depois (nitidez, contraste, resolução). */
export function StudioReport({ info }: { info: StudioInfo }) {
  const { rich, t } = useI18n();
  const m = info.metrics ?? {};
  const gain = (a?: number, b?: number) => (a && b ? `${b >= a ? "+" : ""}${Math.round(((b - a) / a) * 100)}%` : "—");
  return (
    <div className="type-caption text-muted">
      <ol className="flex flex-wrap gap-1" aria-label={t("studio.etapas_do_estudio")}>
        {(info.stages ?? []).map((s, i) => (
          <li key={i} className={`badge ${s.ok ? "" : "opacity-60"}`} title={`${s.provider}${s.note ? ` · ${s.note}` : ""}`}>
            {s.ok ? "✓" : "–"} {STAGE_LABEL[s.name] ?? s.name} <span className="tabular">{t("common.ms", { ms: s.ms })}</span>
          </li>
        ))}
      </ol>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <div><dt>{t("studio.nitidez")}</dt><dd className="tabular text-ink">{gain(m.sharpnessBefore, m.sharpnessAfter)}</dd></div>
        <div><dt>{t("common.contraste")}</dt><dd className="tabular text-ink">{gain(m.contrastBefore, m.contrastAfter)}</dd></div>
        <div><dt>{t("studio.resolucao")}</dt><dd className="tabular text-ink">{m.resolutionBefore ?? "—"} → {m.resolutionAfter ?? "—"}</dd></div>
      </dl>
      <ul className="mt-2 space-y-0.5">
        {info.framing && <li>{rich("studio.enquadramento_a_peca_ocupa_do", { aspect: info.framing.aspect, Math: Math.round((info.framing.fill ?? 0) * 100) }, { 0: ($c) => <strong className="text-ink">{$c}</strong> })}{info.framing.bleed?.length ? (info.framing.bleed.every((b) => info.framing?.flush?.includes(b)) ? t("studio.rente_a_nada_cortado", { join: info.framing.bleed.map((b) => SIDE_LABEL[b] ?? b).join(" e ") }) : t("studio.sangra_na_o_corte_da", { join: info.framing.bleed.map((b) => SIDE_LABEL[b] ?? b).join(" e ") })) : t("studio.peca_inteira_margem_minima")}</li>}
        <li><strong className="text-ink">{t("studio.manequim")}</strong> {info.ghost?.length ? info.ghost.join(" · ") : t("studio.sem_manequim_fantasma_peca_superior")}</li>
        <li><strong className="text-ink">{t("studio.logo")}</strong> {info.logo ? t("studio.encontrado_foco_e_foto_de", { value: info.logo.source === "ia" ? t("studio.ia_de_visao") : info.logo.source === "catalogo" ? t("studio.selo_fai_da_arte_padrao") : "detector local" }) : t("studio.nenhum_identificado")}</li>
      </ul>
      <p className="mt-1">{t("studio.motor", { value: info.provider ?? t("common.local"), value2: info.fallbackUsed ? t("common.plano_b_local") : "", value3: info.forced ? t("studio.recorte_conferido_por_voce") : "" })}</p>
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
  const { t } = useI18n();
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
      <button type="button" className="chip absolute right-3 top-3" onClick={onClose} aria-label={t("studio.fechar_tela_cheia")}>{t("studio.fechar")}</button>
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2" onClick={(e) => e.stopPropagation()}>
          {images.map((m, k) => <button key={k} type="button" className={`chip ${k === i ? "is-active" : ""}`} aria-pressed={k === i} onClick={() => setI(k)}>{m.alt.split(" — ")[1] ?? t("studio.foto", { value: k + 1 })}</button>)}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

/** RF4 · Estúdio — fundo de estúdio (cor do centro + cor da borda do degradê). */
export interface StudioBackdrop { id: string; label: string; hex?: string; edge?: string; }
export interface StudioStage { name: string; provider: string; ms: number; ok: boolean; fallback?: boolean; note?: string; }
export interface StudioInfo {
  url: string; thumbUrl?: string; enhancedUrl?: string; backdrop: string; backdropLabel?: string; stages?: StudioStage[];
  metrics?: { sharpnessBefore?: number; sharpnessAfter?: number; contrastBefore?: number; contrastAfter?: number; resolutionBefore?: string; resolutionAfter?: string };
  provider?: string; fallbackUsed?: boolean; forced?: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  NITIDEZ: "Nitidez e resolução", ESTUDIO_IA: "Estúdio por IA", VOLUME_LUZ: "Volume e luz", FUNDO_ESTUDIO: "Fundo de estúdio",
  SOMBRA: "Sombra projetada", COMPOSICAO: "Enquadramento", VALIDACAO: "Validação",
};

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
      <p className="mt-1">Motor: {info.provider ?? "local"}{info.fallbackUsed ? " (plano B local)" : ""}{info.forced ? " · recorte conferido por você" : ""}</p>
    </div>
  );
}

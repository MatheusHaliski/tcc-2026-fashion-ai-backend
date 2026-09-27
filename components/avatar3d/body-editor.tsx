"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { Badge, Button, Card, Skeleton, Spinner } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { AvatarView } from "@/components/three/avatar-viewer";
import type { Avatar3dRef } from "@/components/three/common";
import { loadOriented } from "@/lib/avatar3d/pipeline";
import { CLS, mergeObservation, observeBody, type BodyObservation, type ClassMask, type PosePoint, type Region } from "@/lib/avatar3d/body";
import { BODY_RANGE, applyUserData, buildSpec, defaultBodyModel, setParam, validateBody, type BodyKey, type BodyModel, type Sex } from "@/lib/avatar3d/body-spec";
import { qualityReport } from "@/lib/avatar3d/metrics";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false, loading: () => <Skeleton className="h-full" /> });

/** Proporções que a pessoa ajusta (a estatura vem da altura informada; a cabeça vem do rosto). */
const EDITABLE: BodyKey[] = ["shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "build"];
const REGIONS: Region[] = ["head", "shoulders", "chest", "waist", "hips", "arms", "legs", "feet", "back", "depth"];

interface Analysis { obs: BodyObservation; pose: PosePoint[] | null; mask: ClassMask | null; width: number; height: number; people: number; photoUrl: string }

/**
 * Corpo do Avatar 3D. A foto de corpo inteiro (opcional) mede o que ela mostra; o resto é estimativa, marcada como tal.
 * Altura e peso são informados pela pessoa, nunca "medidos". Cada proporção mostra de onde veio e pode ser ajustada.
 * As métricas automáticas aparecem junto, com o aviso de que não substituem a comparação lado a lado.
 */
export function BodyEditor({ sex, initial, avatar, onSave, saving }: { sex: Sex; initial: BodyModel | null; avatar: Avatar3dRef | null; onSave: (b: BodyModel | null) => void; saving: boolean }) {
  const { t, fmtNumber } = useI18n();
  const [model, setModel] = useState<BodyModel>(() => validateBody(initial) ?? defaultBodyModel(sex));
  const [height, setHeight] = useState<string>(initial?.heightCm ? String(initial.heightCm) : "");
  const [weight, setWeight] = useState<string>(initial?.weightKg ? String(initial.weightKg) : "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AvatarView>("front");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (analysis) URL.revokeObjectURL(analysis.photoUrl); }, [analysis]);

  async function analyze(file: File) {
    setBusy(true); setError(null);
    try {
      const img = await loadOriented(file);
      const { detectBody } = await import("@/lib/avatar3d/body-detect");
      const det = await detectBody(img);
      if (!det.pose) { setError(t("avatar3d.body.sem_pessoa")); return; }
      if (det.people > 1) { setError(t("avatar3d.body.duas_pessoas")); return; }
      const obs = observeBody(det.pose, det.world, det.mask, { width: img.width, height: img.height }, det.chin);
      setAnalysis({ obs, pose: det.pose, mask: det.mask, width: img.width, height: img.height, people: det.people, photoUrl: URL.createObjectURL(file) });
      setModel((m) => applyUserData(mergeObservation(m, obs), m.heightCm, m.weightKg));
    } catch { setError(t("avatar3d.body.falhou")); } finally { setBusy(false); }
  }
  function userData(h: string, w: string) {
    const hc = Number(h) || null, wk = Number(w) || null;
    setModel((m) => applyUserData(m, hc && hc >= 120 && hc <= 220 ? hc : null, wk && wk >= 30 && wk <= 250 ? wk : null));
  }
  const report = useMemo(() => qualityReport(buildSpec(model.params), model.params, analysis ? { obs: analysis.obs, pose: analysis.pose ?? undefined, mask: analysis.mask ?? undefined, width: analysis.width, height: analysis.height } : undefined), [model.params, analysis]);
  const cm = (k: BodyKey) => k === "build" ? `${model.params.build > 0 ? "+" : ""}${fmtNumber(Math.round(model.params.build * 100) / 100)}` : `${fmtNumber(Math.round(model.params[k] * model.params.stature * 100))} cm`;
  const pct = (v: number) => `${fmtNumber(Math.round(v * 1000) / 10)}%`;

  return (
    <Card>
      <p className="label">{t("avatar3d.body.titulo")}</p>
      <p className="type-body-sm text-muted">{t("avatar3d.body.explica")}</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="grid content-start gap-3">
          <div className="grid gap-2 rounded-md border border-line-soft p-3">
            <p className="type-body-sm font-semibold">{t("avatar3d.body.foto")}</p>
            <ul className="fai-list type-caption text-muted">{["dica1", "dica2", "dica3", "dica4"].map((k) => <li key={k}>{t(`avatar3d.body.${k}`)}</li>)}</ul>
            <input ref={input} id="avatar-body-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyze(f); e.target.value = ""; }} />
            <Button size="sm" onClick={() => input.current?.click()} loading={busy}>{analysis ? t("avatar3d.body.trocar_foto") : t("avatar3d.body.enviar_foto")}</Button>
            {busy && <p className="flex items-center gap-2 type-caption text-muted"><Spinner size={14} />{t("avatar3d.body.analisando")}</p>}
            {error && <p role="alert" className="type-body-sm text-critical">{error}</p>}
            {analysis && analysis.obs.warnings.length > 0 && <ul className="fai-list">{analysis.obs.warnings.filter((w) => !w.startsWith("OUT_OF_RANGE")).map((w) => <li key={w} className="type-caption text-muted">⚠ {t(`avatar3d.body.aviso.${w}`)}</li>)}</ul>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 type-body-sm" htmlFor="avatar-height">{t("avatar3d.body.altura")}
              <input id="avatar-height" className="input" inputMode="numeric" value={height} placeholder="170" onChange={(e) => { setHeight(e.target.value); userData(e.target.value, weight); }} /></label>
            <label className="grid gap-1 type-body-sm" htmlFor="avatar-weight">{t("avatar3d.body.peso")}
              <input id="avatar-weight" className="input" inputMode="numeric" value={weight} placeholder="—" onChange={(e) => { setWeight(e.target.value); userData(height, e.target.value); }} /></label>
          </div>
          <p className="type-caption text-faint">{t("avatar3d.body.peso_idade")}</p>
          <div className="grid gap-3">
            {EDITABLE.map((k) => {
              const [lo, hi, step] = BODY_RANGE[k]; const id = `body-${k}`;
              return (
                <label key={k} htmlFor={id} className="grid gap-1">
                  <span className="flex items-center justify-between gap-2 type-body-sm"><span>{t(`avatar3d.body.param.${k}`)}</span><span className="flex items-center gap-2"><Badge className={`src-${model.sources[k]}`}>{t(`avatar3d.body.fonte.${model.sources[k]}`)}</Badge><span className="type-data">{cm(k)}</span></span></span>
                  <input id={id} type="range" min={lo} max={hi} step={step} value={model.params[k]} onChange={(e) => setModel((m) => setParam(m, k, Number(e.target.value)))} />
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" loading={saving} onClick={() => onSave(model)}>{t("avatar3d.body.salvar")}</Button>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setModel(defaultBodyModel(sex)); setAnalysis(null); setHeight(""); setWeight(""); onSave(null); }}>{t("avatar3d.body.voltar_referencia")}</Button>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="aspect-[3/5] overflow-hidden rounded-md bg-surface-2">
              <AvatarViewer avatar={avatar} sex={sex} body={model.params} view={view} framing="full" background="#ECE7DE" />
            </div>
            <div className="aspect-[3/5] overflow-hidden rounded-md bg-surface-2">
              {analysis ? <PhotoOverlay a={analysis} /> : <p className="grid h-full place-items-center p-4 text-center type-body-sm text-muted">{t("avatar3d.body.sem_foto_comparar")}</p>}
            </div>
          </div>
          <div role="group" aria-label={t("avatar3d.view.label")} className="flex flex-wrap gap-2">
            {(["front", "left34", "profile", "back"] as AvatarView[]).map((v) => <Button key={v} size="sm" variant={v === view ? "primary" : "default"} aria-pressed={v === view} onClick={() => setView(v)}>{t(`avatar3d.view.${v}`)}</Button>)}
          </div>
          <div>
            <p className="type-body-sm font-semibold">{t("avatar3d.body.regioes")}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{REGIONS.map((r) => { const st = analysis?.obs.regions[r] ?? (r === "back" || r === "depth" ? "estimated" : "hidden"); return <span key={r} className={`badge src-${st}`}>{t(`avatar3d.body.regiao.${r}`)} · {t(`avatar3d.body.estado.${st}`)}</span>; })}</div>
          </div>
          <div>
            <p className="type-body-sm font-semibold">{t("avatar3d.body.metricas")}</p>
            <ul className="fai-list mt-1 type-body-sm">
              <li>{report.completeness.ok ? "✓" : "⚠"} {t("avatar3d.body.m.completude", { v: pct(report.completeness.value) })}</li>
              <li>{report.connectivity.ok ? "✓" : "⚠"} {t("avatar3d.body.m.conexoes", { v: fmtNumber(Math.round(report.connectivity.value * 1000)) })}</li>
              <li>{report.symmetry.ok ? "✓" : "⚠"} {t("avatar3d.body.m.simetria")}</li>
              {report.proportions && report.proportions.n > 0 && <li>{report.proportions.ok ? "✓" : "⚠"} {t("avatar3d.body.m.proporcoes", { v: pct(report.proportions.value), n: report.proportions.n })}</li>}
              {report.keypoints && <li>{report.keypoints.ok ? "✓" : "⚠"} {t("avatar3d.body.m.pontos", { v: pct(report.keypoints.value), pck: pct(report.keypoints.pck10) })}</li>}
              {report.silhouetteIoU !== undefined && <li>· {t("avatar3d.body.m.silhueta", { v: pct(report.silhouetteIoU) })}</li>}
            </ul>
            <p className="mt-1 type-caption text-faint">{t("avatar3d.body.m.aviso")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** A foto com os pontos e as classes (roupa em azul, pele em amarelo), para comparar com o boneco. */
function PhotoOverlay({ a }: { a: Analysis }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / img.height); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d")!; g.drawImage(img, 0, 0, c.width, c.height);
      if (a.mask) {
        const m = document.createElement("canvas"); m.width = a.mask.width; m.height = a.mask.height; const mg = m.getContext("2d")!; const id = mg.createImageData(m.width, m.height);
        const col: Record<number, [number, number, number, number]> = { [CLS.bodySkin]: [234, 179, 8, 80], [CLS.clothes]: [37, 99, 235, 80] };
        for (let i = 0; i < a.mask.data.length; i++) { const v = col[a.mask.data[i]]; if (v) id.data.set(v, i * 4); }
        mg.putImageData(id, 0, 0); g.drawImage(m, 0, 0, c.width, c.height);
      }
      a.pose?.forEach((p) => { if ((p.visibility ?? 0) < 0.5) return; g.fillStyle = "#111"; g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 3, 0, 7); g.fill(); });
    };
    img.src = a.photoUrl;
  }, [a]);
  return <canvas ref={ref} className="h-full w-full object-contain" />;
}

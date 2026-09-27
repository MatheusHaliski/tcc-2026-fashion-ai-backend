"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { loadOriented, analyzePhoto } from "@/lib/avatar3d/pipeline";
import { detectBody } from "@/lib/avatar3d/body-detect";
import { CLS, P, mergeObservation, observeBody, type BodyObservation, type PosePoint } from "@/lib/avatar3d/body";
import { DEFAULT_BODY, buildSpec, defaultBodyModel, type BodyModel, type Sex } from "@/lib/avatar3d/body-spec";
import { legacyHeadSample, qualityReport } from "@/lib/avatar3d/metrics";
import { legacySpec } from "@/lib/avatar3d/eval/legacy-spec";
import type { AvatarView } from "@/components/three/avatar-viewer";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false });

/**
 * Laboratório do corpo (desenvolvimento): roda a detecção do corpo, a medição (observado/estimado/oculto), as métricas
 * do manequim antigo e do novo na mesma foto, e desenha as evidências. O script scripts/avatar3d/eval-body.mjs usa
 * window.__bodyLab para rodar o conjunto de teste e salvar as imagens e o JSON do relatório.
 */
const EDGE: Record<string, string> = { skin: "#16a34a", clothes: "#d97706", arm: "#dc2626", other: "#6b7280" };
const CLASS_RGBA: Record<number, [number, number, number, number]> = { [CLS.hair]: [124, 58, 237, 110], [CLS.bodySkin]: [234, 179, 8, 90], [CLS.faceSkin]: [249, 115, 22, 110], [CLS.clothes]: [37, 99, 235, 90], [CLS.other]: [107, 114, 128, 90] };
/** Legendas da página de laboratório (ferramenta de desenvolvimento, fora do produto: não passa pela tradução). */
const CAPTIONS = ["Laboratório do corpo", "status: ", "pontos, classes, linhas de medida (verde pele · âmbar roupa · vermelho braço)", "o que o manequim antigo aplicava na cabeça"];
const BONES: [number, number][] = [[P.shL, P.shR], [P.shL, P.elL], [P.elL, P.wrL], [P.shR, P.elR], [P.elR, P.wrR], [P.shL, P.hipL], [P.shR, P.hipR], [P.hipL, P.hipR], [P.hipL, P.kneeL], [P.kneeL, P.ankL], [P.hipR, P.kneeR], [P.kneeR, P.ankR]];

export default function BodyLab() {
  const overlay = useRef<HTMLCanvasElement>(null); const legacyCv = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<BodyModel | null>(null); const [sex, setSex] = useState<Sex>("FEMININO");
  const [view, setView] = useState<AvatarView>("front"); const [status, setStatus] = useState("idle"); const [result, setResult] = useState<unknown>(null);

  async function run(url: string, sx: Sex) {
    setStatus("running"); setSex(sx); setModel(null);
    const blob = await (await fetch(url)).blob(); const img = await loadOriented(blob);
    const det = await detectBody(img);
    const obs: BodyObservation = observeBody(det.pose, det.world, det.mask, { width: img.width, height: img.height }, det.chin);
    const fitted = mergeObservation(defaultBodyModel(sx), obs);
    const face = await analyzePhoto(img, "front");
    const ctx = { obs, pose: det.pose ?? undefined, mask: det.mask ?? undefined, width: img.width, height: img.height };
    const r = {
      image: { width: img.width, height: img.height }, people: det.people, ms: det.ms,
      poseVisible: det.pose ? det.pose.filter((p) => (p.visibility ?? 0) >= 0.6).length : 0,
      observation: { measures: obs.measures, regions: obs.regions, warnings: obs.warnings },
      legacyHead: det.mask ? legacyHeadSample(det.mask) : null,
      face: { faces: face.faces, issues: face.issues.map((i) => `${i.code}:${i.severity}`), nme: face.fit && face.px ? face.fit.rms : null },
      metrics: {
        legacy: qualityReport(legacySpec(sx), DEFAULT_BODY[sx], ctx),
        reference: qualityReport(buildSpec(DEFAULT_BODY[sx]), DEFAULT_BODY[sx], ctx),
        fitted: qualityReport(buildSpec(fitted.params), fitted.params, ctx),
      },
      fitted: { params: fitted.params, sources: fitted.sources },
    };
    draw(img, det.pose, det.mask, obs);
    drawLegacy(img);
    setModel(fitted); setResult(r); setStatus("done");
    return r;
  }

  function draw(img: HTMLCanvasElement, pose: PosePoint[] | null, mask: { width: number; height: number; data: Uint8Array } | null, obs: BodyObservation) {
    const c = overlay.current!; const k = Math.min(1, 520 / img.height); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0, c.width, c.height);
    if (mask) {
      const m = document.createElement("canvas"); m.width = mask.width; m.height = mask.height; const mg = m.getContext("2d")!; const id = mg.createImageData(mask.width, mask.height);
      for (let i = 0; i < mask.data.length; i++) { const col = CLASS_RGBA[mask.data[i]]; if (col) id.data.set(col, i * 4); }
      mg.putImageData(id, 0, 0); g.drawImage(m, 0, 0, c.width, c.height);
    }
    if (pose) {
      g.lineWidth = 2; g.strokeStyle = "#ffffff";
      for (const [a, b] of BONES) { if ((pose[a].visibility ?? 0) < 0.5 || (pose[b].visibility ?? 0) < 0.5) continue; g.beginPath(); g.moveTo(pose[a].x * c.width, pose[a].y * c.height); g.lineTo(pose[b].x * c.width, pose[b].y * c.height); g.stroke(); }
      pose.forEach((p) => { if ((p.visibility ?? 0) < 0.5) return; g.fillStyle = "#111"; g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 3, 0, 7); g.fill(); });
    }
    const rows = obs.debug.rows ?? {};
    for (const r of Object.values(rows)) { g.strokeStyle = EDGE[r.edge] ?? "#000"; g.lineWidth = 2; g.beginPath(); g.moveTo(r.x0 * k, r.y * k); g.lineTo(r.x1 * k, r.y * k); g.stroke(); }
    if (obs.debug.topY !== undefined) { g.strokeStyle = "#0ea5e9"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, obs.debug.topY * k); g.lineTo(c.width, obs.debug.topY * k); g.stroke(); }
    if (obs.debug.floorY !== undefined) { g.beginPath(); g.moveTo(0, obs.debug.floorY * k); g.lineTo(c.width, obs.debug.floorY * k); g.stroke(); }
    g.setLineDash([]);
  }

  /** O que o manequim antigo aplicava na cabeça: o recorte central da foto (sem detectar o rosto). */
  function drawLegacy(img: HTMLCanvasElement) {
    const c = legacyCv.current!; const k = Math.min(1, 520 / img.height); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0, c.width, c.height); g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, 0, c.width, c.height);
    const F = 0.62; const u0 = 0.5 - F / 2, u1 = 0.5 + F / 2, v0 = 0.56 - 0.58 * F, v1 = 0.56 + 0.58 * F;
    g.save(); g.beginPath(); g.rect(u0 * c.width, (1 - v1) * c.height, (u1 - u0) * c.width, (v1 - v0) * c.height); g.clip();
    g.beginPath(); g.ellipse(0.5 * c.width, (1 - 0.527) * c.height, 0.453 * c.width, 0.497 * c.height, 0, 0, 7); g.clip();
    g.drawImage(img, 0, 0, c.width, c.height); g.restore();
    g.strokeStyle = "#ef4444"; g.lineWidth = 3; g.setLineDash([8, 5]); g.strokeRect(u0 * c.width, (1 - v1) * c.height, (u1 - u0) * c.width, (v1 - v0) * c.height); g.setLineDash([]);
  }

  useEffect(() => {
    (window as unknown as { __bodyLab: unknown }).__bodyLab = {
      run, setView: (v: AvatarView) => setView(v),
      overlay: () => overlay.current?.toDataURL("image/png"), legacy: () => legacyCv.current?.toDataURL("image/png"),
      canvas: () => (document.querySelector("#body-lab-3d canvas") as HTMLCanvasElement | null)?.toDataURL("image/png"),
    };
  });

  return (
    <main className="grid gap-4 p-4" data-status={status}>
      <h1 className="type-h2">{CAPTIONS[0]}</h1>
      <p className="type-caption">{CAPTIONS[1]}{status}</p>
      <div className="flex flex-wrap gap-4">
        <figure><canvas ref={overlay} /><figcaption className="type-caption">{CAPTIONS[2]}</figcaption></figure>
        <figure><canvas ref={legacyCv} /><figcaption className="type-caption">{CAPTIONS[3]}</figcaption></figure>
        <div id="body-lab-3d" style={{ width: 320, height: 520 }}>{model && <AvatarViewer avatar={null} sex={sex} body={model.params} view={view} framing="full" controls={false} background="#ECE7DE" />}</div>
      </div>
      <pre className="type-caption" style={{ maxWidth: 900, whiteSpace: "pre-wrap" }}>{result ? JSON.stringify(result, null, 1).slice(0, 4000) : ""}</pre>
    </main>
  );
}

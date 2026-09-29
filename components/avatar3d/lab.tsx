"use client";
import { FileButton } from "@/components/ui";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Select } from "@/components/ui";
import { retryImport } from "@/lib/chunk-recovery";
import * as THREE from "three";
import { analyzePhoto, buildAvatar, type AnalyzedPhoto, type BuiltAvatar } from "@/lib/avatar3d/pipeline";
import type { AvatarView } from "@/components/three/avatar-viewer";

const AvatarViewer = dynamic(() => retryImport(() => import("@/components/three/avatar-viewer")), { ssr: false });

/**
 * Laboratório (desenvolvimento): roda o pipeline do Avatar 3D em fotos escolhidas e expõe window.__avatarLab para o
 * script de validação (scripts/avatar3d/validate.mjs) fotografar frente, 3/4 e perfil.
 */
export default function AvatarLab() {
  const files = useRef<(File | null)[]>([null, null, null]);
  const [photos, setPhotos] = useState<AnalyzedPhoto[]>([]); const [built, setBuilt] = useState<BuiltAvatar | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null); const [view, setView] = useState<AvatarView>("front");
  const [sex, setSex] = useState<"FEMININO" | "MASCULINO">("FEMININO"); const [status, setStatus] = useState("idle"); const [ms, setMs] = useState(0);
  async function run() {
    setStatus("running"); setBuilt(null); const t0 = performance.now();
    try {
      const ps: AnalyzedPhoto[] = [];
      for (let i = 0; i < 3; i++) { const f = files.current[i]; if (f) ps.push(await analyzePhoto(f, i === 0 ? "front" : "side")); }
      setPhotos(ps); const b = buildAvatar(ps, { profileSex: sex }); setBuilt(b);
      if (b) { const t = new THREE.CanvasTexture(b.atlas); t.colorSpace = THREE.SRGBColorSpace; setTex(t); }
      setMs(Math.round(performance.now() - t0)); setStatus(b ? "built" : "rejected");
    } catch (e) { setStatus("error: " + (e as Error).message); }
  }
  useEffect(() => {
    (window as unknown as { __avatarLab: unknown }).__avatarLab = {
      setView, setSex, run,
      state: () => ({ status, ms, photos: photos.map((p) => ({ role: p.role, faces: p.faces, pose: p.fit?.pose, stats: p.stats, occlusion: p.occlusion, px: p.px ? [33, 133, 263, 362, 168, 6, 234, 454, 10, 152].map((i) => p.px![i]) : null, issues: p.issues, blend: { eyeBlinkLeft: p.blend.eyeBlinkLeft, eyeBlinkRight: p.blend.eyeBlinkRight, jawOpen: p.blend.jawOpen } })), set: built?.set, sexGuess: built?.sexGuess ?? photos[0]?.sex ?? null, model: built ? { sex: built.model.sex, skin: built.model.skin, hair: built.model.hair, metrics: built.model.metrics, views: built.model.views, warnings: built.model.warnings } : null, lightEvened: built?.lightEvened, hairStats: built?.hair ?? null, hairProfile: built?.hairProfile ?? null }),
      atlas: () => built?.atlas.toDataURL("image/jpeg", 0.85) ?? null,
    };
  });
  return (
    <main style={{ padding: 16, fontFamily: "system-ui", background: "#f4f1ec", minHeight: "100vh" }}>
      <h1>Avatar 3D lab</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {["front", "side-a", "side-b"].map((id, i) => <FileButton key={id} id={`lab-${id}`} accept="image/*" onFiles={(fs) => { files.current[i] = fs[0] ?? null; }}>{id}</FileButton>)}
        <button id="lab-run" onClick={run}>run</button>
        <span style={{ width: 160 }}><Select id="lab-sex" aria-label="sexo" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}><option>FEMININO</option><option>MASCULINO</option></Select></span>
        {(["front", "left34", "right34", "profile"] as AvatarView[]).map((v) => <button key={v} onClick={() => setView(v)}>{v}</button>)}
      </div>
      <p id="lab-status">{status} {ms ? `${ms} ms` : ""}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div id="lab-viewer" style={{ width: 480, height: 560, background: "#e9e4dc" }}>
          {built && tex && <AvatarViewer avatar={{ model: built.model, texture: tex }} sex={built.model.sex ?? sex} view={view} />}
        </div>
        {built && <img id="lab-atlas" alt="atlas" src={built.atlas.toDataURL("image/jpeg", 0.8)} style={{ width: 280, height: 280 }} />}
        <pre style={{ maxWidth: 520, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify({ photos: photos.map((p) => ({ role: p.role, faces: p.faces, pose: p.fit?.pose, issues: p.issues })), set: built?.set, skin: built?.model.skin, hair: built?.model.hair }, null, 1)}</pre>
      </div>
    </main>
  );
}

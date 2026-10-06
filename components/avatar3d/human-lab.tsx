"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HumanAvatar, type HumanParts } from "@/components/three/human-avatar";
import { FileButton } from "@/components/ui";
import { exportAvatarGlb } from "@/lib/avatar3d/human/export-glb";
import { StudioLight, type Look3dPiece } from "@/components/three/common";
import { DEFAULT_BODY, type BodyParams, type BodySources } from "@/lib/avatar3d/body-spec";
import { analyzePhoto, buildAvatar, type AnalyzedPhoto, type BuiltAvatar } from "@/lib/avatar3d/pipeline";
import type { Pt } from "@/lib/avatar3d/image-stats";
import type { AvatarHair } from "@/lib/avatar3d/model";
import type { HairLod } from "@/lib/avatar3d/human/hair-lod";
import AvatarStill from "@/components/three/avatar-still";

const P = (id: string, sub: string, url: string): Look3dPiece => ({ id, name: id, slot: sub, subcategory: sub, imageUrl: url });
const OUTFITS: Record<string, Look3dPiece[]> = {
  none: [],
  casual: [P("tee", "t_shirt", "/assets_pecas/01_camiseta_referencia.png"), P("jeans", "jeans", "/assets_pecas/02_Parte_inferior/01_jeans.png"), P("tenis", "sneakers", "/assets_pecas/03_Calcados/01_tenis_casual.png")],
  jaqueta: [P("tee", "t_shirt", "/assets_pecas/01_camiseta_referencia.png"), P("jaqueta", "jacket", "/assets_pecas/14_jacket_jaqueta.png"), P("calca", "chino", "/assets_pecas/02_Parte_inferior/05_calca_chino.png"), P("bota", "boots", "/assets_pecas/03_Calcados/11_bota_cano_curto.png")],
  vestido: [P("vestido", "dress", "/assets_pecas/05_Corpo_inteiro/01_vestido.png"), P("sapatilha", "flats", "/assets_pecas/03_Calcados/17_sapatilha.png")],
  shorts: [P("regata", "tank_top", "/assets_pecas/04_tank_top_regata.png"), P("shorts", "shorts", "/assets_pecas/02_Parte_inferior/13_shorts.png"), P("tenis", "sneakers", "/assets_pecas/03_Calcados/02_tenis_corrida.png")],
  saia: [P("blusa", "blouse", "/assets_pecas/03_blouse_blusa.png"), P("saia", "skirt", "/assets_pecas/02_Parte_inferior/12_saia.png"), P("salto", "heels", "/assets_pecas/03_Calcados/16_salto_alto.png")],
  moletom: [P("moletom", "hoodie", "/assets_pecas/10_hoodie_moletom_com_capuz.png"), P("jeans", "jeans", "/assets_pecas/02_Parte_inferior/01_jeans.png"), P("tenis", "sneakers", "/assets_pecas/03_Calcados/01_tenis_casual.png")],
  descalco: [P("tee", "t_shirt", "/assets_pecas/01_camiseta_referencia.png"), P("jeans", "jeans", "/assets_pecas/02_Parte_inferior/01_jeans.png")],
};

/** Cabelos sintéticos para validar fios e níveis de detalhe sem foto de ninguém. */
const H0: AvatarHair = { present: true, color: "#3b2a1e", top: 15, side: 9, bottom: 2.9, fringe: 0, cut: false, length: "short", texture: "straight", volume: 1 };
const HAIR_PRESETS: Record<string, AvatarHair> = {
  curto: H0,
  medio_ondulado: { ...H0, color: "#5a3a22", length: "medium", texture: "wavy", bottom: -14, fringe: 0.4 },
  longo_liso: { ...H0, color: "#2a1c14", length: "long", texture: "straight", bottom: -24 },
  cacheado: { ...H0, color: "#24170f", length: "medium", texture: "curly", bottom: -12, volume: 1.4 },
  crespo: { ...H0, color: "#1c130d", length: "short", texture: "coily", volume: 1.6 },
  loiro_longo: { ...H0, color: "#b8925a", length: "long", texture: "wavy", bottom: -22 },
  // franjas escolhidas (ajuste "Franja"): reta simétrica, lateral, cortina
  longo_franja_reta: { ...H0, color: "#2a1c14", length: "long", texture: "straight", bottom: -24, fringe: 0.9, fringeStyle: "blunt" },
  chanel_franja_reta: { ...H0, color: "#3b2416", length: "medium", texture: "straight", bottom: -9.8, fringe: 0.9, fringeStyle: "blunt" },
  medio_franja_lateral: { ...H0, color: "#5a3a22", length: "medium", texture: "wavy", bottom: -15, fringe: 0.7, fringeStyle: "side" },
  longo_franja_cortina: { ...H0, color: "#8a6440", length: "long", texture: "wavy", bottom: -22, fringe: 0.6, fringeStyle: "curtain" },
};

/**
 * Óculos sintéticos desenhados sobre a foto (só no laboratório): avaliam a detecção e a remoção de óculos (I4) sem
 * precisar de fotos de pessoas de óculos. Armação escura de grau ou lente escura com armação.
 */
function drawSynthGlasses(src: HTMLCanvasElement, px: Pt[], kind: "frame" | "sun"): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d")!; g.drawImage(src, 0, 0);
  const eye = (o: number, i: number) => { const [ox, oy] = px[o], [ix, iy] = px[i]; const ew = Math.hypot(ox - ix, oy - iy); return { cx: (ox + ix) / 2, cy: (oy + iy) / 2 + ew * 0.12, ew, a: Math.atan2(oy - iy, ox - ix) }; };
  const R = eye(33, 133), L = eye(263, 362);
  const lw = Math.max(2, ((R.ew + L.ew) / 2) * 0.08);
  for (const e of [R, L]) {
    g.save(); g.translate(e.cx, e.cy); g.rotate(e.a > Math.PI / 2 || e.a < -Math.PI / 2 ? e.a + Math.PI : e.a);
    g.beginPath(); g.roundRect(-e.ew * 0.88, -e.ew * 0.62, e.ew * 1.76, e.ew * 1.24, e.ew * 0.35);
    if (kind === "sun") { g.fillStyle = "rgba(18,18,22,0.93)"; g.fill(); }
    g.lineWidth = lw; g.strokeStyle = "#1e1c20"; g.stroke(); g.restore();
  }
  g.lineWidth = lw; g.strokeStyle = "#1e1c20"; g.beginPath();
  g.moveTo(R.cx + (L.cx > R.cx ? 1 : -1) * R.ew * 0.86, R.cy - R.ew * 0.25); g.quadraticCurveTo((R.cx + L.cx) / 2, (R.cy + L.cy) / 2 - R.ew * 0.45, L.cx - (L.cx > R.cx ? 1 : -1) * L.ew * 0.86, L.cy - L.ew * 0.25); g.stroke();
  for (const [e, edge] of [[R, px[234]], [L, px[454]]] as const) {
    const sx = e.cx + Math.sign(edge[0] - e.cx) * e.ew * 0.88; g.beginPath(); g.moveTo(sx, e.cy - e.ew * 0.45); g.lineTo(edge[0], edge[1] - e.ew * 0.55); g.stroke();
  }
  return c;
}

type View = "front" | "left34" | "profile" | "back" | "face" | "face34" | "faceback" | "faceside" | "feet" | "feet34" | "torso" | "torso34" | "torsoback" | "eyes" | "eyes34";
const ANGLE: Record<View, number> = { front: 0, left34: -35, profile: 90, back: 180, face: 0, face34: -35, faceback: 180, faceside: 90, feet: 0, feet34: -40, torso: 0, torso34: -35, torsoback: 180, eyes: 0, eyes34: -30 };

function Cam({ view, H }: { view: View; H: number }) {
  const { camera, scene } = useThree();
  useEffect(() => { (window as unknown as { __labScene: THREE.Scene }).__labScene = scene; }, [scene]);   // capturas: inspecionar materiais
  useEffect(() => {
    const a = (ANGLE[view] * Math.PI) / 180; const face = view.startsWith("face");                  // face* = rosto, gola e cabelo de perto
    if (view.startsWith("eyes")) {                                                                    // olhos bem de perto (pálpebra, córnea, íris)
      const ey = H * 0.934, d = 0.42; camera.position.set(Math.sin(a) * d, ey + 0.004, Math.cos(a) * d); camera.lookAt(0, ey, 0); camera.updateProjectionMatrix(); return;
    }
    const neck = view === "faceback" || view === "faceside";   // cabeça + gola
    const feet = view.startsWith("feet"), torso = view.startsWith("torso");   // calçado e tecido de perto
    const ty = feet ? 0.07 : torso ? H * 0.68 : neck ? H * 0.9 : face ? H * 0.925 : H * 0.52; const d = feet ? 0.75 : torso ? 1.5 : neck ? 1.05 : face ? 0.8 : H * 2.4;
    camera.position.set(Math.sin(a) * d, ty + (face || feet || torso ? (feet ? 0.25 : 0) : 0.05), Math.cos(a) * d); camera.lookAt(0, ty, 0); camera.updateProjectionMatrix();
  }, [view, H, camera]);
  return null;
}

/**
 * Laboratório do corpo humano (desenvolvimento): corpo típico F/M ou o avatar de uma foto (pipeline real: MediaPipe,
 * atlas, cabelo), vistas fixas e movimento ligável; expõe window.__humanLab para as capturas automáticas.
 */
export default function HumanLab() {
  const [sex, setSex] = useState<"FEMININO" | "MASCULINO">("FEMININO");
  const [view, setView] = useState<View>("front"); const [motion, setMotion] = useState(false); const [ready, setReady] = useState(0);
  const [built, setBuilt] = useState<BuiltAvatar | null>(null); const [status, setStatus] = useState("idle"); const [outfit, setOutfit] = useState("none");
  const [cut, setCut] = useState(0); const [synth, setSynth] = useState<"none" | "frame" | "sun">("none");
  const [analyzed, setAnalyzed] = useState<AnalyzedPhoto | null>(null); const [glassesOn, setGlassesOn] = useState(1);
  // corpo com medidas escolhidas (avaliação do digital twin: corpos diferentes com o mesmo código de produção)
  const [bodyParams, setBodyParams] = useState<BodyParams | null>(null);
  const [hairPreset, setHairPreset] = useState<string | null>(null); const [hairLod, setHairLod] = useState<HairLod | undefined>(undefined);
  const [still, setStill] = useState(false); const [stillBytes, setStillBytes] = useState(0);   // Prévia 2D (avatar da foto ou manequim)
  const [wind, setWind] = useState(0.15);                   // vento no cabelo (HAIR-MOTION), 0–1
  const bodySex = built?.model.sex ?? sex;                  // corpo base estimado pelo rosto (ou o botão, sem foto)
  const H = bodyParams?.stature ?? DEFAULT_BODY[bodySex].stature;
  const parts = useRef<HumanParts | null>(null);
  async function glb(): Promise<string | null> {
    const p = parts.current; if (!p) return null; const b = await exportAvatarGlb(p.human, p.pose, { hair: { live: p.hair, build: p.exportHair } });
    const buf = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s);
  }
  async function run(file: File) {
    setStatus("running"); setBuilt(null); setReady(0);
    try {
      let p = await analyzePhoto(file, "front");
      if (synth !== "none" && p.px) p = await analyzePhoto(drawSynthGlasses(p.canvas, p.px, synth), "front");
      setAnalyzed(p); const b = buildAvatar([p], { profileSex: sex }); setBuilt(b); setStatus(b ? "built" : "rejected");
    }
    catch (e) { setStatus("error: " + (e as Error).message); }
  }
  useEffect(() => {
    (window as unknown as { __humanLab: unknown }).__humanLab = { setSex, setView, setMotion, setWind, setOutfit, setCut, setHairPreset, setHairLod, setStill: (v: boolean) => { setStillBytes(0); setStill(v); }, stillBytes: () => stillBytes,
      // métricas agregadas do gate de identidade (números, nunca forma nem cor): fidelidade do rosto e relatório da pele
      identity: () => parts.current?.identity ?? null, skinReport: () => parts.current?.human.root.userData.skinReport ?? null,
      warnings: () => built?.model.warnings ?? [],
      // olhos e óculos (I4): classe, confiança e o que foi detectado (números agregados)
      eyes: () => built?.model.eyes ?? null, setBodyParams,
      // dados do gêmeo para comparar versões NO AMBIENTE LOCAL (forma do rosto e cor: nunca para log nem repositório)
      twin: () => built ? { shape: built.model.shape, skin: built.model.skin, eyes: built.model.eyes ?? null, brows: built.model.brows ?? null, hair: built.model.hair, sex: built.model.sex ?? null } : null,
      bodyMeasures: () => { const p = parts.current; if (!p) return null; const c = p.composed; let lo = Infinity, hi = -Infinity; for (let i = 1; i < c.body.length; i += 3) { lo = Math.min(lo, c.body[i]); hi = Math.max(hi, c.body[i]); } return { stature: hi - lo }; }, atlas: () => built?.atlas.toDataURL("image/png") ?? null, photo: () => analyzed ? { png: analyzed.canvas.toDataURL("image/png"), px: analyzed.px, skin: analyzed.skin } : null,
      // só a análise (sem montar o avatar): foto com óculos sintéticos opcionais, pontos e avisos, para avaliar fora do navegador
      analyze: async (url: string, kind: "none" | "frame" | "sun") => {
        const blob = await (await fetch(url)).blob(); let p = await analyzePhoto(blob, "front");
        if (kind !== "none" && p.px) p = await analyzePhoto(drawSynthGlasses(p.canvas, p.px, kind), "front");
        return { png: p.canvas.toDataURL("image/png"), px: p.px, skin: p.skin, issues: p.issues.map((i) => i.code + ":" + i.severity), glasses: p.glasses };
      }, glasses: () => analyzed?.glasses ?? null, setSynth, setGlassesOn, issues: () => analyzed?.issues.map((i) => i.code + ":" + i.severity) ?? [], hairLod: () => parts.current?.hairLod ?? null, hairStats: () => { const h = parts.current?.hair; if (!h) return null; const g = h.geometry; return { lod: h.userData.hairLod, vertices: g.getAttribute("position").count, triangles: (g.getIndex()?.count ?? 0) / 3, groups: g.groups.map((x) => x.count / 3) }; }, glb, hairVisible: (v: boolean) => { if (parts.current?.hair) parts.current.hair.visible = v; }, sex: () => ({ body: built?.model.sex ?? null, guess: built?.sexGuess ?? null }), ready: () => ready, status: () => status, hair: () => built?.model.hair ?? null, skin: () => built?.model.skin ?? null, profile: () => built?.hairProfile ?? null };
  });
  const model = built?.model ?? null;
  // Prévia 2D do avatar da foto (mesmo caminho do espelho: Avatar3dRef com a textura do atlas)
  const stillAvatar = useMemo(() => (built ? { model: built.model, texture: new THREE.CanvasTexture(built.atlas) } : null), [built]);
  return (
    <main style={{ padding: 16, fontFamily: "system-ui", background: "#f4f1ec", minHeight: "100vh" }}>
      <h1>Corpo humano — lab</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button id="human-sex" onClick={() => setSex(sex === "FEMININO" ? "MASCULINO" : "FEMININO")}>{sex}</button>
        {(["front", "left34", "profile", "back", "face", "face34", "faceback", "faceside", "eyes", "eyes34"] as View[]).map((v) => <button key={v} onClick={() => setView(v)}>{v}</button>)}
        <button onClick={() => setMotion(!motion)}>motion {String(motion)}</button>
        <button onClick={() => setWind(wind > 0.5 ? 0.15 : 0.9)}>vento {wind}</button>
        {Object.keys(OUTFITS).map((o) => <button key={o} onClick={() => setOutfit(o)}>{o}</button>)}
        {Object.keys(HAIR_PRESETS).map((h) => <button key={h} onClick={() => setHairPreset(h)}>{h}</button>)}
        {([0, 1, 2, 3] as HairLod[]).map((l) => <button key={l} onClick={() => setHairLod(l)}>LOD {l}</button>)}
        <button id="human-still-toggle" onClick={() => setStill(!still)}>prévia 2D {String(still)}</button>
        <FileButton id="human-photo" accept="image/*" onFiles={(fs) => { if (fs[0]) void run(fs[0]); }}>Foto</FileButton>
      </div>
      <p id="human-status">{status} · {ready ? "ready" : "loading"}</p>
      <div style={{ display: "flex", gap: 12 }}>
        <div id="human-viewer" style={{ width: 520, height: 720, background: "#e9e4dc" }}>
          <Canvas camera={{ fov: 30, near: 0.05, far: 30 }} gl={{ preserveDrawingBuffer: true, antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; }}>
            <color attach="background" args={["#e9e4dc"]} />
            <StudioLight />
            <hemisphereLight args={["#ffffff", "#cfc6b8", 0.5]} />
            <directionalLight position={[1.2, 2.6, 2.4]} intensity={0.9} />
            <directionalLight position={[-1.6, 2.0, 1.8]} intensity={0.45} />
            <directionalLight position={[0, 2.2, -2.5]} intensity={0.4} />
            <HumanAvatar key={bodySex + (model ? "a" : "") + (bodyParams ? JSON.stringify(bodyParams) : "")} hairLod={hairLod} body={bodyParams ? { sex: bodySex, params: bodyParams, sources: Object.fromEntries(Object.keys(bodyParams).map((k) => [k, "user"])) as BodySources } : { sex: bodySex }} stature={H} adjust={{ hairCut: cut, glasses: glassesOn }} skin={model?.skin ?? (bodySex === "FEMININO" ? "#c99a6e" : "#a97c50")}
              face={model} atlas={built?.atlas ?? null} hair={(hairPreset ? HAIR_PRESETS[hairPreset] : null) ?? model?.hair ?? null} motion={motion} wind={wind}
              debugHair={typeof window !== "undefined" && location.hash === "#hair"} onReady={(p) => { parts.current = p; setReady((r) => r + 1); }}
              pieces={OUTFITS[outfit] ?? []} />
            <Cam view={view} H={H} />
          </Canvas>
        </div>
        {still && <div id="human-still" style={{ width: 360, height: 720, background: "#EEEAE2" }}>
          <AvatarStill avatar={stillAvatar} sex={bodySex} body={null} pieces={OUTFITS[outfit] ?? []} background="#EEEAE2" className="mirror-still" alt="Prévia 2D" onStill={(u) => setStillBytes(u.length)} />
        </div>}
        <pre style={{ fontSize: 11, maxWidth: 420, whiteSpace: "pre-wrap" }}>{JSON.stringify({ hair: model?.hair, profile: built?.hairProfile, skin: model?.skin }, null, 1)}</pre>
      </div>
    </main>
  );
}

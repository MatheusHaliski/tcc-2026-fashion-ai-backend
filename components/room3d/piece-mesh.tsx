"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Cobweb, DustPuff, GoldDot, HangTag, pointer, sketchDraw, useCanvasTex } from "@/components/room3d/room-props";
import type { Ctx, RoomPiece3D } from "./room-scene-types";
import { useTex } from "./use-room-texture";

/**
 * Peça: plano com a foto sem fundo; GLB quando existir. Estados: esquecida (poeira + teia, "puff" ao resgatar),
 * croqui (desenho técnico que ganha cor quando a foto chega), 30 usos (ponto dourado), 2ª chance (etiqueta).
 */
export function PieceMesh({ p, w, h, ctx, lying = false, onPuff }: { p: RoomPiece3D; w: number; h: number; ctx: Ctx; lying?: boolean; onPuff?: () => void }) {
  const { t } = useI18n();
  const tex = useTex(p.imageUrl ?? p.thumbnailUrl);
  const croqui = !!p.states?.includes("CROQUI") || !(p.imageUrl ?? p.thumbnailUrl);
  const sketch = useCanvasTex(`sketch-${p.category}`, 256, 256, sketchDraw(p.category));
  const [glb, setGlb] = useState<THREE.Group | null>(null);
  const [puff, setPuff] = useState(0);
  const highlight = ctx.highlight === p.id;
  useEffect(() => {
    if (!p.model3dUrl) return; let alive = true; const u = mediaUrl(p.model3dUrl); if (!u) return;
    new GLTFLoader().load(u, (g) => { if (!alive) return; const box = new THREE.Box3().setFromObject(g.scene); const s = box.getSize(new THREE.Vector3()); const k = Math.min(w / Math.max(.001, s.x), h / Math.max(.001, s.y), .04 / Math.max(.001, s.z)); const center = box.getCenter(new THREE.Vector3()); g.scene.scale.multiplyScalar(k); g.scene.position.multiplyScalar(k).addScaledVector(center, -k); setGlb(g.scene); }, undefined, () => undefined);
    return () => { alive = false; };
  }, [p.model3dUrl, w, h]);
  // croqui → foto: transição de ~600 ms quando a foto aprovada chega (DET-M03)
  const wasCroqui = useRef(croqui); const fade = useRef<THREE.Mesh>(null); const fadeStart = useRef(-1);
  useEffect(() => { if (wasCroqui.current && !croqui) fadeStart.current = performance.now(); wasCroqui.current = croqui; }, [croqui]);
  const forgotten = !!p.states?.includes("ESQUECIDA");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (highlight && ref.current) (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + 0.2 * Math.sin(clock.elapsedTime * 4);
    if (fade.current) { const t = fadeStart.current < 0 ? 1 : Math.min(1, (performance.now() - fadeStart.current) / 600); (fade.current.material as THREE.MeshBasicMaterial).opacity = 1 - t; fade.current.visible = t < 1; }
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (forgotten && !ctx.reduced) { setPuff((x) => x + 1); onPuff?.(); setTimeout(() => ctx.onPick(p.id), 380); } else ctx.onPick(p.id);
  };
  const map = croqui ? sketch : tex ?? undefined;
  return (
    <group visible={!ctx.engine?.hidden.has(p.id)} rotation={lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {glb && !croqui ? <primitive object={glb} onClick={click} /> : (
        <mesh ref={ref} onClick={click} castShadow {...pointer}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={map} color={map ? (forgotten ? "#b9b4aa" : "#ffffff") : p.colorHex ?? "#cccccc"} transparent alphaTest={croqui ? 0 : 0.08} side={THREE.DoubleSide}
            roughness={0.85} emissive={highlight ? "#ffd54a" : "#000000"} emissiveIntensity={highlight ? 0.35 : 0} />
        </mesh>
      )}
      {!croqui && <mesh ref={fade} position={[0, 0, 0.003]} visible={false}><planeGeometry args={[w, h]} /><meshBasicMaterial map={sketch} transparent opacity={0} depthWrite={false} /></mesh>}
      {forgotten && <><mesh position={[0, 0, 0.004]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#8d8a84" transparent opacity={0.18} depthWrite={false} /></mesh><Cobweb w={w} h={h} /></>}
      <group position={[0, 0, 0.02]}><DustPuff trigger={puff} reduced={ctx.reduced} /></group>
      {p.states?.includes("30_USOS") && <GoldDot position={[-w / 2 + 0.03, h / 2 - 0.03, 0.01]} />}
      {ctx.tagged.has(p.id) && <HangTag text={t("room3d.roomScene.n2_chance")} color="#fde2e4" fg="#9d174d" position={[w / 2 - 0.04, h / 2 - 0.1, 0.02]} />}
      {highlight && <pointLight position={[0, 0, 0.35]} intensity={1.6} distance={1.2} color="#ffe6a0" />}
    </group>
  );
}

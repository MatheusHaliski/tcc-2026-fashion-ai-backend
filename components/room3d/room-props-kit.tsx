"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { tr } from "@/lib/i18n/i18n";

/*
 * Peças básicas dos objetos do Meu Quarto (room-props.tsx): graus, cursor de clique, textura desenhada em canvas,
 * rótulo 3D, croqui da peça sem foto, teia e poeira das esquecidas, etiqueta pendurada e o ponto dourado dos 30 usos.
 */

export const deg = (d: number) => (d * Math.PI) / 180;
const hover = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; },
  onPointerOut: () => { document.body.style.cursor = ""; },
};
export const pointer = hover;

/** Textura desenhada num canvas (rótulos, croqui, teia, post-it) — sem fonte remota. */
export function useCanvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, [key, w, h]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function textTex(text: string, o: { w?: number; h?: number; bg?: string; fg?: string; font?: string; align?: CanvasTextAlign } = {}) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = o.fg ?? "#3a3a3a"; g.font = o.font ?? tr("room3d.roomProps.n600_px_inter_arial_sans", { Math: Math.round(h * 0.42) }); g.textAlign = o.align ?? "center"; g.textBaseline = "middle";
    const lines = text.split("\n"); const lh = h / (lines.length + 0.4);
    lines.forEach((l, i) => g.fillText(l.length > 30 ? l.slice(0, 29) + "…" : l, o.align === "left" ? 8 : w / 2, lh * (i + 0.7)));
  };
}
export function Label3D({ text, w, h, px = 256, bg, fg, font, position, rotation }: { text: string; w: number; h: number; px?: number; bg?: string; fg?: string; font?: string; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ph = Math.round(px * (h / w));
  const tex = useCanvasTex(`${text}|${bg}|${fg}|${font}|${px}`, px, Math.max(16, ph), textTex(text, { bg, fg, font }));
  return <mesh position={position} rotation={rotation}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent toneMapped={false} /></mesh>;
}

// ------------------------------------------------------------------ croqui (DET-M03) e teia (poeira)

/** Desenho técnico por categoria, em traço, para a peça sem foto aprovada. */
export function sketchDraw(category: string) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,120,170,.18)"; g.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = "#2b3440"; g.lineWidth = 3; g.lineJoin = "round"; g.lineCap = "round";
    const P = (pts: [number, number][], close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); if (close) g.closePath(); g.stroke(); };
    if (category === "lower_piece") { P([[.3, .12], [.7, .12], [.76, .9], [.56, .9], [.5, .38], [.44, .9], [.24, .9]]); P([[.3, .2], [.7, .2]], false); }
    else if (category === "shoes_piece") { P([[.12, .62], [.5, .5], [.62, .36], [.78, .38], [.9, .66], [.9, .76], [.12, .76]]); P([[.12, .7], [.9, .7]], false); }
    else if (category === "accessory_piece") { P([[.22, .4], [.78, .4], [.84, .86], [.16, .86]]); g.beginPath(); g.arc(.5 * w, .4 * h, .18 * w, Math.PI, 0); g.stroke(); }
    else if (category === "full_body_piece") { P([[.38, .08], [.62, .08], [.66, .3], [.84, .92], [.16, .92], [.34, .3]]); P([[.35, .3], [.65, .3]], false); }
    else { P([[.34, .1], [.66, .1], [.9, .26], [.8, .42], [.7, .36], [.7, .9], [.3, .9], [.3, .36], [.2, .42], [.1, .26]]); g.beginPath(); g.arc(.5 * w, .1 * h, .08 * w, 0, Math.PI); g.stroke(); }
    g.fillStyle = "#2b3440"; g.font = tr("room3d.roomProps.n600_px_inter_arial", { Math: Math.round(h * 0.055) }); g.textAlign = "center"; g.fillText(tr("room3d.roomProps.croqui_aguardando_foto"), w / 2, h * 0.97);
  };
}
function cobwebDraw(g: CanvasRenderingContext2D, w: number, h: number) {
  g.strokeStyle = "rgba(245,245,245,.85)"; g.lineWidth = 1.4;
  const cx = w, cy = 0;
  for (let a = 0; a <= 6; a++) { const t = Math.PI / 2 + (a / 6) * (Math.PI / 2); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t) * w, cy + Math.sin(t) * h); g.stroke(); }
  for (let r = 1; r <= 5; r++) { g.beginPath(); g.arc(cx, cy, (r / 5) * w * 0.95, Math.PI / 2, Math.PI); g.stroke(); }
}
export function Cobweb({ w, h }: { w: number; h: number }) {
  const t = useCanvasTex("cobweb", 128, 128, cobwebDraw);
  return <mesh position={[w / 2 - 0.06, h / 2 - 0.06, 0.006]}><planeGeometry args={[0.14, 0.14]} /><meshBasicMaterial map={t} transparent depthWrite={false} /></mesh>;
}

/** "Puff" da poeira (DET-D03): ≤ 400 ms de partículas; nada com "reduzir movimento". */
export function DustPuff({ trigger, reduced }: { trigger: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null); const start = useRef(-1);
  const geo = useMemo(() => {
    const n = 40; const pos = new Float32Array(n * 3); const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI; vel.set([Math.cos(a) * Math.sin(b), Math.cos(b) * 0.6 + 0.3, Math.sin(a) * Math.sin(b) * 0.4 + 0.3], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.userData.vel = vel; return g;
  }, []);
  useEffect(() => { if (trigger && !reduced) start.current = performance.now(); }, [trigger, reduced]);
  useFrame(() => {
    const p = ref.current; if (!p) return;
    const t = start.current < 0 ? 1 : (performance.now() - start.current) / 400;
    p.visible = t < 1;
    if (t >= 1) return;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute; const vel = geo.userData.vel as Float32Array;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, vel[i * 3] * t * 0.25, vel[i * 3 + 1] * t * 0.25, vel[i * 3 + 2] * t * 0.25);
    pos.needsUpdate = true; (p.material as THREE.PointsMaterial).opacity = 1 - t;
  });
  return <points ref={ref} geometry={geo} visible={false}><pointsMaterial color="#cfc8bb" size={0.025} transparent opacity={1} depthWrite={false} /></points>;
}

/** Etiqueta de papel pendurada (2ª chance, preço, Garimpo, "para lavar"). */
export function HangTag({ text, color = "#fff7e0", fg = "#3a2f1a", position = [0, 0, 0] as [number, number, number], w = 0.12 }: { text: string; color?: string; fg?: string; position?: [number, number, number]; w?: number }) {
  return (
    <group position={position} rotation={[0, 0, -0.18]}>
      <mesh position={[0, 0.035, 0]}><cylinderGeometry args={[0.0015, 0.0015, 0.05, 4]} /><meshBasicMaterial color="#8a7a5a" /></mesh>
      <Label3D text={text} w={w} h={w * 0.42} px={192} bg={color} fg={fg} position={[0, 0, 0.001]} />
    </group>
  );
}

/** Ponto dourado permanente dos 30 usos (DET-M04). */
export function GoldDot({ position }: { position: [number, number, number] }) {
  return <mesh position={position}><sphereGeometry args={[0.012, 16, 12]} /><meshStandardMaterial color="#E9B949" emissive="#b8860b" emissiveIntensity={0.6} metalness={0.8} roughness={0.25} /></mesh>;
}

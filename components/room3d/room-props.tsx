"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";

/*
 * Objetos e detalhes do Meu Quarto (docs/meu-quarto/05-elementos-do-quarto.md), todos procedurais — sem modelos
 * externos: busto de costura, interruptor, janela com a luz do horário, luzes do closet, Caixa FAI, gancho das chaves,
 * quadro de cortiça, calendário, sachê e meia sem par, croqui, poeira/teia, etiquetas e fita de alfaiate.
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
    g.fillStyle = o.fg ?? "#3a3a3a"; g.font = o.font ?? `600 ${Math.round(h * 0.42)}px Inter, Arial, sans-serif`; g.textAlign = o.align ?? "center"; g.textBaseline = "middle";
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
    g.fillStyle = "#2b3440"; g.font = `600 ${Math.round(h * 0.055)}px Inter, Arial`; g.textAlign = "center"; g.fillText("croqui · aguardando foto", w / 2, h * 0.97);
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

// ------------------------------------------------------------------ gaveta vazia com charme (DET-D08)

export function EmptyDrawerCharm({ width, onAdd }: { width: number; onAdd: () => void }) {
  return (
    <group>
      {/* sachê de lavanda */}
      <group position={[-width * 0.2, 0.02, 0.02]}>
        <RoundedBox args={[0.07, 0.025, 0.05]} radius={0.01}><meshStandardMaterial color="#b9a3d6" roughness={1} /></RoundedBox>
        <mesh position={[0, 0.018, 0]}><sphereGeometry args={[0.009, 8, 8]} /><meshStandardMaterial color="#7a5ca8" /></mesh>
      </group>
      {/* meia sem par — tocar abre "Adicionar peça a esta gaveta" */}
      <group position={[width * 0.16, 0.012, 0.03]} rotation={[-Math.PI / 2, 0, 0.5]} onClick={(e) => { e.stopPropagation(); onAdd(); }} {...hover}>
        <mesh><boxGeometry args={[0.035, 0.09, 0.008]} /><meshStandardMaterial color="#e57c5f" roughness={1} /></mesh>
        <mesh position={[0.02, -0.045, 0]}><boxGeometry args={[0.05, 0.03, 0.008]} /><meshStandardMaterial color="#e57c5f" roughness={1} /></mesh>
        <mesh position={[0, 0.04, 0.0045]}><boxGeometry args={[0.036, 0.012, 0.002]} /><meshStandardMaterial color="#f3efe6" /></mesh>
      </group>
      <Label3D text="+ adicionar peça" w={width * 0.8} h={0.03} px={256} fg="#4a3f6b" position={[0, 0.07, 0.08]} />
    </group>
  );
}

// ------------------------------------------------------------------ busto de costura (Copilot, DET-G02)

/** Manequim de costura sem rosto no canto: gira para quem fala e aponta a posição citada pelo Copilot. */
export function DressForm({ position, pointAt, talking, onClick, reduced }: { position: [number, number, number]; pointAt: [number, number, number] | null; talking: boolean; onClick: () => void; reduced: boolean }) {
  const g = useRef<THREE.Group>(null);
  const torso = useMemo(() => {
    const pts = [[0.001, 0], [0.12, 0.02], [0.16, 0.12], [0.13, 0.28], [0.15, 0.42], [0.17, 0.5], [0.1, 0.56], [0.05, 0.58], [0.04, 0.64], [0.001, 0.66]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 32);
  }, []);
  useFrame((_, dt) => {
    const o = g.current; if (!o) return;
    let want = 0;
    if (pointAt) { const dx = pointAt[0] - position[0], dz = pointAt[2] - position[2]; want = Math.atan2(dx, dz); }
    else if (talking) want = deg(-20);
    o.rotation.y = reduced ? want : THREE.MathUtils.damp(o.rotation.y, want, 4, dt);
  });
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }} {...hover}>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.16, 0.18, 0.03, 24]} /><meshStandardMaterial color="#3b2f28" roughness={0.6} /></mesh>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.014, 0.014, 0.95, 10]} /><meshStandardMaterial color="#b89a5a" metalness={0.8} roughness={0.3} /></mesh>
      <group ref={g} position={[0, 0.95, 0]}>
        <mesh geometry={torso} castShadow><meshStandardMaterial color="#e6dccb" roughness={0.95} /></mesh>
        {/* costura central e braço-ponteiro (aponta a posição citada) */}
        <mesh position={[0, 0.3, 0.155]}><boxGeometry args={[0.004, 0.46, 0.004]} /><meshStandardMaterial color="#8a6a4a" /></mesh>
        <mesh position={[0.16, 0.44, 0.08]} rotation={[pointAt ? -1.35 : -0.2, 0, pointAt ? -0.2 : 0.35]}><cylinderGeometry args={[0.012, 0.01, 0.3, 8]} /><meshStandardMaterial color="#e6dccb" /></mesh>
        <mesh position={[0, 0.66, 0]}><cylinderGeometry args={[0.03, 0.03, 0.04, 12]} /><meshStandardMaterial color="#b89a5a" metalness={0.8} roughness={0.3} /></mesh>
        {talking && <pointLight position={[0, 0.3, 0.4]} intensity={0.6} distance={1} color="#ffe6a0" />}
      </group>
      <Label3D text="Copilot" w={0.22} h={0.05} fg="#6b5a4a" position={[0, 0.07, 0.19]} />
    </group>
  );
}

// ------------------------------------------------------------------ interruptor, janela, luzes do closet

/** Interruptor de luz = modo escuro (DET-D01), sincronizado com as Configurações. */
export function LightSwitch({ position, rotation, on, onToggle }: { position: [number, number, number]; rotation?: [number, number, number]; on: boolean; onToggle: () => void }) {
  const lever = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (lever.current) lever.current.rotation.x = THREE.MathUtils.damp(lever.current.rotation.x, on ? -0.35 : 0.35, 12, dt); });
  return (
    <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onToggle(); }} {...hover}>
      <RoundedBox args={[0.09, 0.13, 0.012]} radius={0.006}><meshStandardMaterial color="#f7f5f0" roughness={0.5} /></RoundedBox>
      <mesh ref={lever} position={[0, 0, 0.012]}><boxGeometry args={[0.03, 0.05, 0.014]} /><meshStandardMaterial color={on ? "#fff3c4" : "#dcd8cf"} emissive={on ? "#ffcf6a" : "#000"} emissiveIntensity={on ? 0.4 : 0} /></mesh>
      <Label3D text={on ? "claro" : "escuro"} w={0.09} h={0.022} fg="#8a8578" position={[0, -0.085, 0.001]} />
    </group>
  );
}

const SKY: Record<string, [string, string]> = { morning: ["#bcd8f2", "#e8f1fa"], afternoon: ["#f6d7a0", "#fbe9c6"], golden: ["#f29b58", "#f7c98b"], night: ["#141a36", "#2a2f58"], fixed: ["#dfe6ea", "#f1f3f4"] };
/** Janela com a luz do horário real (DET-D02) e a decoração discreta das datas sazonais (DET-G07). */
export function RoomWindow({ position, period, seasonal }: { position: [number, number, number]; period: string; seasonal?: string | null }) {
  const [a, b] = SKY[period] ?? SKY.fixed;
  const sky = useCanvasTex(`sky-${period}`, 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (period === "night") { g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(w * 0.72, h * 0.28, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(w * 0.76, h * 0.25, 11, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect((i * 37) % w, (i * 53) % (h * 0.6), 2, 2); } }
    else { g.fillStyle = "rgba(255,255,255,.75)"; [[0.25, 0.3], [0.62, 0.22]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w * x, h * y, 18, 7, 0, 0, Math.PI * 2); g.fill(); }); }
  });
  const warm = period === "golden" || period === "afternoon";
  return (
    <group position={position}>
      <mesh><planeGeometry args={[1.0, 1.1]} /><meshBasicMaterial map={sky} toneMapped={false} /></mesh>
      {/* caixilho */}
      {[[0, 0.56, 1.06, 0.04], [0, -0.56, 1.06, 0.04], [-0.51, 0, 0.04, 1.16], [0.51, 0, 0.04, 1.16], [0, 0, 0.025, 1.1], [0, 0.05, 1.0, 0.025]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.012]}><boxGeometry args={[w, h, 0.03]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>))}
      <mesh position={[0, -0.6, 0.06]}><boxGeometry args={[1.12, 0.03, 0.14]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {/* cortinas */}
      {[-0.66, 0.66].map((x) => <mesh key={x} position={[x, 0.02, 0.05]}><boxGeometry args={[0.2, 1.3, 0.03]} /><meshStandardMaterial color={period === "night" ? "#4a4660" : "#d9cbb8"} roughness={1} /></mesh>)}
      {period !== "night" && <spotLight position={[0, 0.2, 0.3]} target-position={[0.4, -2, 2.5]} angle={0.6} penumbra={0.8} intensity={warm ? 2.2 : 1.2} color={warm ? "#ffcf8a" : "#dfeaff"} distance={6} />}
      {seasonal === "festa_junina" && <group position={[0, 0.62, 0.08]}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-0.56 + i * 0.14, -0.04 - Math.sin((i / 8) * Math.PI) * 0.06, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.04, 0.07, 3]} /><meshStandardMaterial color={["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#457b9d"][i % 5]} /></mesh>)}</group>}
      {seasonal === "fim_de_ano" && <group position={[0, 0.6, 0.08]}>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.55 + i * 0.1, -0.03 - Math.sin((i / 11) * Math.PI) * 0.05, 0]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissive={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissiveIntensity={0.9} /></mesh>)}</group>}
      {seasonal === "fashion_revolution_week" && <Label3D text="Vista o que você tem" w={0.8} h={0.08} px={512} bg="#111" fg="#fff" position={[0, -0.72, 0.06]} />}
    </group>
  );
}

/** Abajur da noite. */
export function Lamp({ position, on }: { position: [number, number, number]; on: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.012, 0.012, 0.6, 8]} /><meshStandardMaterial color="#6b5a4a" /></mesh>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.1, 0.12, 0.02, 20]} /><meshStandardMaterial color="#6b5a4a" /></mesh>
      <mesh position={[0, 0.66, 0]}><cylinderGeometry args={[0.1, 0.16, 0.18, 24, 1, true]} /><meshStandardMaterial color="#f3e2c1" emissive={on ? "#ffcf8a" : "#000"} emissiveIntensity={on ? 0.9 : 0} side={THREE.DoubleSide} /></mesh>
      {on && <pointLight position={[0, 0.6, 0]} intensity={2.2} distance={3.5} color="#ffcf8a" />}
    </group>
  );
}

/** Luzes do closet (RF29): uma lâmpada por marco do Inventory Score. */
export function ClosetLights({ y, width, milestones, celebrate, reduced }: { y: number; width: number; milestones: { at: number; label: string; lit: boolean }[]; celebrate: boolean; reduced: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return; const mat = m.material as THREE.MeshStandardMaterial;
      const on = milestones[i]?.lit;
      mat.emissiveIntensity = !on ? 0 : celebrate && !reduced ? 0.8 + 0.6 * Math.max(0, Math.sin(clock.elapsedTime * 6 - i * 0.7)) : 1.1;
    });
  });
  const n = milestones.length;
  return (
    <group position={[0, y, 0.28]}>
      <mesh position={[0, 0.01, -0.02]}><boxGeometry args={[width, 0.012, 0.012]} /><meshStandardMaterial color="#3a3a3a" /></mesh>
      {milestones.map((m, i) => (
        <group key={m.at} position={[-width / 2 + (width / (n + 1)) * (i + 1), 0, 0]}>
          <mesh position={[0, 0.03, -0.02]}><cylinderGeometry args={[0.002, 0.002, 0.04, 4]} /><meshBasicMaterial color="#3a3a3a" /></mesh>
          <mesh ref={(r) => { refs.current[i] = r; }}><sphereGeometry args={[0.026, 16, 12]} /><meshStandardMaterial color={m.lit ? "#fff2c2" : "#bdb8ae"} emissive="#ffd27a" emissiveIntensity={0} transparent opacity={0.95} /></mesh>
          {m.lit && <pointLight position={[0, -0.05, 0.05]} intensity={0.25} distance={0.8} color="#ffe2a0" />}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ Caixa FAI e gancho das chaves

/** Caixa FAI (RF30): entrega do item comprado; ao tocar, a tampa abre e o item "se monta sozinho". */
export function FaiBox({ position, count, opening, onOpen }: { position: [number, number, number]; count: number; opening: boolean; onOpen: () => void }) {
  const lid = useRef<THREE.Group>(null); const item = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (lid.current) lid.current.rotation.x = THREE.MathUtils.damp(lid.current.rotation.x, opening ? -2.1 : 0, 6, dt);
    if (item.current) { item.current.position.y = THREE.MathUtils.damp(item.current.position.y, opening ? 0.42 : 0.1, 4, dt); item.current.rotation.y += opening ? dt * 3 : 0; }
  });
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onOpen(); }} {...hover}>
      <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.36, 0.24, 0.3]} /><meshStandardMaterial color="#c9a57a" roughness={1} /></mesh>
      <mesh position={[0, 0.12, 0.151]}><planeGeometry args={[0.36, 0.05]} /><meshStandardMaterial color="#e8d3a8" /></mesh>
      <Label3D text="FAI" w={0.14} h={0.07} fg="#3a2f1a" font="700 40px Georgia, serif" position={[0, 0.17, 0.152]} />
      <group ref={lid} position={[0, 0.24, -0.15]}><mesh position={[0, 0.005, 0.15]}><boxGeometry args={[0.37, 0.012, 0.31]} /><meshStandardMaterial color="#b8936a" roughness={1} /></mesh></group>
      <mesh ref={item} position={[0, 0.1, 0]}><octahedronGeometry args={[0.07]} /><meshStandardMaterial color="#E9B949" metalness={0.7} roughness={0.25} emissive="#b8860b" emissiveIntensity={0.35} /></mesh>
      {count > 1 && <Label3D text={`×${count}`} w={0.08} h={0.05} bg="#C6275E" fg="#fff" position={[0.16, 0.28, 0.16]} />}
    </group>
  );
}

/** Gancho da Chave do Quarto (DET-K05): uma chave por pessoa convidada, com a inicial no chaveiro. */
export function KeyHook({ position, rotation, keys, onClick }: { position: [number, number, number]; rotation?: [number, number, number]; keys: { username: string }[]; onClick: () => void }) {
  return (
    <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onClick(); }} {...hover}>
      <mesh><boxGeometry args={[0.34, 0.06, 0.02]} /><meshStandardMaterial color="#8a6a4a" roughness={0.6} /></mesh>
      {Array.from({ length: Math.max(3, Math.min(5, keys.length)) }, (_, i) => {
        const k = keys[i]; const x = -0.12 + i * 0.06;
        return (
          <group key={i} position={[x, -0.01, 0.02]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.004, 0.004, 0.03, 6]} /><meshStandardMaterial color="#c9c3b5" metalness={0.8} roughness={0.3} /></mesh>
            {k && <group position={[0, -0.06, 0.02]}>
              <mesh><torusGeometry args={[0.012, 0.003, 8, 16]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} /></mesh>
              <mesh position={[0, -0.035, 0]}><boxGeometry args={[0.006, 0.05, 0.003]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} /></mesh>
              <Label3D text={k.username.slice(0, 1).toUpperCase()} w={0.024} h={0.024} px={64} bg="#1F7A76" fg="#fff" position={[0, -0.075, 0.002]} />
            </group>}
          </group>
        );
      })}
      <Label3D text={keys.length ? `${keys.length} chave(s)` : "chave do quarto"} w={0.3} h={0.035} fg="#6b5a4a" position={[0, 0.06, 0.011]} />
    </group>
  );
}

// ------------------------------------------------------------------ desafios ativos (RF36.CA13)

/** Quadro de cortiça do 10×10: os 10 dias com cada look como polaroide. */
export function CorkBoard({ position, days = 10, polaroids }: { position: [number, number, number]; days?: number; polaroids: { schemeId: string; coverImageUrl?: string | null }[] }) {
  const n = Math.min(10, days);
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.9, 0.62, 0.025]} /><meshStandardMaterial color="#b98b5a" roughness={1} /></mesh>
      <mesh position={[0, 0, -0.004]}><boxGeometry args={[0.96, 0.68, 0.02]} /><meshStandardMaterial color="#6b4a2c" /></mesh>
      <Label3D text="10×10" w={0.2} h={0.05} fg="#3a2412" font="700 30px Georgia, serif" position={[-0.33, 0.26, 0.014]} />
      {Array.from({ length: n }, (_, i) => <Polaroid key={i} index={i} url={polaroids[i]?.coverImageUrl ?? null} filled={!!polaroids[i]} />)}
    </group>
  );
}
function Polaroid({ index, url, filled }: { index: number; url: string | null; filled: boolean }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => { const u = mediaUrl(url); if (!u || u.endsWith("null")) return; const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous"); l.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); }, undefined, () => undefined); }, [url]);
  const col = index % 5, row = Math.floor(index / 5);
  return (
    <group position={[-0.34 + col * 0.17, 0.08 - row * 0.24, 0.016]} rotation={[0, 0, ((index * 37) % 9 - 4) * 0.02]}>
      <mesh><planeGeometry args={[0.13, 0.16]} /><meshStandardMaterial color={filled ? "#fbfaf6" : "#e9e2d2"} /></mesh>
      <mesh position={[0, 0.012, 0.001]}><planeGeometry args={[0.11, 0.11]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : filled ? "#d6cfc2" : "#d9cdb4"} /></mesh>
      <mesh position={[0, 0.075, 0.004]}><sphereGeometry args={[0.008, 8, 8]} /><meshStandardMaterial color="#C6275E" /></mesh>
      <Label3D text={`dia ${index + 1}`} w={0.1} h={0.02} fg="#6b5a4a" position={[0, -0.064, 0.002]} />
    </group>
  );
}

/** Calendário de parede do Sem Repetir: dias seguidos marcados com X. */
export function WallCalendar({ position, days }: { position: [number, number, number]; days: number }) {
  const tex = useCanvasTex(`cal-${days}`, 256, 300, (g, w, h) => {
    g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#C6275E"; g.fillRect(0, 0, w, 54);
    g.fillStyle = "#fff"; g.font = "700 26px Inter, Arial"; g.textAlign = "center"; g.fillText("Sem Repetir", w / 2, 36);
    for (let i = 0; i < 28; i++) {
      const x = 14 + (i % 7) * 33, y = 70 + Math.floor(i / 7) * 52;
      g.strokeStyle = "#d8d2c6"; g.strokeRect(x, y, 30, 46); g.fillStyle = "#6b5a4a"; g.font = "500 12px Inter"; g.textAlign = "left"; g.fillText(String(i + 1), x + 3, y + 13);
      if (i < days) { g.strokeStyle = "#C6275E"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 5, y + 16); g.lineTo(x + 25, y + 42); g.moveTo(x + 25, y + 16); g.lineTo(x + 5, y + 42); g.stroke(); g.lineWidth = 1; }
    }
  });
  return <group position={position}><mesh><planeGeometry args={[0.36, 0.42]} /><meshStandardMaterial map={tex} /></mesh><mesh position={[0, 0.215, 0.004]}><boxGeometry args={[0.38, 0.02, 0.01]} /><meshStandardMaterial color="#6b5a4a" /></mesh></group>;
}

/** Fita de alfaiate (Temporada Cápsula): faixa amarela graduada atravessando os puxadores trancados. */
export function TailorTape({ width, position, rotation }: { width: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const tex = useCanvasTex("tape", 512, 32, (g, w, h) => {
    g.fillStyle = "#f2d04b"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a2f1a"; g.font = "600 12px Inter"; g.textAlign = "center";
    for (let i = 0; i < 64; i++) { const x = i * 8; g.fillRect(x, 0, 1, i % 5 === 0 ? 12 : 6); if (i % 10 === 0) g.fillText(String(i), x + 2, h - 6); }
  });
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, 0.03]} /><meshStandardMaterial map={tex} side={THREE.DoubleSide} /></mesh>;
}

/** Brilho de conquista no espelho (Luzes do closet + marco novo). */
export function Sparkles({ count = 24, radius = 0.35, reduced }: { count?: number; radius?: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => { const p = new Float32Array(count * 3); for (let i = 0; i < count; i++) p.set([(Math.random() - 0.5) * radius * 2, Math.random() * radius * 3, 0.03], i * 3); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3)); return g; }, [count, radius]);
  useFrame(({ clock }) => { if (ref.current && !reduced) { (ref.current.material as THREE.PointsMaterial).opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5); ref.current.rotation.z = Math.sin(clock.elapsedTime) * 0.05; } });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#ffe08a" size={0.03} transparent opacity={0.9} depthWrite={false} /></points>;
}

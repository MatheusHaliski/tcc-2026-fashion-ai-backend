"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { pointer as hover, Label3D, useCanvasTex } from "./room-props-kit";

/* Caixa FAI, gancho das chaves e os elementos dos desafios ativos (cortiça, calendário, fita de alfaiate, brilho). */

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
  const { t } = useI18n();
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
      <Label3D text={keys.length ? t("room3d.roomProps.chave_s", { keysCount: keys.length }) : t("room3d.roomProps.chave_do_quarto")} w={0.3} h={0.035} fg="#6b5a4a" position={[0, 0.06, 0.011]} />
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
  const { t } = useI18n();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => { const u = mediaUrl(url); if (!u || u.endsWith("null")) return; const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous"); l.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); }, undefined, () => undefined); }, [url]);
  const col = index % 5, row = Math.floor(index / 5);
  return (
    <group position={[-0.34 + col * 0.17, 0.08 - row * 0.24, 0.016]} rotation={[0, 0, ((index * 37) % 9 - 4) * 0.02]}>
      <mesh><planeGeometry args={[0.13, 0.16]} /><meshStandardMaterial color={filled ? "#fbfaf6" : "#e9e2d2"} /></mesh>
      <mesh position={[0, 0.012, 0.001]}><planeGeometry args={[0.11, 0.11]} /><meshStandardMaterial map={tex ?? undefined} color={tex ? "#fff" : filled ? "#d6cfc2" : "#d9cdb4"} /></mesh>
      <mesh position={[0, 0.075, 0.004]}><sphereGeometry args={[0.008, 8, 8]} /><meshStandardMaterial color="#C6275E" /></mesh>
      <Label3D text={t("room3d.roomProps.dia", { value: index + 1 })} w={0.1} h={0.02} fg="#6b5a4a" position={[0, -0.064, 0.002]} />
    </group>
  );
}

/** Calendário de parede do Sem Repetir: dias seguidos marcados com X. */
export function WallCalendar({ position, days }: { position: [number, number, number]; days: number }) {
  const { t } = useI18n();
  const tex = useCanvasTex(`cal-${days}`, 256, 300, (g, w, h) => {
    g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#C6275E"; g.fillRect(0, 0, w, 54);
    g.fillStyle = "#fff"; g.font = t("room3d.roomProps.n700_26px_inter_arial"); g.textAlign = "center"; g.fillText(t("room3d.roomProps.sem_repetir"), w / 2, 36);
    for (let i = 0; i < 28; i++) {
      const x = 14 + (i % 7) * 33, y = 70 + Math.floor(i / 7) * 52;
      g.strokeStyle = "#d8d2c6"; g.strokeRect(x, y, 30, 46); g.fillStyle = "#6b5a4a"; g.font = t("room3d.roomProps.n500_12px_inter"); g.textAlign = "left"; g.fillText(String(i + 1), x + 3, y + 13);
      if (i < days) { g.strokeStyle = "#C6275E"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 5, y + 16); g.lineTo(x + 25, y + 42); g.moveTo(x + 25, y + 16); g.lineTo(x + 5, y + 42); g.stroke(); g.lineWidth = 1; }
    }
  });
  return <group position={position}><mesh><planeGeometry args={[0.36, 0.42]} /><meshStandardMaterial map={tex} /></mesh><mesh position={[0, 0.215, 0.004]}><boxGeometry args={[0.38, 0.02, 0.01]} /><meshStandardMaterial color="#6b5a4a" /></mesh></group>;
}

/** Fita de alfaiate (Temporada Cápsula): faixa amarela graduada atravessando os puxadores trancados. */
export function TailorTape({ width, position, rotation }: { width: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const { t } = useI18n();
  const tex = useCanvasTex("tape", 512, 32, (g, w, h) => {
    g.fillStyle = "#f2d04b"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a2f1a"; g.font = t("room3d.roomProps.n600_12px_inter"); g.textAlign = "center";
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

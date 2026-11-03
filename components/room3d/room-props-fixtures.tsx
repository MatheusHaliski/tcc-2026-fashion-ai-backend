"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useI18n } from "@/lib/i18n/i18n";
import { deg, pointer as hover, Label3D, useCanvasTex } from "./room-props-kit";

/* Objetos fixos do Meu Quarto: gaveta vazia, busto de costura, interruptor, janela e sol, porta, abajur e luzes do closet. */

// ------------------------------------------------------------------ gaveta vazia com charme (DET-D08)

export function EmptyDrawerCharm({ width, onAdd }: { width: number; onAdd: () => void }) {
  const { t } = useI18n();
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
      <Label3D text={t("room3d.roomProps.adicionar_peca")} w={width * 0.8} h={0.03} px={256} fg="#4a3f6b" position={[0, 0.07, 0.08]} />
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
  const { t } = useI18n();
  const lever = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (lever.current) lever.current.rotation.x = THREE.MathUtils.damp(lever.current.rotation.x, on ? -0.35 : 0.35, 12, dt); });
  return (
    <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onToggle(); }} {...hover}>
      <RoundedBox args={[0.09, 0.13, 0.012]} radius={0.006}><meshStandardMaterial color="#f7f5f0" roughness={0.5} /></RoundedBox>
      <mesh ref={lever} position={[0, 0, 0.012]}><boxGeometry args={[0.03, 0.05, 0.014]} /><meshStandardMaterial color={on ? "#fff3c4" : "#dcd8cf"} emissive={on ? "#ffcf6a" : "#000"} emissiveIntensity={on ? 0.4 : 0} /></mesh>
      <Label3D text={on ? t("room3d.roomProps.claro") : t("room3d.roomProps.escuro")} w={0.09} h={0.022} fg="#8a8578" position={[0, -0.085, 0.001]} />
    </group>
  );
}

const SKY: Record<string, [string, string]> = { morning: ["#bcd8f2", "#e8f1fa"], afternoon: ["#f6d7a0", "#fbe9c6"], golden: ["#f29b58", "#f7c98b"], night: ["#141a36", "#2a2f58"], fixed: ["#dfe6ea", "#f1f3f4"] };
/**
 * Janela com a luz do horário real (DET-D02) e a decoração discreta das datas sazonais (DET-G07). `light={false}`: a 2ª
 * janela do quarto não acende outro holofote (uma luz por pixel a mais em toda a cena).
 */
export function RoomWindow({ position, period, seasonal, light = true }: { position: [number, number, number]; period: string; seasonal?: string | null; light?: boolean }) {
  const { t } = useI18n();
  const [a, b] = SKY[period] ?? SKY.fixed;
  const sky = useCanvasTex(`sky-${period}`, 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (period === "night") { g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(w * 0.72, h * 0.28, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(w * 0.76, h * 0.25, 11, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect((i * 37) % w, (i * 53) % (h * 0.6), 2, 2); } }
    else { g.fillStyle = "rgba(255,255,255,.75)"; [[0.25, 0.3], [0.62, 0.22]].forEach(([x, y]) => { g.beginPath(); g.ellipse(w * x, h * y, 18, 7, 0, 0, Math.PI * 2); g.fill(); }); }
  });
  return (
    <group position={position}>
      <mesh><planeGeometry args={[1.0, 1.1]} /><meshBasicMaterial map={sky} toneMapped={false} /></mesh>
      {/* caixilho */}
      {[[0, 0.56, 1.06, 0.04], [0, -0.56, 1.06, 0.04], [-0.51, 0, 0.04, 1.16], [0.51, 0, 0.04, 1.16], [0, 0, 0.025, 1.1], [0, 0.05, 1.0, 0.025]].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.012]}><boxGeometry args={[w, h, 0.03]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>))}
      <mesh position={[0, -0.6, 0.06]}><boxGeometry args={[1.12, 0.03, 0.14]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {/* cortinas */}
      {[-0.66, 0.66].map((x) => <mesh key={x} position={[x, 0.02, 0.05]}><boxGeometry args={[0.2, 1.3, 0.03]} /><meshStandardMaterial color={period === "night" ? "#4a4660" : "#d9cbb8"} roughness={1} /></mesh>)}
      {light && <WindowLight position={[0, 0, 0]} period={period} />}
      {seasonal === "festa_junina" && <group position={[0, 0.62, 0.08]}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[-0.56 + i * 0.14, -0.04 - Math.sin((i / 8) * Math.PI) * 0.06, 0]} rotation={[0, 0, Math.PI]}><coneGeometry args={[0.04, 0.07, 3]} /><meshStandardMaterial color={["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#457b9d"][i % 5]} /></mesh>)}</group>}
      {seasonal === "fim_de_ano" && <group position={[0, 0.6, 0.08]}>{Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.55 + i * 0.1, -0.03 - Math.sin((i / 11) * Math.PI) * 0.05, 0]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissive={["#ffd166", "#ef476f", "#06d6a0"][i % 3]} emissiveIntensity={0.9} /></mesh>)}</group>}
      {seasonal === "fashion_revolution_week" && <Label3D text={t("room3d.roomProps.vista_o_que_voce_tem")} w={0.8} h={0.08} px={512} bg="#111" fg="#fff" position={[0, -0.72, 0.06]} />}
    </group>
  );
}

/**
 * Holofote da janela (o sol entrando; some à noite), com origem no meio da janela. No quarto de quatro paredes ele fica
 * fora da parede: escondida a parede atrás da câmera, a luz do quarto não apaga nem troca os shaders de todos os materiais.
 */
export function WindowLight({ position, period }: { position: [number, number, number]; period: string }) {
  const warm = period === "golden" || period === "afternoon";
  // o alvo do holofote fica dentro do grupo (na cena): fora dela a matriz dele nunca atualiza e a luz mira a origem
  const target = useMemo(() => new THREE.Object3D(), []);
  if (period === "night") return null;
  return (
    <group position={position} name="window-light">
      <primitive object={target} position={[0.4, -2, 2.5]} />
      <spotLight position={[0, 0.2, 0.3]} target={target} angle={0.6} penumbra={0.8} intensity={warm ? 2.2 : 1.2} color={warm ? "#ffcf8a" : "#dfeaff"} distance={6} />
    </group>
  );
}

/**
 * Porta do quarto, fechada: batente (montantes + travessa numa malha só), folha de madeira e maçaneta de latão — 3
 * chamadas de desenho, sem luz e sem sombra projetada. Origem no chão, no meio do vão; +z para dentro do quarto. A
 * dobradiça fica do lado esquerdo (do canto); o clique é opcional (a chave do quarto, como o gancho ao lado).
 */
export function RoomDoor({ position, rotation, onClick, night }: { position: [number, number, number]; rotation?: [number, number, number]; onClick?: () => void; night?: boolean }) {
  const frame = useMemo(() => {
    const part = (w: number, h: number, x: number, y: number) => new THREE.BoxGeometry(w, h, 0.1).translate(x, y, 0);
    return mergeGeometries([part(0.06, 2.11, -0.43, 1.055), part(0.06, 2.11, 0.43, 1.055), part(0.92, 0.06, 0, 2.08)])!;
  }, []);
  return (
    <group position={position} rotation={rotation} onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined} {...(onClick ? hover : {})}>
      <mesh geometry={frame} receiveShadow><meshStandardMaterial color={night ? "#c9c4b8" : "#f4f1ea"} roughness={0.6} /></mesh>
      <mesh position={[0, 1.025, 0.02]} receiveShadow><boxGeometry args={[0.8, 2.05, 0.04]} /><meshStandardMaterial color={night ? "#6e5a45" : "#b98f63"} roughness={0.7} /></mesh>
      <mesh position={[0.32, 1.0, 0.06]}><sphereGeometry args={[0.03, 16, 12]} /><meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} /></mesh>
    </group>
  );
}

/** Abajur da noite. */
export function Lamp({ position, on, intensity = 1 }: { position: [number, number, number]; on: boolean; intensity?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.012, 0.012, 0.6, 8]} /><meshStandardMaterial color="#C9A227" metalness={0.72} roughness={0.28} /></mesh>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.1, 0.12, 0.02, 20]} /><meshStandardMaterial color="#1245a8" roughness={0.55} /></mesh>
      <mesh position={[0, 0.66, 0]}><cylinderGeometry args={[0.1, 0.16, 0.18, 24, 1, true]} /><meshStandardMaterial color="#f3e2c1" emissive={on ? "#ffcf8a" : "#000"} emissiveIntensity={on ? 0.9 : 0} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.57, 0]}><torusGeometry args={[0.13, 0.012, 8, 24]} /><meshStandardMaterial color="#f58220" roughness={0.4} /></mesh>
      {on && <pointLight position={[0, 0.6, 0]} intensity={2.2 * intensity} distance={3.5} color="#ffcf8a" />}
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

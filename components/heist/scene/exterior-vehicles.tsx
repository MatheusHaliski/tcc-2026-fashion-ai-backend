"use client";
/*
 * MET Gala Heist v2 — os carros da noite: limusines pretas no meio-fio da entrada (com os faróis acesos), o SUV dos
 * seguranças do outro lado, a viatura (giroflex vermelho e azul), o caminhão branco do bufê (portas de trás para o
 * oeste, onde fica o uniforme) e os dois carros da fuga. Silhuetas por perfil extrudado com caixas de roda, estufa de vidro
 * escuro, teto, frisos cromados, rodas, faróis e lanternas — pintura com verniz que reflete a rua molhada.
 *
 * Cada carro ocupa exatamente a caixa de colisão dele em baseProps(); a frente segue o sentido da via (mão dupla, quem para
 * no meio-fio do museu está indo para o oeste).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { floorY } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { boxGeo, carShell, merge, place } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { cateringTex, signTex, SIGNAGE, type Quality } from "./exterior-textures";

interface CarSpec { L: number; W: number; belt: number; roof: number; hood: number; trunk: number; ws: number; rw: number; front: number; rear: number; R: number; clear: number }
const SPECS = {
  limo: { L: 6.0, W: 1.8, belt: 0.9, roof: 1.42, hood: 1.35, trunk: 1.0, ws: 0.78, rw: 0.62, front: 0.98, rear: 1.08, R: 0.36, clear: 0.2 },
  sedan: { L: 4.9, W: 1.86, belt: 0.93, roof: 1.46, hood: 1.25, trunk: 0.95, ws: 0.72, rw: 0.56, front: 0.95, rear: 0.95, R: 0.36, clear: 0.2 },
  compact: { L: 3.95, W: 1.76, belt: 0.92, roof: 1.44, hood: 0.95, trunk: 0.6, ws: 0.66, rw: 0.5, front: 0.78, rear: 0.72, R: 0.33, clear: 0.18 },
  suv: { L: 5.0, W: 1.96, belt: 1.18, roof: 1.88, hood: 1.15, trunk: 0.18, ws: 0.55, rw: 0.14, front: 0.95, rear: 0.95, R: 0.42, clear: 0.26 },
} satisfies Record<string, CarSpec>;

/** Corpo até a linha da cintura (com as caixas de roda) e a estufa (vidro), no espaço do carro: frente em +x, chão em y = 0. */
function carGeometry(s: CarSpec) {
  const { L, W, belt, roof, hood, trunk, ws, rw, front, rear, R, clear } = s;
  const fx = L / 2 - front, rx = -L / 2 + rear, Ra = R + 0.06;
  const pts: [number, number][] = [];
  // frente (para-choque, grade), capô, cintura até a tampa do porta-malas, traseira
  pts.push([L / 2 - 0.06, clear + 0.04], [L / 2, clear + 0.14], [L / 2, belt - 0.26], [L / 2 - 0.08, belt - 0.16], [L / 2 - 0.4, belt - 0.08], [L / 2 - hood, belt]);
  pts.push([-L / 2 + trunk, belt + 0.03], [-L / 2 + 0.16, belt - 0.03], [-L / 2, belt - 0.16], [-L / 2, clear + 0.14], [-L / 2 + 0.06, clear + 0.04]);
  // embaixo, da traseira para a frente, com os arcos das rodas
  for (const cx of [rx, fx]) {
    pts.push([cx - Ra, clear + 0.04], [cx - Ra, R]);
    for (let k = 1; k < 12; k++) { const a = Math.PI - (k / 12) * Math.PI; pts.push([cx + Math.cos(a) * Ra, R + Math.sin(a) * Ra]); }
    pts.push([cx + Ra, R], [cx + Ra, clear + 0.04]);
  }
  const body = carShell(pts, W, 0.07);
  // estufa: para-brisa, teto, vigia (um pouco mais estreita que o corpo)
  const top: [number, number][] = [[L / 2 - hood, belt - 0.01], [L / 2 - hood - ws, roof], [-L / 2 + trunk + rw, roof], [-L / 2 + trunk, belt + 0.02]];
  const cabin = carShell(top, W - 0.16, 0.05);
  // teto em pintura sobre a estufa e as colunas
  const roofSkin = carShell([[L / 2 - hood - ws + 0.08, roof - 0.05], [L / 2 - hood - ws - 0.02, roof + 0.015], [-L / 2 + trunk + rw + 0.02, roof + 0.015], [-L / 2 + trunk + rw - 0.08, roof - 0.05]], W - 0.18, 0.02);
  const pillars: THREE.BufferGeometry[] = [];
  const bx = (L / 2 - hood - ws + -L / 2 + trunk + rw) / 2;
  for (const z of [-(W - 0.16) / 2 - 0.004, (W - 0.16) / 2 + 0.004]) pillars.push(boxGeo(bx - 0.06, belt, z - 0.01, bx + 0.06, roof, z + 0.01));
  // rodas: pneu, roda e calota (no espaço da roda: eixo em z)
  const wheels: [number, number][] = [[fx, -W / 2 + 0.16], [fx, W / 2 - 0.16], [rx, -W / 2 + 0.16], [rx, W / 2 - 0.16]];
  const tire = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(R, R, 0.24, 24).rotateX(Math.PI / 2), x, R, z)));
  const rim = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(R * 0.66, R * 0.66, 0.25, 18).rotateX(Math.PI / 2), x, R, z)));
  // faróis, lanternas, grade, frisos, maçanetas, retrovisores e placas
  const head = merge([-1, 1].map((sz) => boxGeo(L / 2 - 0.05, belt - 0.32, sz * (W / 2 - 0.36) - 0.17, L / 2 + 0.004, belt - 0.22, sz * (W / 2 - 0.36) + 0.17)));
  const tail = merge([-1, 1].map((sz) => boxGeo(-L / 2 - 0.004, belt - 0.32, sz * (W / 2 - 0.3) - 0.2, -L / 2 + 0.05, belt - 0.2, sz * (W / 2 - 0.3) + 0.2)));
  const chrome = merge([
    boxGeo(L / 2 - 0.02, clear + 0.22, -0.42, L / 2 + 0.012, belt - 0.36, 0.42),                              // grade
    ...[-1, 1].map((sz) => boxGeo(-L / 2 + trunk, belt - 0.02, sz * (W / 2 - 0.1) - 0.006, L / 2 - hood, belt + 0.004, sz * (W / 2 - 0.1) + 0.006)),   // friso da cintura
    ...[-1, 1].flatMap((sz) => [0.25, -0.65].map((dx) => boxGeo(bx + dx - 0.09, belt - 0.12, sz * (W / 2) - 0.02, bx + dx + 0.09, belt - 0.09, sz * (W / 2) + 0.02))),   // maçanetas
  ]);
  const mirrors = merge([-1, 1].map((sz) => boxGeo(L / 2 - hood - 0.12, belt + 0.06, sz * (W / 2 + 0.12) - 0.08, L / 2 - hood + 0.08, belt + 0.18, sz * (W / 2 + 0.12) + 0.08)));
  const plates = merge([boxGeo(L / 2 + 0.005, clear + 0.18, -0.26, L / 2 + 0.02, clear + 0.31, 0.26), boxGeo(-L / 2 - 0.02, belt - 0.5, -0.26, -L / 2 - 0.005, belt - 0.37, 0.26)]);
  return { body, cabin, roofSkin, pillars: merge(pillars), tire, rim, head, tail, chrome, mirrors, plates };
}

function Car({ spec, paint, m, at, rot, lights = "on", children }: { spec: CarSpec; paint: THREE.Material; m: ExteriorMaterials; at: [number, number, number]; rot: number; lights?: "on" | "park" | "off"; children?: React.ReactNode }) {
  const g = useMemo(() => carGeometry(spec), [spec]);
  const head = lights === "on" ? m.headLight : lights === "park" ? m.lampGlow : m.chrome;
  return (
    <group position={at} rotation={[0, rot, 0]}>
      <mesh geometry={g.body} material={paint} castShadow receiveShadow />
      <mesh geometry={g.cabin} material={m.carGlass} castShadow />
      <mesh geometry={g.roofSkin} material={paint} castShadow />
      <mesh geometry={g.pillars} material={paint} />
      <mesh geometry={g.tire} material={m.rubber} castShadow />
      <mesh geometry={g.rim} material={m.aluminium} />
      <mesh geometry={g.head} material={head} />
      <mesh geometry={g.tail} material={lights === "off" ? m.rubber : m.tailLight} />
      <mesh geometry={g.chrome} material={m.chrome} />
      <mesh geometry={g.mirrors} material={paint} />
      <mesh geometry={g.plates} material={m.whitePaint} />
      {children}
    </group>
  );
}

/** Giroflex da viatura: duas metades (vermelha e azul) que alternam rápido. */
function LightBar({ y, len }: { y: number; len: number }) {
  const red = useRef<THREE.MeshStandardMaterial>(null), blue = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, ph = Math.floor(t * 7) % 4;
    if (red.current) red.current.emissiveIntensity = ph === 0 || ph === 1 ? 9 : 0.4;
    if (blue.current) blue.current.emissiveIntensity = ph === 2 || ph === 3 ? 9 : 0.4;
  });
  return (
    <group position={[-0.1, y, 0]}>
      <mesh><boxGeometry args={[0.32, 0.07, len + 0.06]} /><meshStandardMaterial color="#111" roughness={0.5} /></mesh>
      <mesh position={[0, 0.07, -len / 4]}><boxGeometry args={[0.26, 0.09, len / 2 - 0.04]} /><meshStandardMaterial ref={red} color="#300" emissive="#ff1020" emissiveIntensity={0.4} roughness={0.2} transparent opacity={0.92} /></mesh>
      <mesh position={[0, 0.07, len / 4]}><boxGeometry args={[0.26, 0.09, len / 2 - 0.04]} /><meshStandardMaterial ref={blue} color="#002" emissive="#1a4dff" emissiveIntensity={0.4} roughness={0.2} transparent opacity={0.92} /></mesh>
    </group>
  );
}

/** Caminhão-baú do bufê: cabine branca, baú com a marca nos lados e as portas de trás (oeste). Frente em +x. */
function CateringTruck({ m, q, at }: { m: ExteriorMaterials; q: Quality; at: [number, number, number] }) {
  const L = 7, W = 2.4;
  const g = useMemo(() => {
    const cab = merge([boxGeo(L / 2 - 2.0, 0.55, -W / 2 + 0.06, L / 2 - 0.05, 1.45, W / 2 - 0.06), boxGeo(L / 2 - 2.0, 1.45, -W / 2 + 0.1, L / 2 - 0.55, 2.55, W / 2 - 0.1)]);
    const windshield = merge([boxGeo(L / 2 - 0.62, 1.5, -W / 2 + 0.16, L / 2 - 0.5, 2.38, W / 2 - 0.16), ...[-1, 1].map((s) => boxGeo(L / 2 - 1.5, 1.55, s * (W / 2 - 0.1) - 0.006, L / 2 - 0.62, 2.35, s * (W / 2 - 0.1) + 0.006))]);
    const box = boxGeo(-L / 2, 0.9, -W / 2, L / 2 - 2.1, 3.35, W / 2);
    const chassis = merge([boxGeo(-L / 2 + 0.1, 0.42, -0.6, L / 2 - 0.2, 0.62, 0.6), boxGeo(-L / 2, 0.55, -W / 2 + 0.05, -L / 2 + 0.3, 0.9, W / 2 - 0.05)]);
    const wheels = [[L / 2 - 1.2, -0.95], [L / 2 - 1.2, 0.95], [-L / 2 + 1.5, -0.95], [-L / 2 + 1.5, 0.95], [-L / 2 + 2.45, -0.95], [-L / 2 + 2.45, 0.95]] as const;
    const tire = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(0.46, 0.46, 0.3, 24).rotateX(Math.PI / 2), x, 0.46, z)));
    const rim = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(0.28, 0.28, 0.31, 16).rotateX(Math.PI / 2), x, 0.46, z)));
    // portas de trás (duas folhas com dobradiças) e a lanterna
    const doors = merge([boxGeo(-L / 2 - 0.03, 1.0, -W / 2 + 0.04, -L / 2, 3.25, -0.01), boxGeo(-L / 2 - 0.03, 1.0, 0.01, -L / 2, 3.25, W / 2 - 0.04)]);
    const handles = merge([boxGeo(-L / 2 - 0.08, 1.4, -0.12, -L / 2 - 0.03, 2.9, -0.08), boxGeo(-L / 2 - 0.08, 1.4, 0.08, -L / 2 - 0.03, 2.9, 0.12)]);
    const head = merge([-1, 1].map((s) => boxGeo(L / 2 - 0.06, 0.95, s * 0.82 - 0.18, L / 2 + 0.004, 1.12, s * 0.82 + 0.18)));
    const tail = merge([-1, 1].map((s) => boxGeo(-L / 2 - 0.01, 0.75, s * 1.0 - 0.1, -L / 2 + 0.02, 0.98, s * 1.0 + 0.1)));
    return { cab, windshield, box, chassis, tire, rim, doors, handles, head, tail };
  }, []);
  const decal = useMemo(() => new THREE.MeshStandardMaterial({ map: cateringTex(q), roughness: 0.45, metalness: 0.05 }), [q]);
  return (
    <group position={at}>
      <mesh geometry={g.cab} material={m.whitePaint} castShadow receiveShadow />
      <mesh geometry={g.windshield} material={m.carGlass} />
      <mesh geometry={g.box} material={m.whitePaint} castShadow receiveShadow />
      <mesh geometry={g.chassis} material={m.blackMetal} castShadow />
      <mesh geometry={g.tire} material={m.rubber} castShadow />
      <mesh geometry={g.rim} material={m.galvanized} />
      <mesh geometry={g.doors} material={m.whitePaint} castShadow />
      <mesh geometry={g.handles} material={m.galvanized} />
      <mesh geometry={g.head} material={m.lampGlow} />
      <mesh geometry={g.tail} material={m.tailLight} />
      {[-1, 1].map((s) => <mesh key={s} material={decal} position={[-L / 2 + (L - 2.1) / 2, 2.12, s * (W / 2 + 0.006)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[L - 2.4, 1.8]} /></mesh>)}
    </group>
  );
}

const center = (p: Prop): { x: number; z: number; long: "x" | "z" } => { const b = p.shape.type === "box" ? p.shape : { x0: p.shape.x - p.shape.r, x1: p.shape.x + p.shape.r, z0: p.shape.z - p.shape.r, z1: p.shape.z + p.shape.r }; return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, long: b.x1 - b.x0 >= b.z1 - b.z0 ? "x" : "z" }; };

export function HeistVehicles({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const policePaint = useMemo(() => m.navyPaint, [m]);
  const getaway = useMemo(() => { const p = m.carPaint.clone(); p.color = new THREE.Color("#1c1f24"); return p; }, [m]);
  const doorPanel = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("police", [SIGNAGE.police], { w: 512, h: 160, bg: "#f2f2f2", ink: "#14234a", font: "sans" }), roughness: 0.35, metalness: 0.1 }), []);
  const cars = useMemo(() => props.filter((p) => ["limo", "suv", "policeCar", "cateringTruck", "getawayCar"].includes(p.kind)), [props]);
  return (
    <group>
      {cars.map((p) => {
        const c = center(p), y = floorY(c);
        if (p.kind === "limo") return <Car key={p.id} spec={SPECS.limo} paint={m.carPaint} m={m} at={[c.x, y, c.z]} rot={Math.PI} lights="on" />;
        if (p.kind === "suv") return <Car key={p.id} spec={SPECS.suv} paint={m.carPaint} m={m} at={[c.x, y, c.z]} rot={0} lights="park" />;
        if (p.kind === "policeCar") return (
          <Car key={p.id} spec={SPECS.sedan} paint={policePaint} m={m} at={[c.x, y, c.z]} rot={Math.PI} lights="park">
            <LightBar y={SPECS.sedan.roof + 0.05} len={1.3} />
            {[-1, 1].map((s) => <mesh key={s} material={doorPanel} position={[0.1, 0.62, s * (SPECS.sedan.W / 2 + 0.01)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[1.7, 0.42]} /></mesh>)}
          </Car>
        );
        if (p.kind === "cateringTruck") return <CateringTruck key={p.id} m={m} q={q} at={[c.x, y, c.z]} />;
        // carros da fuga: o da avenida aponta para o oeste; o do beco, para a rua (sul)
        return c.long === "x"
          ? <Car key={p.id} spec={SPECS.compact} paint={getaway} m={m} at={[c.x, y, c.z]} rot={Math.PI} lights="park" />
          : <Car key={p.id} spec={SPECS.sedan} paint={getaway} m={m} at={[c.x, y, c.z]} rot={-Math.PI / 2} lights="park" />;
      })}
    </group>
  );
}

/** Onde ficam as luzes dos carros (para os reflexos no asfalto): faróis acesos e o giroflex. */
export function vehicleLights(props: Prop[]): { pos: THREE.Vector3; color: THREE.Color; kind: "head" | "tail" | "police" }[] {
  const out: { pos: THREE.Vector3; color: THREE.Color; kind: "head" | "tail" | "police" }[] = [];
  for (const p of props) {
    const c = center(p), y = floorY(c);
    if (p.kind === "limo") { const s = SPECS.limo; for (const dz of [-1, 1]) { out.push({ pos: new THREE.Vector3(c.x - s.L / 2, y + s.belt - 0.27, c.z + dz * (s.W / 2 - 0.36)), color: new THREE.Color("#fff3df"), kind: "head" }); out.push({ pos: new THREE.Vector3(c.x + s.L / 2, y + s.belt - 0.26, c.z + dz * (s.W / 2 - 0.3)), color: new THREE.Color("#ff2a1a"), kind: "tail" }); } }
    if (p.kind === "policeCar") out.push({ pos: new THREE.Vector3(c.x, y + SPECS.sedan.roof + 0.15, c.z), color: new THREE.Color("#ff1020"), kind: "police" });
  }
  return out;
}

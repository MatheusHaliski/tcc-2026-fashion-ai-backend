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
import { cateringTex, signTex, signage, type Quality } from "./exterior-textures";

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
  const rim = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(R * 0.66, R * 0.62, 0.2, 18).rotateX(Math.PI / 2), x, R, z)));
  const hub = merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(R * 0.18, R * 0.22, 0.25, 12).rotateX(Math.PI / 2), x, R, z)));
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
  return { body, cabin, roofSkin, pillars: merge(pillars), tire, rim, hub, head, tail, chrome, mirrors, plates };
}

type Lights = "on" | "park" | "off";
/** Peças de um carro levadas ao mundo e separadas por material (todas as carrocerias da rua viram poucas malhas). */
function carParts(out: Map<string, THREE.BufferGeometry[]>, spec: CarSpec, paint: string, at: [number, number, number], rot: number, lights: Lights) {
  const g = carGeometry(spec), M = new THREE.Matrix4().makeRotationY(rot).setPosition(...at);
  const put = (key: string, geo: THREE.BufferGeometry) => { const c = geo.clone().applyMatrix4(M); const l = out.get(key); if (l) l.push(c); else out.set(key, [c]); };
  put(paint, g.body); put(paint, g.roofSkin); put(paint, g.pillars); put(paint, g.mirrors);
  put("glass", g.cabin); put("rubber", g.tire); put("rim", g.rim); put("hub", g.hub); put("chrome", g.chrome); put("plate", g.plates);
  put(lights === "on" ? "head" : lights === "park" ? "park" : "chrome", g.head); put(lights === "off" ? "rubber" : "tail", g.tail);
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
function truckParts(out: Map<string, THREE.BufferGeometry[]>, at: [number, number, number]) {
  const L = 7, W = 2.4, M = new THREE.Matrix4().setPosition(...at);
  const put = (key: string, geo: THREE.BufferGeometry) => { geo.applyMatrix4(M); const l = out.get(key); if (l) l.push(geo); else out.set(key, [geo]); };
  put("white", merge([boxGeo(L / 2 - 2.0, 0.55, -W / 2 + 0.06, L / 2 - 0.05, 1.45, W / 2 - 0.06), boxGeo(L / 2 - 2.0, 1.45, -W / 2 + 0.1, L / 2 - 0.55, 2.55, W / 2 - 0.1)]));
  put("glass", merge([boxGeo(L / 2 - 0.62, 1.5, -W / 2 + 0.16, L / 2 - 0.5, 2.38, W / 2 - 0.16), ...[-1, 1].map((s) => boxGeo(L / 2 - 1.5, 1.55, s * (W / 2 - 0.1) - 0.006, L / 2 - 0.62, 2.35, s * (W / 2 - 0.1) + 0.006))]));
  put("white", boxGeo(-L / 2, 0.9, -W / 2, L / 2 - 2.1, 3.35, W / 2));
  put("black", merge([boxGeo(-L / 2 + 0.1, 0.42, -0.6, L / 2 - 0.2, 0.62, 0.6), boxGeo(-L / 2, 0.55, -W / 2 + 0.05, -L / 2 + 0.3, 0.9, W / 2 - 0.05)]));
  const wheels = [[L / 2 - 1.2, -0.95], [L / 2 - 1.2, 0.95], [-L / 2 + 1.5, -0.95], [-L / 2 + 1.5, 0.95], [-L / 2 + 2.45, -0.95], [-L / 2 + 2.45, 0.95]] as const;
  put("rubber", merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(0.46, 0.46, 0.3, 24).rotateX(Math.PI / 2), x, 0.46, z))));
  put("rim", merge(wheels.map(([x, z]) => place(new THREE.CylinderGeometry(0.28, 0.27, 0.26, 16).rotateX(Math.PI / 2), x, 0.46, z))));
  // portas de trás (duas folhas com dobradiças), maçanetas, faróis e lanternas
  put("white", merge([boxGeo(-L / 2 - 0.03, 1.0, -W / 2 + 0.04, -L / 2, 3.25, -0.01), boxGeo(-L / 2 - 0.03, 1.0, 0.01, -L / 2, 3.25, W / 2 - 0.04)]));
  put("chrome", merge([boxGeo(-L / 2 - 0.08, 1.4, -0.12, -L / 2 - 0.03, 2.9, -0.08), boxGeo(-L / 2 - 0.08, 1.4, 0.08, -L / 2 - 0.03, 2.9, 0.12)]));
  put("park", merge([-1, 1].map((s) => boxGeo(L / 2 - 0.06, 0.95, s * 0.82 - 0.18, L / 2 + 0.004, 1.12, s * 0.82 + 0.18))));
  put("tail", merge([-1, 1].map((s) => boxGeo(-L / 2 - 0.01, 0.75, s * 1.0 - 0.1, -L / 2 + 0.02, 0.98, s * 1.0 + 0.1))));
  // a marca do bufê nos dois lados do baú
  put("decal", merge([-1, 1].map((s) => { const g = new THREE.PlaneGeometry(L - 2.4, 1.8); if (s < 0) g.rotateY(Math.PI); g.translate(-L / 2 + (L - 2.1) / 2, 2.12, s * (W / 2 + 0.006)); return g; })));
}

const center = (p: Prop): { x: number; z: number; long: "x" | "z" } => { const b = p.shape.type === "box" ? p.shape : { x0: p.shape.x - p.shape.r, x1: p.shape.x + p.shape.r, z0: p.shape.z - p.shape.r, z1: p.shape.z + p.shape.r }; return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, long: b.x1 - b.x0 >= b.z1 - b.z0 ? "x" : "z" }; };

export function HeistVehicles({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const data = useMemo(() => {
    const out = new Map<string, THREE.BufferGeometry[]>(), bars: { at: [number, number, number]; rot: number }[] = [], doors: THREE.BufferGeometry[] = [];
    for (const p of props) {
      if (!["limo", "suv", "policeCar", "cateringTruck", "getawayCar"].includes(p.kind)) continue;
      const c = center(p), y = floorY(c), at: [number, number, number] = [c.x, y, c.z];
      if (p.kind === "limo") carParts(out, SPECS.limo, "paint:black", at, Math.PI, "on");
      else if (p.kind === "suv") carParts(out, SPECS.suv, "paint:black", at, 0, "park");
      else if (p.kind === "policeCar") {
        carParts(out, SPECS.sedan, "paint:police", at, Math.PI, "park"); bars.push({ at, rot: Math.PI });
        const M = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(...at);
        for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(1.7, 0.42); if (s < 0) g.rotateY(Math.PI); g.translate(0.1, 0.62, s * (SPECS.sedan.W / 2 + 0.01)); doors.push(g.applyMatrix4(M)); }
      }
      else if (p.kind === "cateringTruck") truckParts(out, at);
      // carros da fuga: o da avenida aponta para o oeste; o do beco, para a rua (sul)
      else if (c.long === "x") carParts(out, SPECS.compact, "paint:getaway", at, Math.PI, "park");
      else carParts(out, SPECS.sedan, "paint:getaway", at, -Math.PI / 2, "park");
    }
    const merged = new Map<string, THREE.BufferGeometry>(); for (const [k, l] of out) merged.set(k, merge(l));
    return { merged, bars, doors: doors.length ? merge(doors) : null };
  }, [props]);
  const mats = useMemo<Record<string, THREE.Material>>(() => {
    const getaway = m.carPaint.clone(); getaway.color = new THREE.Color("#1c1f24");
    return {
      "paint:black": m.carPaint, "paint:police": m.navyPaint, "paint:getaway": getaway, glass: m.carGlass, rubber: m.rubber,
      rim: new THREE.MeshStandardMaterial({ color: "#6d7176", roughness: 0.3, metalness: 0.85 }), hub: m.chrome, chrome: m.chrome, plate: m.whitePaint,
      head: m.headLight, park: m.lampGlow, tail: m.tailLight, white: m.whitePaint, black: m.blackMetal,
      decal: new THREE.MeshStandardMaterial({ map: cateringTex(q), roughness: 0.45, metalness: 0.05 }),
    };
  }, [m, q]);
  const doorPanel = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("police", [signage().police], { w: 512, h: 160, bg: "#f2f2f2", ink: "#14234a", font: "sans" }), roughness: 0.35, metalness: 0.1 }), []);
  const cast = new Set(["paint:black", "paint:police", "paint:getaway", "white", "rubber", "black"]);
  return (
    <group>
      {[...data.merged.entries()].map(([k, g]) => <mesh key={k} geometry={g} material={mats[k] ?? m.chrome} castShadow={cast.has(k)} receiveShadow={cast.has(k)} />)}
      {data.doors && <mesh geometry={data.doors} material={doorPanel} />}
      {data.bars.map((b, i) => <group key={i} position={b.at} rotation={[0, b.rot, 0]}><LightBar y={SPECS.sedan.roof + 0.05} len={1.3} /></group>)}
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

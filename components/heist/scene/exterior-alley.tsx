"use client";
/*
 * MET Gala Heist v2 — o beco leste: asfalto velho com poças, a escada de incêndio de ferro presa à face leste do museu
 * (balcões de grade em três níveis, lances em diagonal, a escada de mão que desce do primeiro balcão até perto do chão —
 * é por ela que se escala — e os lances de baixo recolhidos, que bloqueiam a passagem), as caçambas, o vapor saindo do
 * respiro, as luminárias de vapor de sódio na parede, o prédio de tijolo do outro lado (com a escada de incêndio dele) e a
 * cerca no fundo.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { boxGeo, inst, merge, place, tubeThrough } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { glowTex, signTex, SIGNAGE, prng, type Quality } from "./exterior-textures";
import { Instanced } from "./exterior-facade";

const X0 = 22.5, X1 = 30, Z_END = -22.4, Z_MOUTH = 24.5;
/** Escada de incêndio do museu: balcões em y 0 (porta do terraço), 3,6 e 7,2; z −18,6…−9,4; projeção de 0,75 m (quem
 * anda no beco passa fora dela; os lances de baixo ficam dentro das caixas de colisão). */
const FE = { z0: -18.6, z1: -9.4, depth: 0.75, levels: [0, 3.6, 7.2] };
export const ALLEY_LAMPS = [16, 3, -6.5, -19.5].map((z) => new THREE.Vector3(X0 + 0.55, 3.4, z));

function useFireEscape() {
  return useMemo(() => {
    const grate: THREE.BufferGeometry[] = [], iron: THREE.BufferGeometry[] = [], treads: THREE.Matrix4[] = [];
    const xo = X0 + FE.depth;
    for (const y of FE.levels) {
      grate.push(boxGeo(X0 + 0.02, y - 0.05, FE.z0, xo, y, FE.z1));
      // guarda-corpo do balcão (frente e pontas) com balaústres finos
      iron.push(tubeThrough([[X0 + 0.02, y + 0.95, FE.z0], [xo, y + 0.95, FE.z0], [xo, y + 0.95, FE.z1], [X0 + 0.02, y + 0.95, FE.z1]], 0.02, 16, 6));
      iron.push(tubeThrough([[xo, y + 0.45, FE.z0], [xo, y + 0.45, FE.z1]], 0.012, 4, 5));
      for (let z = FE.z0; z <= FE.z1 + 0.01; z += 0.46) iron.push(place(new THREE.CylinderGeometry(0.01, 0.01, 0.95, 4), xo, y + 0.475, z));
      // consolos (mãos-francesas) presos à parede
      for (const z of [FE.z0 + 0.3, (FE.z0 + FE.z1) / 2, FE.z1 - 0.3]) iron.push(tubeThrough([[X0 + 0.02, y - 0.9, z], [xo - 0.05, y - 0.05, z]], 0.022, 2, 6));
    }
    // lances entre balcões, alternando o sentido (degraus instanciados entre dois banzos)
    const flight = (ya: number, yb: number, za: number, zb: number) => {
      const xa = X0 + 0.12, xb = X0 + 0.6;
      for (const x of [xa, xb]) iron.push(tubeThrough([[x, ya, za], [x, yb, zb]], 0.03, 2, 6));
      iron.push(tubeThrough([[xb + 0.05, ya + 0.9, za], [xb + 0.05, yb + 0.9, zb]], 0.016, 2, 5));
      const n = Math.round(Math.abs(yb - ya) / 0.2);
      for (let k = 1; k < n; k++) { const t = k / n; treads.push(inst((xa + xb) / 2, ya + (yb - ya) * t, za + (zb - za) * t)); }
    };
    flight(FE.levels[0], FE.levels[1], FE.z1 - 0.3, FE.z1 - 4.4);
    flight(FE.levels[1], FE.levels[2], FE.z0 + 0.3, FE.z0 + 4.4);
    // lances de baixo recolhidos (contrapeso): descem do balcão até 1 m do chão — são as caixas de colisão do beco
    flight(0, SIDEWALK_Y + 0.6, -15.4, -18.0);
    flight(0, SIDEWALK_Y + 0.6, -12.6, -10.0);
    // escada de mão (por onde se escala): do balcão até 0,5 m do chão, na frente da porta
    const lx = xo - 0.06;
    for (const z of [-14.25, -13.75]) iron.push(tubeThrough([[lx, SIDEWALK_Y + 0.5, z], [lx, 0.95, z]], 0.018, 2, 5));
    for (let y = SIDEWALK_Y + 0.6; y < 0.9; y += 0.3) iron.push(place(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5).rotateX(Math.PI / 2), lx, y, -14));
    const tread = boxGeo(-0.35, -0.02, -0.11, 0.35, 0.0, 0.11);
    return { grate: merge(grate), iron: merge(iron), treads, tread };
  }, []);
}

/** Vapor saindo do respiro no chão do beco (cartões que sobem, crescem e somem). */
function Steam({ at, q }: { at: THREE.Vector3; q: Quality }) {
  const n = q === "high" ? 14 : 7;
  const sprites = useRef<THREE.Sprite[]>([]);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#8d97a6"), transparent: true, opacity: 0.18, depthWrite: false }), []);
  const seeds = useMemo(() => { const r = prng(9); return Array.from({ length: n }, () => ({ ph: r(), dx: (r() - 0.5) * 0.5, dz: (r() - 0.5) * 0.5, s: 0.8 + r() * 0.6 })); }, [n]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sprites.current.forEach((sp, i) => {
      if (!sp) return; const k = seeds[i], life = (t * 0.22 + k.ph) % 1;
      sp.position.set(at.x + k.dx + Math.sin(t * 0.7 + i) * 0.2 * life, at.y + life * 3.2, at.z + k.dz + life * 0.6);
      const s = (0.6 + life * 2.4) * k.s; sp.scale.set(s, s, 1);
      (sp.material as THREE.SpriteMaterial).opacity = 0.2 * Math.sin(life * Math.PI);
    });
  });
  return <group>{seeds.map((_, i) => <sprite key={i} ref={(s) => { if (s) sprites.current[i] = s; }} material={mat.clone()} />)}</group>;
}

export function HeistAlley({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const fe = useFireEscape();
  const ground = useMemo(() => merge([boxGeo(X0, SIDEWALK_Y - 0.3, Z_END, X1, SIDEWALK_Y, Z_MOUTH)]), []);
  const grateMat = useMemo(() => {
    // grade de ferro: textura com furos (alphaTest) para ver através dos balcões
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#fff";
    for (let k = 0; k < 8; k++) { g.fillRect(k * 8, 0, 2, 64); g.fillRect(0, k * 8, 64, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.25, 1 / 0.25);
    return new THREE.MeshStandardMaterial({ color: "#16191b", roughness: 0.55, metalness: 0.6, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  }, []);
  const dumpsters = useMemo(() => {
    const list = props.filter((p) => p.kind === "dumpster" && p.shape.type === "box");
    const body: THREE.BufferGeometry[] = [], lids: THREE.BufferGeometry[] = [], wheels: THREE.BufferGeometry[] = [];
    for (const p of list) {
      const b = p.shape as { x0: number; z0: number; x1: number; z1: number }, y = SIDEWALK_Y;
      body.push(boxGeo(b.x0 + 0.05, y + 0.18, b.z0, b.x1, y + 1.3, b.z1));
      body.push(boxGeo(b.x0, y + 1.1, b.z0 - 0.04, b.x0 + 0.08, y + 1.3, b.z1 + 0.04));                  // aba da frente
      const lid = new THREE.BoxGeometry(b.x1 - b.x0 + 0.06, 0.05, (b.z1 - b.z0) / 2 - 0.02); lid.translate(0, 0, 0);
      for (const half of [0, 1]) { const g = lid.clone(); g.rotateZ(half ? 0.0 : -0.25); g.translate((b.x0 + b.x1) / 2, y + 1.34 + (half ? 0 : 0.12), b.z0 + (b.z1 - b.z0) * (half ? 0.75 : 0.25)); lids.push(g); }
      for (const [x, z] of [[b.x0 + 0.2, b.z0 + 0.2], [b.x0 + 0.2, b.z1 - 0.2], [b.x1 - 0.2, b.z0 + 0.2], [b.x1 - 0.2, b.z1 - 0.2]]) wheels.push(place(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateX(Math.PI / 2), x, y + 0.08, z));
    }
    return { body: merge(body), lids: merge(lids), wheels: merge(wheels) };
  }, [props]);
  // prédio de tijolo do outro lado do beco (face oeste em x = 30) com a escada de incêndio dele
  const opposite = useMemo(() => {
    const iron: THREE.BufferGeometry[] = [], grate: THREE.BufferGeometry[] = [];
    for (const zc of [-8, 12]) for (const y of [4.2, 7.6, 11, 14.4]) {
      grate.push(boxGeo(X1 - 1.0, y - 0.05, zc - 3.2, X1 - 0.02, y, zc + 3.2));
      iron.push(tubeThrough([[X1 - 0.02, y + 0.9, zc - 3.2], [X1 - 1.0, y + 0.9, zc - 3.2], [X1 - 1.0, y + 0.9, zc + 3.2], [X1 - 0.02, y + 0.9, zc + 3.2]], 0.016, 12, 5));
      if (y < 14) iron.push(tubeThrough([[X1 - 0.55, y, zc - 2.8], [X1 - 0.55, y + 3.4, zc + 2.2]], 0.025, 2, 5));
    }
    return { iron: merge(iron), grate: merge(grate) };
  }, []);
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffb35a", emissive: new THREE.Color("#ff9a3a"), emissiveIntensity: 5 }), []);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex("soft"), color: new THREE.Color("#ff9d4a"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }), []);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("alley", [SIGNAGE.alley, SIGNAGE.noParking], { w: 640, h: 256, bg: "#f2f2f2", ink: "#b71c1c", font: "sans", border: "#b71c1c" }), roughness: 0.6 }), []);
  const fence = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d")!;
    g.clearRect(0, 0, 64, 64); g.strokeStyle = "#fff"; g.lineWidth = 3;
    for (let k = -64; k < 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((X1 - X0) / 0.6, 3 / 0.6);
    return new THREE.MeshStandardMaterial({ color: "#7d8287", metalness: 0.8, roughness: 0.45, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  }, []);
  return (
    <group>
      <mesh geometry={ground} material={m.asphaltOld} receiveShadow />
      {/* escada de incêndio do museu */}
      <mesh geometry={fe.grate} material={grateMat} castShadow receiveShadow />
      <mesh geometry={fe.iron} material={m.blackMetal} castShadow />
      <Instanced geometry={fe.tread} material={grateMat} matrices={fe.treads} shadow />
      {/* caçambas */}
      <mesh geometry={dumpsters.body} material={m.dumpster} castShadow receiveShadow />
      <mesh geometry={dumpsters.lids} material={m.blackMetal} castShadow />
      <mesh geometry={dumpsters.wheels} material={m.rubber} />
      {/* prédio de tijolo do outro lado: a face é do HeistCity; aqui só a escada de incêndio dele */}
      <mesh geometry={opposite.grate} material={grateMat} castShadow />
      <mesh geometry={opposite.iron} material={m.blackMetal} />
      {/* luminárias de sódio na parede do museu */}
      {ALLEY_LAMPS.map((p, i) => (
        <group key={i} position={p.toArray()}>
          <mesh material={m.blackMetal} position={[0.18, 0.2, 0]}><boxGeometry args={[0.36, 0.05, 0.05]} /></mesh>
          <mesh material={lampMat} position={[0.34, 0.08, 0]}><boxGeometry args={[0.2, 0.06, 0.3]} /></mesh>
          <sprite material={glowMat} position={[0.34, 0.02, 0]} scale={[1.6, 1.6, 1]} />
        </group>
      ))}
      <Steam at={new THREE.Vector3(25.2, SIDEWALK_Y, 1.5)} q={q} />
      {/* cerca no fundo do beco e a placa da entrada */}
      <mesh material={fence} position={[(X0 + X1) / 2, SIDEWALK_Y + 1.5, Z_END]}><planeGeometry args={[X1 - X0, 3]} /></mesh>
      <mesh material={m.galvanized} position={[(X0 + X1) / 2, SIDEWALK_Y + 3.02, Z_END]}><boxGeometry args={[X1 - X0, 0.05, 0.05]} /></mesh>
      <mesh material={sign} position={[X0 + 0.06, SIDEWALK_Y + 2.1, 23.2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.0, 0.4]} /></mesh>
    </group>
  );
}

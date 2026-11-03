"use client";
/*
 * MET Gala Heist v2 — avenida: peças únicas da calçada da gala: pódio da recepção, urnas com as flores e a barraca do
 * revendedor.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { floorY, SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, inst, lathe, merge, place, tubeThrough } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { bloomTex, leafTex, prng, type Quality, SIGNAGE, signTex } from "./exterior-textures";
import { Instanced } from "./exterior-facade";

/** Pódio da recepção: laca preta com filete de latão, luminária de mesa e a placa da recepção. */
export function Podium({ m }: { m: ExteriorMaterials }) {
  const geo = useMemo(() => {
    const body = merge([boxGeo(-0.3, 0, -0.22, 0.3, 1.05, 0.22), boxGeo(-0.36, 1.05, -0.3, 0.36, 1.12, 0.26)]);
    const trim = merge([boxGeo(-0.31, 0.06, -0.23, 0.31, 0.09, 0.23), boxGeo(-0.37, 1.1, -0.31, 0.37, 1.125, 0.27)]);
    const lamp = merge([tubeThrough([[0.2, 1.12, -0.18], [0.2, 1.42, -0.18], [0.05, 1.5, -0.18]], 0.01, 8, 5)]);
    return { body, trim, lamp };
  }, []);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("reception", [SIGNAGE.reception, SIGNAGE.gala], { w: 512, h: 256, bg: "#0c0b0a", ink: "#d9b779", font: "serif", border: "#b8913f" }), roughness: 0.5 }), []);
  const lacquer = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#060606", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }), []);
  return (
    <group position={[-2.3, SIDEWALK_Y, 32.1]} rotation={[0, Math.PI, 0]}>
      <mesh geometry={geo.body} material={lacquer} castShadow receiveShadow />
      <mesh geometry={geo.trim} material={m.brass} />
      <mesh geometry={geo.lamp} material={m.brass} />
      <mesh position={[0.05, 1.47, -0.18]} material={m.lampGlow}><sphereGeometry args={[0.04, 10, 8]} /></mesh>
      <mesh position={[0, 0.66, -0.225]} rotation={[0, Math.PI, 0]} material={sign}><planeGeometry args={[0.52, 0.26]} /></mesh>
    </group>
  );
}

/** Urnas de pedra com a massa de flores (peônias e rosas brancas e blush, folhagem escura). Ficam dentro dos cercados. */
export function Florals({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const data = useMemo(() => {
    const urn = lathe([[0, 0], [0.32, 0], [0.34, 0.06], [0.22, 0.14], [0.24, 0.5], [0.42, 0.78], [0.46, 0.86], [0.4, 0.9], [0, 0.9]], 24);
    const r = prng(5), blooms: THREE.Matrix4[] = [], colors: THREE.Color[] = [], leaves: THREE.Matrix4[] = [];
    const palette = ["#f7efe9", "#f3d9d4", "#ead0c8", "#fbf6ef", "#e9b9b6", "#d8a7a0"].map((c) => new THREE.Color(c));
    for (const [x, z] of [[-3.25, 30.45], [3.25, 30.45]]) {
      const y = floorY({ x, z }) + 0.86;
      // cúpula de flores: cabeças de 15–26 cm viradas para fora (com folga aleatória), mais densas na casca
      for (let k = 0; k < (q === "high" ? 150 : 75); k++) {
        const u = r() * Math.PI * 2, v = Math.acos(2 * r() * 0.92 - 0.92), rr = 0.5 + Math.sqrt(r()) * 0.38;
        const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v) * 0.85, Math.sin(v) * Math.sin(u));
        const p = new THREE.Vector3(x, y + 0.35, z).addScaledVector(dir, rr);
        const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().add(new THREE.Vector3((r() - 0.5) * 0.8, (r() - 0.3) * 0.6, (r() - 0.5) * 0.8)).normalize());
        blooms.push(new THREE.Matrix4().compose(p, face, new THREE.Vector3(1, 1, 1).multiplyScalar(0.15 + r() * 0.11)));
        colors.push(palette[Math.floor(r() * palette.length)]);
      }
      for (let k = 0; k < (q === "high" ? 90 : 45); k++) { const u = r() * Math.PI * 2, d = 0.45 + r() * 0.5; leaves.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(u) * d, y + 0.05 + r() * 0.85, z + Math.sin(u) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), new THREE.Vector3(0.42, 0.42, 0.42))); }
    }
    const urns = [[-3.25, 30.45], [3.25, 30.45]].map(([x, z]) => inst(x, floorY({ x, z }), z));
    return { urn, urns, blooms, colors, leaves };
  }, [q]);
  // cabeça de flor: o disco de pétalas de frente (+z) e dois cartões em cruz atrás dele, para ter volume de lado
  const bloomGeo = useMemo(() => {
    const front = new THREE.PlaneGeometry(1, 1);
    const a = new THREE.PlaneGeometry(0.8, 0.8); a.rotateY(Math.PI / 2); a.translate(0, 0, -0.18);
    const b = new THREE.PlaneGeometry(0.8, 0.8); b.rotateX(Math.PI / 2); b.translate(0, 0, -0.18);
    return merge([front, a, b]);
  }, []);
  const bloomMesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ map: bloomTex(q), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 });
    const mesh = new THREE.InstancedMesh(bloomGeo, mat, data.blooms.length);
    data.blooms.forEach((x, i) => { mesh.setMatrixAt(i, x); mesh.setColorAt(i, data.colors[i]); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.castShadow = true; return mesh;
  }, [data, bloomGeo, q]);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ map: leafTex(q, "dark"), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }), [q]);
  const leafGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  return (
    <group>
      <Instanced geometry={data.urn} material={m.stone} matrices={data.urns} shadow />
      <primitive object={bloomMesh} />
      <Instanced geometry={leafGeo} material={leafMat} matrices={data.leaves} />
    </group>
  );
}

/** Barraca do revendedor: lona listrada sobre quatro postes, araras de roupa de grife, balcão, cordão de lâmpadas e a
 * placa pintada à mão. A frente (balcão) dá para a calçada (−z). */
export function VendorStand({ m, q }: { m: ExteriorMaterials; q: Quality }) {
  const X0 = -30, X1 = -26.4, Z0 = 47.6, Z1 = 50.4, y = SIDEWALK_Y;
  const data = useMemo(() => {
    const poles: THREE.BufferGeometry[] = [], frame: THREE.BufferGeometry[] = [], counter: THREE.BufferGeometry[] = [], racks: THREE.BufferGeometry[] = [];
    for (const [x, z] of [[X0 + 0.1, Z0 + 0.05], [X1 - 0.1, Z0 + 0.05], [X0 + 0.1, Z1 - 0.1], [X1 - 0.1, Z1 - 0.1]]) poles.push(place(new THREE.CylinderGeometry(0.03, 0.03, 2.55, 8), x, y + 1.275, z));
    frame.push(tubeThrough([[X0 + 0.1, y + 2.55, Z0 + 0.05], [X1 - 0.1, y + 2.55, Z0 + 0.05]], 0.02, 2, 6), tubeThrough([[X0 + 0.1, y + 2.55, Z1 - 0.1], [X1 - 0.1, y + 2.55, Z1 - 0.1]], 0.02, 2, 6));
    counter.push(boxGeo(X0 + 0.3, y, Z0 + 0.1, X1 - 0.3, y + 0.95, Z0 + 0.65), boxGeo(X0 + 0.25, y + 0.95, Z0 + 0.05, X1 - 0.25, y + 1.0, Z0 + 0.7));
    // duas araras atrás do balcão (ao longo de x) e uma lateral
    for (const z of [49.3, 50.0]) racks.push(tubeThrough([[X0 + 0.5, y, z], [X0 + 0.5, y + 1.75, z], [X1 - 0.5, y + 1.75, z], [X1 - 0.5, y, z]], 0.018, 16, 6));
    return { poles: merge(poles), frame: merge(frame), counter: merge(counter), racks: merge(racks) };
  }, []);
  // lona listrada: telhado de duas águas (a frente mais baixa) com a sanefa recortada
  const canopy = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
    for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? "#e8e1d2" : "#5b1420"; g.fillRect(k * 16, 0, 16, 64); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
    const roof = new THREE.PlaneGeometry(X1 - X0 + 0.3, Z1 - Z0 + 0.5, 1, 1); roof.rotateX(-Math.PI / 2 + 0.16); roof.translate((X0 + X1) / 2, y + 2.7, (Z0 + Z1) / 2);
    const valance = new THREE.PlaneGeometry(X1 - X0 + 0.3, 0.32); valance.translate((X0 + X1) / 2, y + 2.38, Z0 - 0.18);
    return { mat, roof, valance };
  }, []);
  // roupas penduradas: capas e vestidos (caixas finas de alturas variadas, cores de grife)
  const clothes = useMemo(() => {
    const r = prng(91), list: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const cols = ["#121212", "#6b0f1a", "#c9b38a", "#1d2a4a", "#e9e2d6", "#2f4b3a", "#8a6a3a", "#3b2a4f", "#b3122e"].map((x) => new THREE.Color(x));
    for (const z of [49.3, 50.0]) for (let x = X0 + 0.7; x < X1 - 0.6; x += 0.17) {
      const h = 0.8 + r() * 0.7;
      list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y + 1.72 - h / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (r() - 0.5) * 0.3), new THREE.Vector3(0.05, h, 0.42 + r() * 0.12)), c: cols[Math.floor(r() * cols.length)] });
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffffff") }), list.length);
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.castShadow = true;
    return mesh;
  }, []);
  // cordão de lâmpadas na beira da lona
  const bulbs = useMemo(() => { const out: THREE.Matrix4[] = []; for (let k = 0; k <= 12; k++) { const t = k / 12, x = X0 + t * (X1 - X0); out.push(inst(x, y + 2.42 - Math.sin(t * Math.PI) * 0.12, Z0 - 0.22)); } return out; }, []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), []);
  const sign = useMemo(() => new THREE.MeshStandardMaterial({ map: signTex("vendor", [SIGNAGE.vendor, `${SIGNAGE.vendorSub} · ${SIGNAGE.vendorTag}`], { w: 768, h: 256, bg: "#f1e7cf", ink: "#3a0e12", font: "hand", border: "#3a0e12" }), roughness: 0.8 }), []);
  return (
    <group>
      <mesh geometry={data.poles} material={m.galvanized} castShadow />
      <mesh geometry={data.frame} material={m.galvanized} />
      <mesh geometry={data.counter} material={m.plywood} castShadow receiveShadow />
      <mesh geometry={data.racks} material={m.chrome} />
      <primitive object={clothes} />
      <mesh geometry={canopy.roof} material={canopy.mat} castShadow receiveShadow />
      <mesh geometry={canopy.valance} material={canopy.mat} />
      <Instanced geometry={bulbGeo} material={m.lampGlow} matrices={bulbs} />
      <mesh position={[(X0 + X1) / 2, y + 2.05, Z0 + 0.02]} rotation={[0, Math.PI, 0]} material={sign}><planeGeometry args={[2.6, 0.62]} /></mesh>
      {/* espelho de chão e o caixa sobre o balcão */}
      <mesh position={[X1 - 0.35, y + 0.95, 49.0]} rotation={[0, -Math.PI / 2, 0]} material={m.chrome}><planeGeometry args={[0.6, 1.7]} /></mesh>
      <mesh position={[X0 + 0.9, y + 1.08, Z0 + 0.4]} material={m.blackMetal}><boxGeometry args={[0.36, 0.14, 0.28]} /></mesh>
      {q === "high" && <mesh position={[X0 + 1.8, y + 1.02, Z0 + 0.4]} material={m.lampGlow}><boxGeometry args={[0.18, 0.04, 0.12]} /></mesh>}
    </group>
  );
}

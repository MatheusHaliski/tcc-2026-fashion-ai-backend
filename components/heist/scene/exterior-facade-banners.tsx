"use client";
/*
 * MET Gala Heist v2 — fachada do museu: banners da exposição na fachada (tecido ondulado por desenho, hastes e ponteiras de latão).
 */
import { useMemo } from "react";
import * as THREE from "three";
import { merge } from "./exterior-geometry";
import { exteriorMaterials } from "./exterior-materials";
import { bannerTex, type Quality } from "./exterior-textures";
import { FACADE_Z } from "./exterior-facade-dims";

/** Banners da fachada: [tipo, x, y0, y1, largura, z]. Os três do Instituto dividem a textura (uma malha só). */
export const BANNERS: { kind: "aurora" | "lumiere" | "institute" | "marquee"; x: number; y0: number; y1: number; w: number; z: number }[] = [
  { kind: "aurora", x: -9, y0: 2.2, y1: 9.75, w: 3.6, z: FACADE_Z + 0.12 }, { kind: "lumiere", x: 9, y0: 2.2, y1: 9.75, w: 3.6, z: FACADE_Z + 0.12 },
  { kind: "marquee", x: 0, y0: 8.95, y1: 9.85, w: 3.6, z: FACADE_Z + 0.32 },
  ...[-21.6, -36, -50.4].map((x) => ({ kind: "institute" as const, x, y0: 5.4, y1: 10.6, w: 1.7, z: FACADE_Z + 0.14 })),
];
/** Tecido dos banners (leve ondulação), um lote por desenho, e as hastes e ponteiras de latão de todos num lote só. */
export function Banners({ q }: { q: Quality }) {
  const m = exteriorMaterials(q);
  const data = useMemo(() => {
    const cloth = new Map<string, THREE.BufferGeometry[]>(), brass: THREE.BufferGeometry[] = [];
    for (const b of BANNERS) {
      const h = b.y1 - b.y0, g = new THREE.PlaneGeometry(b.w, h, 10, 16), p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / b.w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, 0.045 * Math.sin(u * Math.PI * 4 + v * 1.3) * (0.4 + 0.6 * (1 - v))); }
      g.computeVertexNormals(); g.translate(b.x, (b.y0 + b.y1) / 2, b.z);
      (cloth.get(b.kind) ?? cloth.set(b.kind, []).get(b.kind)!).push(g);
      const rod = (y: number, r: number, len: number, dz: number) => { const c = new THREE.CylinderGeometry(r, r, len, 10); c.rotateZ(Math.PI / 2); c.translate(b.x, y, b.z + dz); return c; };
      brass.push(rod(b.y1 + 0.06, 0.035, b.w + 0.3, 0), rod(b.y0 - 0.04, 0.025, b.w + 0.1, 0.02));
      for (const s of [-1, 1]) { const f = new THREE.SphereGeometry(0.06, 10, 8); f.translate(b.x + s * (b.w / 2 + 0.15), b.y1 + 0.06, b.z); brass.push(f); }
    }
    return { cloth: [...cloth.entries()].map(([k, l]) => ({ k: k as (typeof BANNERS)[number]["kind"], geo: merge(l) })), brass: merge(brass) };
  }, []);
  const mats = useMemo(() => Object.fromEntries(data.cloth.map(({ k }) => [k, new THREE.MeshStandardMaterial({ map: bannerTex(q, k), roughness: 0.82, side: THREE.DoubleSide, envMapIntensity: 0.3 })])), [q, data]);
  return (<>
    {data.cloth.map(({ k, geo }) => <mesh key={k} geometry={geo} material={mats[k]} castShadow receiveShadow />)}
    <mesh geometry={data.brass} material={m.brass} />
  </>);
}

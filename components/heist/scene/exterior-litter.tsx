"use client";
/*
 * MET Gala Heist v2 — a sujeira da cidade no chão da avenida: panfletos e programas da gala espalhados (atlas de 16 desenhos,
 * um por instância), bitucas de cigarro concentradas onde se espera e se fuma (lixeiras, ponto de ônibus, banca, fila,
 * porta de bar e bistrô, sarjetas, barraca do revendedor), chicletes pisados, copos de café, sacos amassados, garrafas,
 * folhas das árvores juntadas na sarjeta, poças rasas que refletem a rua e manchas de óleo e de bebida. Nada disso tem
 * colisão; nada cai no tapete nem na escadaria. Uma chamada de desenho por tipo (instâncias), centenas de peças no total.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { CURB_Z, FAR_CURB_Z, floorY, ROAD_Y, SIDEWALK_Y, STAIRS } from "@/lib/heist/level";
import type { Prop } from "@/lib/heist/types";
import { lathe, merge } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { glowTex, leafTex, prng, type Quality } from "./exterior-textures";
import { flyerAtlas, flyerUV } from "./exterior-citytex";
import { CROSS, FAR_LINE } from "./exterior-blocks";

type V2 = { x: number; z: number };
/** Onde não cai sujeira: tapete e escadaria, o patamar das portas e a rampa da doca. */
const clean = (p: V2) => (p.x > -2.7 && p.x < 2.7 && p.z < 33.1) || (p.x > STAIRS.x0 && p.x < STAIRS.x1 && p.z < STAIRS.bottom) || p.z < 24.6 || ((p.z > FAR_LINE - 0.05 && !CROSS.some((c) => p.x >= c.walk0 && p.x <= c.walk1)));
/** Chão em (x, z) com a sujeira 2–4 mm acima (sem brigar com o piso). */
const ground = (p: V2, lift = 0.004) => floorY(p) + lift;

interface Spot { x: number; z: number; r: number; n: number }
/** Pontos de acúmulo (centro, raio e peso) — perto do que a planta tem: lixeiras, ponto, banca, fila, bares, sarjetas. */
function hotspots(props: Prop[]): Spot[] {
  const out: Spot[] = [];
  for (const p of props) {
    if (p.kind !== "fixture") continue;
    const c = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : { x: p.shape.x, z: p.shape.z };
    if (p.model === "bin") out.push({ ...c, r: 1.3, n: 5 });
    if (p.model === "busShelter") out.push({ x: c.x, z: c.z - 1.2, r: 2.4, n: 8 });
    if (p.model === "newsstand") out.push({ x: c.x, z: c.z - 1.3, r: 1.8, n: 5 });
  }
  out.push({ x: 8, z: 31.9, r: 6.5, n: 9 });                                         // fila
  out.push({ x: -28.2, z: 46.2, r: 2.2, n: 4 });                                     // revendedor
  out.push({ x: -24, z: 50.2, r: 2.5, n: 4 }, { x: 22.5, z: 50.2, r: 2.2, n: 4 });     // porta do bistrô e do café
  return out;
}
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * Math.cos(2 * Math.PI * r()); }
function pick(r: () => number, spots: Spot[], wSpots: number, area: () => V2): V2 {
  if (r() < wSpots) {
    const tot = spots.reduce((a, s) => a + s.n, 0); let k = r() * tot, s = spots[0];
    for (const sp of spots) { k -= sp.n; if (k <= 0) { s = sp; break; } }
    return { x: s.x + gauss(r) * s.r * 0.5, z: s.z + gauss(r) * s.r * 0.5 };
  }
  return area();
}
/** Áreas de chão por onde a sujeira se espalha: as duas calçadas, as duas sarjetas e a calçada das transversais. */
function areaPicker(r: () => number): () => V2 {
  return () => {
    const k = r();
    if (k < 0.34) return { x: -34 + r() * 68, z: FAR_CURB_Z + 0.5 + r() * (FAR_LINE - FAR_CURB_Z - 0.6) };
    if (k < 0.58) return { x: -34 + r() * 68, z: 24.7 + r() * (CURB_Z - 24.9) };
    if (k < 0.74) return { x: -40 + r() * 80, z: CURB_Z + 0.08 + r() * 0.4 };          // sarjeta do museu
    if (k < 0.9) return { x: -40 + r() * 80, z: FAR_CURB_Z - 0.48 + r() * 0.4 };       // sarjeta de lá
    return { x: (r() < 0.5 ? -42.5 : -32.5) + r() * 1.5, z: FAR_LINE + r() * 30 };    // calçada da transversal
  };
}

/** Panfleto: retângulo A5 levemente empenado (canto levantado). */
function flyerGeometry() {
  const g = new THREE.PlaneGeometry(0.148, 0.21, 3, 3), p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.max(0, (x + y - 0.12)) * 0.12 + Math.sin(x * 30) * 0.002); }
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}
/** Bituca: filtro laranja manchado, papel branco e a ponta queimada (cores no vértice). */
function buttGeometry() {
  const g = new THREE.CylinderGeometry(0.0042, 0.0042, 0.034, 8, 4); g.rotateZ(Math.PI / 2);
  const p = g.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); const c = x < -0.004 ? [0.78, 0.48, 0.2] : x > 0.014 ? [0.12, 0.1, 0.09] : [0.86, 0.84, 0.8]; col.set(c, i * 3); }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.translate(0, 0.004, 0);
  return g;
}
/** Material com o retângulo do atlas por instância (um desenho de panfleto por cópia). */
function atlasMaterial(map: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 atlasRect;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = atlasRect.xy + vMapUv * atlasRect.zw;\n#endif");
  };
  m.customProgramCacheKey = () => "rua-litter-atlas";
  return m;
}
/** Mancha/poça: forma irregular (polígono com raio sorteado) com UV 0–1 na caixa dela. */
function blob(r: () => number, cx: number, cz: number, rx: number, rz: number, y: number, rot: number): THREE.BufferGeometry {
  const sh = new THREE.Shape(), n = 14;
  for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2, rr = 0.7 + r() * 0.3; const x = Math.cos(a) * rx * rr, z = Math.sin(a) * rz * rr; if (k === 0) sh.moveTo(x, z); else sh.lineTo(x, z); }
  const g = new THREE.ShapeGeometry(sh, 2); const p = g.getAttribute("position") as THREE.BufferAttribute, uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * rx), 0.5 + p.getY(i) / (2 * rz));
  g.rotateX(-Math.PI / 2); g.rotateY(rot); g.translate(cx, y, cz);
  return g;
}

export function HeistLitter({ props, m, q }: { props: Prop[]; m: ExteriorMaterials; q: Quality }) {
  const data = useMemo(() => {
    const r = prng(1311), spots = hotspots(props), area = areaPicker(r);
    const place = (n: number, wSpots: number, fn: (p: V2, i: number) => void) => { let i = 0, guard = 0; while (i < n && guard++ < n * 6) { const p = pick(r, spots, wSpots, area); if (clean(p) || p.x < -46 || p.x > 46) continue; fn(p, i++); } };
    const M = (p: V2, y: number, ry: number, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
    // panfletos (programas da gala perto da fila)
    const flyers: THREE.Matrix4[] = [], rects: number[] = [];
    place(q === "high" ? 320 : 160, 0.45, (p) => {
      flyers.push(M(p, ground(p, 0.004), r() * Math.PI * 2));
      const k = Math.abs(p.z - 32) < 1.6 && p.x > 0 && p.x < 16 && r() < 0.6 ? 2 : Math.floor(r() * 16), [u0, v0, u1, v1] = flyerUV(k);
      rects.push(u0, v0, u1 - u0, v1 - v0);
    });
    // bitucas: quase todas nos pontos de acúmulo
    const butts: THREE.Matrix4[] = [];
    place(q === "high" ? 520 : 260, 0.8, (p) => butts.push(M(p, ground(p, 0.0), r() * Math.PI * 2, 0, 0, 0.85 + r() * 0.4)));
    // chicletes pisados (discos escuros achatados)
    const gum: THREE.Matrix4[] = [];
    place(q === "high" ? 220 : 110, 0.3, (p) => { const s = 0.6 + r() * 0.9; gum.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, ground(p, 0.0015), p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 3, 0)), new THREE.Vector3(s, 1, s * (0.8 + r() * 0.4)))); });
    // copos (deitados e em pé), sacos amassados, garrafas
    const cups: THREE.Matrix4[] = [], cupColors: THREE.Color[] = [], bags: THREE.Matrix4[] = [], bagColors: THREE.Color[] = [], bottles: THREE.Matrix4[] = [];
    place(q === "high" ? 26 : 14, 0.7, (p) => { const down = r() < 0.7; cups.push(M(p, ground(p, down ? 0.04 : 0.0), r() * Math.PI * 2, down ? Math.PI / 2 : 0)); cupColors.push(new THREE.Color(["#f2efe8", "#b98a5a", "#c41e2a", "#f2efe8"][Math.floor(r() * 4)])); });
    place(q === "high" ? 12 : 7, 0.6, (p) => { const s = 0.7 + r() * 0.6; bags.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, ground(p, 0.04 * s), p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(s, s * 0.32, s * 0.8))); bagColors.push(new THREE.Color(["#e8e8e4", "#141414", "#a57a4c"][Math.floor(r() * 3)])); });
    place(q === "high" ? 9 : 5, 0.5, (p) => bottles.push(M(p, ground(p, 0.035), r() * Math.PI * 2, 0, Math.PI / 2)));
    // folhas: nas sarjetas e embaixo das árvores
    const leaves: THREE.Matrix4[] = [];
    const trees = props.filter((p) => p.kind === "tree" && p.shape.type === "circle").map((p) => p.shape as { x: number; z: number });
    for (let i = 0; i < (q === "high" ? 320 : 160); i++) {
      const t = trees[Math.floor(r() * trees.length)], g = r() < 0.55 && t ? { x: t.x + gauss(r) * 1.8, z: t.z + gauss(r) * 1.8 } : area();
      if (clean(g)) continue;
      leaves.push(new THREE.Matrix4().compose(new THREE.Vector3(g.x, ground(g, 0.003 + r() * 0.004), g.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.3, 0, r() * 6)), new THREE.Vector3(0.16, 0.16, 0.16).multiplyScalar(0.7 + r() * 0.6)));
    }
    // poças rasas (refletem a rua): beira do meio-fio, perto das grelhas e nas partes baixas da calçada
    const puddles: THREE.BufferGeometry[] = [], stains: THREE.BufferGeometry[] = [];
    const pud: [number, number, number, number, number][] = [[-12.2, CURB_Z + 0.55, 1.6, 0.42, ROAD_Y], [13.4, CURB_Z + 0.5, 1.1, 0.35, ROAD_Y], [-6.4, FAR_CURB_Z - 0.55, 1.8, 0.45, ROAD_Y], [9.2, FAR_CURB_Z - 0.5, 1.3, 0.4, ROAD_Y], [24.2, FAR_CURB_Z - 0.6, 2.2, 0.5, ROAD_Y],
      [-20.5, FAR_CURB_Z - 0.5, 1.4, 0.4, ROAD_Y], [-3.5, 47.6, 0.9, 0.55, SIDEWALK_Y], [14.6, 48.4, 1.2, 0.6, SIDEWALK_Y], [-23, 45.2, 1.0, 0.5, SIDEWALK_Y], [21.5, 28.4, 1.1, 0.7, SIDEWALK_Y], [-17.8, 31.2, 0.8, 0.5, SIDEWALK_Y], [-37.6, 62, 1.4, 0.6, ROAD_Y]];
    for (const [x, z, rx, rz, y] of pud) puddles.push(blob(r, x, z, rx, rz, y + (y === ROAD_Y ? 0.0035 : 0.0025), (r() - 0.5) * 0.4));
    for (let i = 0; i < (q === "high" ? 46 : 24); i++) { const p = area(); if (clean(p)) continue; const big = p.z > CURB_Z && p.z < FAR_CURB_Z; stains.push(blob(r, p.x, p.z, big ? 0.5 + r() * 0.9 : 0.2 + r() * 0.35, big ? 0.3 + r() * 0.5 : 0.15 + r() * 0.3, ground(p, 0.0012), r() * 3)); }
    return { flyers, rects, butts, gum, cups, cupColors, bags, bagColors, bottles, leaves, puddles: merge(puddles), stains: merge(stains) };
  }, [props, q]);

  const meshes = useMemo(() => {
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], colors?: THREE.Color[]) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      list.forEach((x, i) => { im.setMatrixAt(i, x); if (colors) im.setColorAt(i, colors[i]); });
      im.count = list.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.receiveShadow = true; return im;
    };
    const fg = flyerGeometry(); fg.setAttribute("atlasRect", new THREE.InstancedBufferAttribute(new Float32Array(data.rects), 4));
    const cupGeo = merge([lathe([[0, 0], [0.028, 0], [0.04, 0.1], [0.043, 0.104], [0.0, 0.104]], 14)]);
    const bagGeo = (() => { const g = new THREE.IcosahedronGeometry(0.11, 1), p = g.getAttribute("position") as THREE.BufferAttribute, rr = prng(77); for (let i = 0; i < p.count; i++) { const k = 0.65 + rr() * 0.6; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
    const bottleGeo = lathe([[0, 0], [0.032, 0], [0.034, 0.02], [0.034, 0.17], [0.012, 0.22], [0.011, 0.28], [0, 0.285]], 12);
    const gumGeo = new THREE.CircleGeometry(0.012, 10); gumGeo.rotateX(-Math.PI / 2);
    const leafGeo = new THREE.PlaneGeometry(1, 1);
    return {
      flyers: inst(fg, atlasMaterial(flyerAtlas(q)), data.flyers),
      butts: inst(buttGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), data.butts),
      gum: inst(gumGeo, new THREE.MeshStandardMaterial({ color: "#2c2a28", roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }), data.gum),
      cups: inst(cupGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }), data.cups, data.cupColors),
      bags: inst(bagGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }), data.bags, data.bagColors),
      bottles: inst(bottleGeo, new THREE.MeshStandardMaterial({ color: "#1f4a2a", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 }), data.bottles),
      leaves: inst(leafGeo, new THREE.MeshStandardMaterial({ map: leafTex(q, "green"), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: new THREE.Color("#a08a5a") }), data.leaves),
    };
  }, [data, q]);
  const puddleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.02, metalness: 0.0, envMapIntensity: 3, transparent: true, opacity: 0.8, alphaMap: glowTex("soft"), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false }), []);
  const stainMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, alphaMap: glowTex("soft"), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  void m;
  return (
    <group>
      {Object.entries(meshes).map(([k, o]) => <primitive key={k} object={o} />)}
      <mesh geometry={data.puddles} material={puddleMat} receiveShadow renderOrder={1} />
      <mesh geometry={data.stains} material={stainMat} renderOrder={1} />
    </group>
  );
}

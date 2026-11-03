/*
 * MET Gala Heist v2 — Grande Salão — lote por acabamento (cor por vértice). As peças pequenas do salão (equipamento do
 * DJ, comida, doces, ferragens) usam dezenas de cores lisas; `tinting(c)` troca o lote e as instâncias do contexto para
 * que um material liso "solid-salao-…" vire um material branco com cor por vértice, um por acabamento — ver abaixo.
 */
import * as THREE from "three";
import type { Batch, Instances } from "../interior-batch";

/*
 * As peças pequenas do salão (equipamento do DJ, comida, doces, ferragens) usam dezenas de cores lisas; cada material
 * seria uma chamada de desenho. `tinting(c)` devolve o contexto com o lote e as instâncias trocados: um material liso
 * "solid-salao-…" (sem textura, opaco, sem emissão) vira um material branco com cor por vértice, um por acabamento
 * (metal/rugosidade/ambiente arredondados), e a cor vai assada na geometria. Instâncias pequenas (até ~6 mil triângulos
 * por chave) entram no mesmo lote; as grandes (cascas de macaron, taças, rosas) continuam instanciadas.
 */
const tintMats = new Map<string, THREE.MeshStandardMaterial>();
const _tc = new THREE.Color();
function tintOf(m: THREE.Material): { mat: THREE.MeshStandardMaterial; color: THREE.Color } | null {
  const s = m as THREE.MeshStandardMaterial;
  if (s.type !== "MeshStandardMaterial" || !s.name.startsWith("solid-salao-") || s.map || s.normalMap || s.roughnessMap || s.transparent || s.opacity < 1 || s.vertexColors) return null;
  if (s.emissive && (s.emissive.r + s.emissive.g + s.emissive.b) * s.emissiveIntensity > 0.001) return null;
  const metal = Math.round(s.metalness * 4) / 4, rough = Math.round(s.roughness * 10) / 10, env = Math.round(s.envMapIntensity * 4) / 4, key = `${s.side}|${metal}|${rough}|${env}`;
  let t = tintMats.get(key);
  if (!t) { t = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, metalness: metal, roughness: rough, envMapIntensity: env, side: s.side }); t.name = `salao-tint-${key}`; tintMats.set(key, t); }
  return { mat: t, color: s.color };
}
function tinted(g: THREE.BufferGeometry, c: THREE.Color, k?: THREE.Color): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone(), n = out.getAttribute("position").count, a = new Float32Array(n * 3);
  _tc.copy(c); if (k) _tc.multiply(k);
  for (let i = 0; i < n; i++) { a[i * 3] = _tc.r; a[i * 3 + 1] = _tc.g; a[i * 3 + 2] = _tc.b; }
  out.setAttribute("color", new THREE.BufferAttribute(a, 3)); return out;
}
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
/** Contexto com lote/instâncias por acabamento (ver acima). Chame `done()` no fim para decidir as instâncias. */
export function tinting<T extends { batch: Batch; inst: Instances }>(c: T): T & { done: () => void } {
  const base = c.batch, binst = c.inst;
  const batch = Object.create(base) as Batch;
  batch.add = (room, m, g, mm, o = {}) => { const t = tintOf(m); if (t) base.add(room, t.mat, tinted(g, t.color), mm, o); else base.add(room, m, g, mm, o); };
  const held = new Map<string, { room: string; g: THREE.BufferGeometry; m: THREE.Material; items: [THREE.Matrix4, THREE.Color | undefined][] }>();
  const inst = Object.create(binst) as Instances;
  inst.add = (room, key, g, m, mm, color) => {
    if (!tintOf(m)) { binst.add(room, key, g, m, mm, color); return; }
    const k = `${room}|${key}|${m.uuid}`; let h = held.get(k); if (!h) { h = { room, g, m, items: [] }; held.set(k, h); }
    h.items.push([mm.clone(), color?.clone()]);
  };
  const done = () => {
    for (const [k, h] of held) {
      const key = k.split("|")[1];
      if (tris(h.g) * h.items.length > 6000) { for (const [mm, col] of h.items) binst.add(h.room, key, h.g, h.m, mm, col); continue; }
      const t = tintOf(h.m)!; for (const [mm, col] of h.items) base.add(h.room, t.mat, tinted(h.g, t.color, col), mm);
    }
    held.clear();
  };
  return { ...c, batch, inst, done };
}

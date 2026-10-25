/*
 * MET Gala Heist v2 — o tecido das pessoas em cena, depois que o corpo do FashionAI termina de vestir (só nesta cena: o
 * molde do provador não muda).
 *
 * Brilho: o sheen branco padrão deixa smoking preto e vestido escuro cinzentos sob luz forte; aqui o brilho é na cor do
 * pano, e o cetim (pouca rugosidade) ganha um verniz leve, como nas referências de gala. O tingimento por pessoa (cor do
 * vestido/paletó) é uma cópia do material por cor, guardada para os clones que repetem a cor.
 *
 * Acabamento das peças (mendGarments):
 *  - vestido: o corpete desce um pouco por dentro do tubo da saia (sem a fresta de pele na cintura) e o tubo perde as
 *    ondas que as pernas desenham nele (joelho, panturrilha): o raio é suavizado sem nunca entrar mais de 3 mm, então a
 *    perna não atravessa a saia;
 *  - camisa por baixo de paletó ou colete: aparece inteira na abertura da frente (sem pele entre a camisa e a lapela) e
 *    vai para dentro da calça (some logo acima da barra do paletó; a calça volta a aparecer por baixo dela).
 */
import * as THREE from "three";
import type { Look3dPiece } from "@/components/three/common";
import type { HumanParts } from "@/components/three/human-avatar";
import { bodyParam, type BodyParam, type GarmentSpec } from "@/lib/avatar3d/human/garments";
import { specFor } from "@/lib/avatar3d/human/garment-fit";

/* ---------- brilho e tingimento ---------- */
const TINTS = new WeakMap<THREE.Material, Map<string, THREE.Material>>();
const WHITE = new THREE.Color("#ffffff");
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Brilho do tecido na própria cor; cetim com verniz leve. */
export function fabricSheen(m: THREE.MeshPhysicalMaterial, color: THREE.Color) {
  const l = lum(color);
  m.sheenColor = color.clone().lerp(WHITE, 0.08 + 0.35 * l);
  m.sheen = Math.min(Math.max(m.sheen, 0.15), 0.15 + 0.6 * Math.sqrt(l)) + (m.roughness < 0.5 ? 0.3 : 0);
  if (m.roughness < 0.5) { m.clearcoat = 0.2; m.clearcoatRoughness = 0.32; }
}

/** Ajusta o brilho de cada peça pela cor dela (peças achadas pelo nome da malha: "peca-<id>", "barra-<id>"…). */
export function fixFabrics(root: THREE.Object3D, pieces: Look3dPiece[], skip?: Set<string>) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || skip?.has(o.name)) return;
    const piece = pieces.find((p) => o.name.endsWith(p.id)); if (!piece?.colorHex) return;
    for (const mat of ([] as THREE.Material[]).concat(mesh.material)) {
      const pm = mat as THREE.MeshPhysicalMaterial;
      if (!pm.isMeshPhysicalMaterial || pm.userData.fabricFixed || pm.vertexColors && o.name.includes("sola")) continue;
      pm.userData.fabricFixed = true; fabricSheen(pm, new THREE.Color(piece.colorHex));
    }
  });
}

/** Cópia do material na cor `hex`. Tecido com textura: a cor multiplica a trama (base clara); acabamento: a cor direto. */
export function tinted(src: THREE.Material, hex: string): THREE.Material {
  let by = TINTS.get(src); if (!by) { by = new Map(); TINTS.set(src, by); }
  let m = by.get(hex);
  if (!m) {
    const c = src.clone() as THREE.MeshPhysicalMaterial;
    // Material.clone não leva o shader próprio da peça (alfa por vértice, painel da foto)
    c.onBeforeCompile = src.onBeforeCompile; c.customProgramCacheKey = src.customProgramCacheKey;
    const tint = new THREE.Color(hex);
    if (c.color) c.color.copy(tint).multiplyScalar(c.map ? 1.18 : 0.95);
    if (c.isMeshPhysicalMaterial) fabricSheen(c, tint);
    m = c; by.set(hex, m);
  }
  return m;
}

/* ---------- acabamento das peças ---------- */
const PARAMS = new WeakMap<object, BodyParam>();
function paramsOf(p: HumanParts): BodyParam {
  let P = PARAMS.get(p.composed);
  if (!P) { P = bodyParam(p.asset, p.composed); PARAMS.set(p.composed, P); }
  return P;
}
const OUTER = new Set(["jacket", "vest", "coat"]), INNER = new Set(["shirt", "tee", "longsleeve"]);

/** Vértices da malha presos sobretudo a um osso do braço ou da mão (a manga não entra nas regras do tronco). */
function armVertices(mesh: THREE.SkinnedMesh): Uint8Array {
  const idx = mesh.geometry.getAttribute("skinIndex"), wt = mesh.geometry.getAttribute("skinWeight"), bones = mesh.skeleton?.bones ?? [];
  const out = new Uint8Array(idx.count);
  for (let i = 0; i < idx.count; i++) {
    let best = 0, w = -1;
    for (let k = 0; k < 4; k++) { const x = wt.getComponent(i, k); if (x > w) { w = x; best = idx.getComponent(i, k); } }
    out[i] = /Arm|Hand/.test(bones[best]?.name ?? "") ? 1 : 0;
  }
  return out;
}

/**
 * Acerta vestido, camisa e calça montados (uma vez por geometria: os clones compartilham a malha do modelo; na jogadora,
 * a cada troca de roupa). As alturas `h` são as do molde: 0 na articulação do quadril, 1 na base do pescoço.
 */
export function mendGarments(p: HumanParts, pieces: Look3dPiece[]) {
  const P = paramsOf(p), span = P.neckY - P.hipY, hOf = (y: number) => (y - P.hipY) / span;
  const worn = pieces.flatMap((piece) => { const spec = specFor(piece); return spec ? [{ piece, spec }] : []; });
  const outerOf = (sp: GarmentSpec) => worn.filter((o) => o.spec.layer > sp.layer && OUTER.has(o.spec.kind) && Number.isFinite(o.spec.hem));
  const tucked = worn.some((w) => w.spec.kind === "shirt" && outerOf(w.spec).length > 0);
  for (const { piece, spec } of worn) {
    const mesh = p.human.root.getObjectByName(`peca-${piece.id}`) as THREE.SkinnedMesh | undefined;
    const geo = mesh?.geometry, pos = geo?.getAttribute("position"), col = geo?.getAttribute("color");
    if (!mesh || !geo || !pos || !col || col.itemSize !== 4 || geo.userData.mended) continue;
    geo.userData.mended = true;
    const arm = armVertices(mesh);
    if (spec.kind === "dress" && spec.skirt > 0) {
      // o corpete desce ~2,5 cm por dentro do tubo da saia: a borda dele (alfa interpolado, serrilhada) não deixa fresta
      for (let i = 0; i < pos.count; i++) {
        const h = hOf(pos.getY(i));
        if (!arm[i] && h > spec.hem - 0.05 && h < spec.hem + 0.05 && col.getW(i) < 1) col.setW(i, 1);
      }
      const index = geo.getIndex();
      if (index && smoothSkirt(pos.array as Float32Array, index.array, P.torsoZ, P.hipY)) { pos.needsUpdate = true; geo.computeVertexNormals(); }
    }
    const outer = INNER.has(spec.kind) ? outerOf(spec) : [];
    if (outer.length) {
      // camisa social vai para dentro da calça; camiseta sob jaqueta fica para fora, como está
      const tuck = spec.kind === "shirt", cut = Math.min(...outer.map((o) => o.spec.hem)) + 0.035, neck = spec.neck - spec.vneck - 0.03;
      for (let i = 0; i < pos.count; i++) {
        if (arm[i]) continue;
        const h = hOf(pos.getY(i)), dz = pos.getZ(i) - P.torsoZ;
        if (tuck && h < cut) col.setW(i, 0);
        else if (dz > 0 && Math.abs(pos.getX(i)) < 0.13 && h < neck) col.setW(i, 1);
      }
      const hem = tuck ? p.human.root.getObjectByName(`barra-${piece.id}`) : null; if (hem) hem.visible = false;
    }
    if (tucked && Number.isFinite(spec.waist) && (spec.leg > 0 || spec.skirt > 0)) {
      // calça/saia sob a camisa para dentro: o alto dela volta a aparecer onde a camisa sumiu
      for (let i = 0; i < pos.count; i++) { const h = hOf(pos.getY(i)); if (h > -0.6 && h < spec.waist - 0.03) col.setW(i, 1); }
    }
    col.needsUpdate = true;
  }
}

/**
 * Tubo da saia do vestido (a parte ligada ao vértice mais baixo da malha), no espaço do molde (x, y, z em sequência).
 * O relaxamento e a folga das pernas deixam ondas de 2–4 cm no tubo (o desenho dos joelhos e das panturrilhas), que o
 * cetim transforma em manchas de brilho. Aqui o tecido cai como cai um vestido longo:
 *  1. abaixo do quadril, cada coluna (64 ângulos) desce reta do ponto mais largo — sem entrar de novo sob o bumbum, o
 *     joelho ou a panturrilha;
 *  2. o vão entre as pernas e o que sobrou das ondas é alisado pelo raio (média dos vizinhos, 40 passos), que só sobe ou
 *     desce no máximo 3 mm: a saia nunca chega mais perto da perna do que estava.
 * O anel de cima (emenda com o corpete) fica onde está. Devolve quantos vértices do tubo mudaram.
 */
export function smoothSkirt(p: Float32Array, index: ArrayLike<number>, torsoZ: number, hipY: number): number {
  const n = p.length / 3;
  // vértices repetidos na mesma posição (costura de UV) viram um só
  const ids = new Map<string, number>(), uid = new Int32Array(n); let nu = 0;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(p[i * 3] * 1e5)},${Math.round(p[i * 3 + 1] * 1e5)},${Math.round(p[i * 3 + 2] * 1e5)}`;
    let u = ids.get(k); if (u === undefined) { u = nu++; ids.set(k, u); } uid[i] = u;
  }
  const x = new Float64Array(nu), y = new Float64Array(nu), dz = new Float64Array(nu);
  for (let i = 0; i < n; i++) { const u = uid[i]; x[u] = p[i * 3]; y[u] = p[i * 3 + 1]; dz[u] = p[i * 3 + 2] - torsoZ; }
  const nb: number[][] = Array.from({ length: nu }, () => []);
  const link = (a: number, b: number) => { if (a !== b && !nb[a].includes(b)) { nb[a].push(b); nb[b].push(a); } };
  for (let t = 0; t + 2 < index.length; t += 3) { const a = uid[index[t]], b = uid[index[t + 1]], c = uid[index[t + 2]]; link(a, b); link(b, c); link(c, a); }
  // a saia: tudo o que se liga ao vértice mais baixo
  let low = 0; for (let u = 1; u < nu; u++) if (y[u] < y[low]) low = u;
  const tube = new Uint8Array(nu), queue = [low], list: number[] = []; tube[low] = 1;
  let top = -Infinity;
  while (queue.length) { const u = queue.pop()!; list.push(u); top = Math.max(top, y[u]); for (const v of nb[u]) if (!tube[v]) { tube[v] = 1; queue.push(v); } }
  const r0 = new Float64Array(nu); for (const u of list) r0[u] = Math.hypot(x[u], dz[u]);
  // 1. cai reto do ponto mais largo, coluna por coluna
  const NA = 64, cols: number[][] = Array.from({ length: NA }, () => []);
  for (const u of list) cols[Math.round(((Math.atan2(x[u], dz[u]) + Math.PI) / (2 * Math.PI)) * NA) % NA].push(u);
  const hang = Float64Array.from(r0);
  for (const c of cols) { c.sort((a, b) => y[b] - y[a]); let m = 0; for (const u of c) if (y[u] < hipY - 0.03) { hang[u] = Math.max(hang[u], m); m = hang[u]; } }
  // 2. alisa o raio sem chegar mais de 3 mm para dentro
  let r = Float64Array.from(hang), next = new Float64Array(nu);
  for (let it = 0; it < 40; it++) {
    for (const u of list) {
      if (y[u] > top - 0.006 || !nb[u].length) { next[u] = r[u]; continue; }
      let m = 0; for (const v of nb[u]) m += r[v];
      next[u] = Math.max(hang[u] - 0.003, m / nb[u].length);
    }
    [r, next] = [next, r];
  }
  let moved = 0;
  for (const u of list) if (Math.abs(r[u] - r0[u]) > 1e-4) moved++;
  for (let i = 0; i < n; i++) {
    const u = uid[i]; if (!tube[u] || r0[u] < 1e-4) continue;
    const s = r[u] / r0[u]; p[i * 3] *= s; p[i * 3 + 2] = torsoZ + (p[i * 3 + 2] - torsoZ) * s;
  }
  return moved;
}

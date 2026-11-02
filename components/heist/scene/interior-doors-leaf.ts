/*
 * MET Gala Heist v2 — as folhas das portas internas, uma família por tipo de porta, desenhadas no referencial da folha
 * (dobradiça em x = 0, folha para +x, altura em y, espessura em z; +z é a "frente"). Cada folha sai em poucas malhas (uma
 * por material, geometria mesclada e reaproveitada entre folhas iguais) e traz dobradiças à vista; as que fecham sozinhas
 * levam a mola aérea com braço articulado (o cotovelo é resolvido a cada quadro pelo ângulo da folha).
 *
 *  - nobre (salão e galeria, 4 m): nogueira com montantes e travessas, almofadas levantadas com moldura bolection e filete
 *    dourado, florão entalhado no alto, losango no meio, puxador de latão de 0,9 m, placa de empurrar e chapa de chute;
 *  - aço (doca, serviço, terraço da equipe, segurança): chapa pintada, visor de vidro aramado com baguete, chapa de chute
 *    inox, barra antipânico do lado de empurrar e alavanca do outro;
 *  - acolchoada (lounge): couro capitonê com botões e tachas de latão sobre mogno, placa oval e puxador;
 *  - palco (bastidores): preta fosca com marcas de uso, o nome em estêncil, visor redondo, placa e chapa de alumínio;
 *  - francesa (terraço): madeira branca com 2 × 5 vidros, travessa baixa cega, cremona e maçanetas de latão;
 *  - disfarçada (equipe, no salão): do lado do salão continua a parede (calcário, lambri de nogueira, rodapé de nero),
 *    do lado do serviço é uma porta de aço com barra;
 *  - blindada (Sala das Joias): aço polido de 30 cm com quadro em degrau, painel "guilhochê", volante de cinco raios,
 *    disco do segredo, seis trancas cromadas na borda e as dobradiças cilíndricas; por dentro, o mecanismo atrás do vidro.
 *
 * Aqui ficam o braço da mola aérea e a montagem da folha (buildLeaf, que escolhe a família pelo estilo); as peças
 * comuns e os materiais ficam em interior-doors-leaf-parts, as texturas em interior-doors-leaf-tex e as famílias em
 * interior-doors-leaf-wood (nobre, acolchoada, francesa) e interior-doors-leaf-metal (aço, palco, disfarçada, blindada).
 */
import * as THREE from "three";
import type { Palette } from "./interior-mats";
import type { Quality } from "./interior-tex";
import { Parts, doorMats, type DoorMats, type LeafSpec, type LeafStyle } from "./interior-doors-leaf-parts";
import { french, grand, padded } from "./interior-doors-leaf-wood";
import { jib, stage, steel, vault } from "./interior-doors-leaf-metal";

export { LEAF_T, type DoorMats, type LeafSpec, type LeafStyle } from "./interior-doors-leaf-parts";

/* ---------- mola aérea: braço articulado ---------- */
/**
 * Braço da mola (dois elos numa malha só, do lado de empurrar `side`): o eixo fica na folha, a sapata pende do forro do
 * vão; a cada quadro o cotovelo é resolvido pelo ângulo atual da folha (`holder.rotation.y`) e os vértices são refeitos.
 */
export const CLOSER_SHOE: [number, number] = [0.5, 0.12];
export function closerArm(h: number, t: number, side: number, holder: THREE.Object3D, m: THREE.Material): THREE.Mesh {
  const pull = side, S = new THREE.Vector2(0.12, side * (t / 2 + 0.06)), F0 = new THREE.Vector2(CLOSER_SHOE[0], side * Math.max(CLOSER_SHOE[1], t / 2 + 0.09)), a = 0.26, b = 0.3, y = h - 0.115;
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), base = (g.getAttribute("position") as THREE.BufferAttribute).array.slice() as Float32Array;
  const pos = new Float32Array(base.length * 2); const geom = new THREE.BufferGeometry(); geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(pos.length), 3)); geom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  const mesh = new THREE.Mesh(geom, m); mesh.frustumCulled = false; mesh.castShadow = false;
  let last = NaN;
  const seg = (off: number, p: THREE.Vector2, q: THREE.Vector2, yy: number, wd: number) => {
    const dx = q.x - p.x, dz = q.y - p.y, len = Math.hypot(dx, dz) || 1e-4, ux = dx / len, uz = dz / len;
    for (let i = 0; i < base.length; i += 3) {
      const lx = base[i] * len, ly = base[i + 1] * 0.022, lz = base[i + 2] * wd;
      pos[off + i] = p.x + ux * (lx + len / 2) - uz * lz; pos[off + i + 1] = yy + ly; pos[off + i + 2] = p.y + uz * (lx + len / 2) + ux * lz;
    }
  };
  const solve = () => {
    const r = holder.rotation.y; if (r === last) return; last = r;
    const c = Math.cos(r), s = Math.sin(r), F = new THREE.Vector2(F0.x * c - F0.y * s, F0.x * s + F0.y * c);
    const d = Math.min(a + b - 1e-3, Math.max(Math.abs(a - b) + 1e-3, F.distanceTo(S))), u = F.clone().sub(S).normalize(), l = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - l * l));
    // cotovelo sempre do mesmo lado da linha eixo→sapata (o lado de fora quando fechada): o braço dobra sem pular
    const n = pull < 0 ? new THREE.Vector2(u.y, -u.x) : new THREE.Vector2(-u.y, u.x);
    const E = S.clone().addScaledVector(u, l).addScaledVector(n, hh);
    seg(0, S, E, y, 0.03); seg(base.length, E, F, y - 0.012, 0.022);
    geom.getAttribute("position").needsUpdate = true; geom.computeVertexNormals(); geom.computeBoundingSphere();
  };
  solve();
  mesh.onBeforeRender = () => { solve(); };
  return mesh;
}

/** Folha pronta: um grupo com uma malha por material (geometria reaproveitada entre folhas iguais). */
const cache = new Map<string, { m: THREE.Material; g: THREE.BufferGeometry }[]>();
export function buildLeaf(s: LeafSpec, P: Palette, q: Quality): THREE.Group {
  const key = `${s.style}|${s.w.toFixed(3)}|${s.h.toFixed(3)}|${s.pull}|${s.front}|${s.back}|${s.stencil ?? ""}|${s.closer ? 1 : 0}|${s.wallUv ? `${s.wallUv.origin}/${s.wallUv.dir}` : ""}|${q}`;
  let parts = cache.get(key);
  if (!parts) {
    const p = new Parts(), M = doorMats(P);
    ({ grand, steel, padded, stage, french, jib, vault } as Record<LeafStyle, (p: Parts, M: DoorMats, s: LeafSpec) => void>)[s.style](p, M, s);
    parts = p.done(); cache.set(key, parts);
  }
  const g = new THREE.Group();
  for (const { m, g: geom } of parts) { const me = new THREE.Mesh(geom, m); me.castShadow = true; me.receiveShadow = true; g.add(me); }
  return g;
}
export { doorMats };

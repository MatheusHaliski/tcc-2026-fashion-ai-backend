/**
 * Pele debaixo da roupa não é desenhada como pele. É como os jogos vestem personagem — no GTA a peça de cima TROCA
 * o tronco, não fica por cima dele; nos sistemas modulares (Radical Heights) a peça vestida marca as áreas do corpo
 * que ela cobre e o corpo deixa de desenhá-las. Aqui a área não vem de um mapa pintado à mão por tipo de peça: sai
 * da própria peça ajustada, e no lugar da pele entra um FORRO na cor da peça (components/three/outfit-skin.ts). Onde
 * a malha da Meshy tem furo, é rala ou a pele a atravessa, aparece o forro — nunca pele, nunca o vazio.
 *
 * Um vértice de pele está debaixo da peça quando ela está logo à frente dele, do lado para onde a pele olha: pele
 * da frente × frente da peça, pele das costas × costas da peça, pele de lado × peça dos dois lados. "Logo à frente"
 * tem distância máxima: a manga solta que passa diante da coxa não esconde a coxa. Cada parte da peça (tronco,
 * mangas, pernas) é conferida sozinha — a manga não se passa pelo tronco. Só troca o triângulo com os TRÊS vértices
 * debaixo da peça: na gola, no punho e na barra a pele continua até debaixo da borda do pano, sem fresta.
 */
import { depthAt, meshDepth, type DepthField } from "./depth";
import type { BodyFrame } from "./frame";

/** A pele que passa do pano até aqui (m) ainda conta como coberta: é o que atravessaria a peça. */
const THROUGH = 0.015;
/** Distância máxima (m) entre a pele e o pano que a cobre. */
const NEAR = 0.07;
/** Até onde (m) a pele fora do pano ainda é "atravessando" (mais longe que isso, o pano é de outra parte do corpo). */
const REACH = 0.12;
/** Pele que a roupa nunca esconde: cabeça (0), pé (4) e mão (5). */
const BARE = [0, 4, 5];

function fieldsOf(posed: Float32Array, index: ArrayLike<number>, part: Int8Array): DepthField[] {
  const byPart = new Map<number, number[]>();
  for (let t = 0; t < index.length; t += 3) {
    const k = part[index[t]];
    if (part[index[t + 1]] !== k || part[index[t + 2]] !== k) continue;
    (byPart.get(k) ?? byPart.set(k, []).get(k)!).push(index[t], index[t + 1], index[t + 2]);
  }
  return [...byPart.values()].map((tri) => meshDepth(posed, tri)).filter((d): d is DepthField => !!d);
}

/** 1 coberta; 2 atravessando (a pele passa para fora do pano que devia cobri-la); 0 sem pano por perto. */
function stateOf(d: DepthField, x: number, y: number, z: number, facing: number): number {
  const cloth = depthAt(d, x, y);
  if (!cloth) return 0;
  const ahead = cloth.front - z, behind = z - cloth.back;
  const grade = (gap: number) => (gap > NEAR ? 0 : gap >= -THROUGH ? 1 : gap >= -REACH ? 2 : 0);
  if (facing > 0.3) return grade(ahead);
  if (facing < -0.3) return grade(behind);
  return ahead >= -THROUGH && behind >= -THROUGH && (ahead <= NEAR || behind <= NEAR) ? 1 : 0;
}

export interface Cover {
  /**
   * 1 para cada vértice de pele que fica DEBAIXO da peça: coberto, atravessando o pano ou numa ilha de pele cercada
   * pela peça. O corpo não desenha esses triângulos como pele: desenha o forro, na cor da peça.
   */
  covered: Uint8Array;
  /** fração da pele debaixo da peça que atravessa o pano em vez de ficar coberta */
  pierced: number;
}

/**
 * Ilhas: a pele descoberta que não chega à cabeça, a uma mão nem a um pé sem passar por baixo da peça está CERCADA
 * por ela — é furo ou malha faltando no .glb (o alto do braço entre a pala e a manga), não decote, punho ou barra.
 * Vira "debaixo da peça" também. Decote, cava e barra continuam pele: ligam-se à cabeça, à mão ou ao pé.
 */
function closeIslands(under: Uint8Array, f: BodyFrame): void {
  const next: number[][] = Array.from({ length: f.n }, () => []);
  for (let t = 0; t < f.tri.length; t += 3) {
    const a = f.tri[t], b = f.tri[t + 1], c = f.tri[t + 2];
    next[a].push(b, c); next[b].push(a, c); next[c].push(a, b);
  }
  const open = new Uint8Array(f.n);
  const queue: number[] = [];
  for (let v = 0; v < f.n; v++) if (BARE.includes(f.group[v]) && next[v].length) { open[v] = 1; queue.push(v); }
  for (let i = 0; i < queue.length; i++) for (const u of next[queue[i]]) {
    if (open[u] || under[u]) continue;
    open[u] = 1; queue.push(u);
  }
  for (let v = 0; v < f.n; v++) if (!open[v] && next[v].length) under[v] = 1;
}

/** Cobertura da pele pela peça já ajustada (`posed`, no espaço do corpo posado). */
export function coverOf(posed: Float32Array, index: ArrayLike<number>, part: Int8Array, f: BodyFrame): Cover {
  const fields = fieldsOf(posed, index, part);
  const covered = new Uint8Array(f.n);
  let under = 0, through = 0;
  for (let v = 0; v < f.n; v++) {
    if (BARE.includes(f.group[v])) continue;
    const x = f.pos[v * 3], y = f.pos[v * 3 + 1], z = f.pos[v * 3 + 2];
    let state = 0;
    for (const d of fields) {
      const s = stateOf(d, x, y, z, f.nrm[v * 3 + 2]);
      if (s === 1) { state = 1; break; }
      state = Math.max(state, s);
    }
    if (state) covered[v] = 1;
    if (state === 1) under++; else if (state === 2) through++;
  }
  if (under + through) closeIslands(covered, f);
  return { covered, pierced: through / Math.max(1, under + through) };
}

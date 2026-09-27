import type * as THREE from "three";
import { torsoHalfWidth, type Limb, type Section, type Spec, type V3 } from "@/lib/avatar3d/body-spec";

/*
 * Métricas de vestir (digital double, requisito 19): medem a malha da roupa contra o corpo canônico — nunca contra uma
 * captura favorável. Tudo em metros no espaço do corpo (pés no chão, frente +z); os resultados saem em cm/percentual.
 *  - penetration: fração dos vértices da roupa que estão DENTRO do corpo (atravessam pele);
 *  - gap: distância entre o tecido e a pele (média, p95, máximo) — folga demais = "flutua";
 *  - floating: fração dos vértices com folga acima do limite (3 cm);
 *  - coverage: fração da superfície do tronco (virilha → base do pescoço) coberta por tecido opaco;
 *  - stretch: razão área 3D / área da foto por triângulo (1 = estampa sem esticar), média e p95;
 *  - stretch é medido só nos triângulos que exibem a foto (os demais recebem a cor do tecido, sem estampa);
 *  - printShare: fração dos triângulos que exibem a foto;
 *  - vertices, triangles, buildMs: custo.
 */
export interface GarmentReport {
  penetration: number; gapMeanCm: number; gapP95Cm: number; gapMaxCm: number; floating: number;
  coverage: number | null; stretchMean: number; stretchP95: number; printShare: number; vertices: number; triangles: number; buildMs: number;
  /** por região do corpo (tronco/braços): folga média em cm */
  byRegion: Record<string, { gapMeanCm: number; penetration: number; n: number }>;
}

/** Distância (com sinal) de um ponto ao corpo: negativa = dentro. Considera o tronco (elipses) e os membros (cápsulas). */
export function signedDistanceToBody(s: Spec, x: number, y: number, z: number): { d: number; region: string } {
  let best = Infinity; let region = "none";
  const t = s.torso;
  if (y >= t[0].y && y <= t[t.length - 1].y) {
    const sec = sectionAt(t, y);
    // distância radial aproximada à elipse (escala pelo raio na direção do ponto)
    const ang = Math.atan2(z / Math.max(1e-6, sec.b), x / Math.max(1e-6, sec.a));
    const rx = Math.cos(ang) * sec.a, rz = Math.sin(ang) * sec.b;
    const rEdge = Math.hypot(rx, rz), rPt = Math.hypot(x, z);
    const d = rPt - rEdge;
    if (d < best) { best = d; region = "torso"; }
  }
  for (const l of s.limbs) {
    const d = capsuleDistance([x, y, z], l);
    if (d < best) { best = d; region = /Arm|forearm/.test(l.name) ? "arms" : "legs"; }
  }
  return { d: best, region };
}

function sectionAt(t: Section[], y: number): Section {
  for (let i = 1; i < t.length; i++) if (y <= t[i].y) { const a = t[i - 1], b = t[i]; const k = (y - a.y) / Math.max(1e-9, b.y - a.y); return { y, a: a.a + (b.a - a.a) * k, b: a.b + (b.b - a.b) * k }; }
  return t[t.length - 1];
}

function capsuleDistance(p: V3, l: Limb): number {
  const ax = l.from[0], ay = l.from[1], az = l.from[2]; const bx = l.to[0] - ax, by = l.to[1] - ay, bz = l.to[2] - az;
  const len2 = bx * bx + by * by + bz * bz;
  const tt = Math.max(0, Math.min(1, ((p[0] - ax) * bx + (p[1] - ay) * by + (p[2] - az) * bz) / Math.max(1e-9, len2)));
  const cx = ax + bx * tt, cy = ay + by * tt, cz = az + bz * tt;
  const r = l.r0 + (l.r1 - l.r0) * tt;
  return Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz) - r;
}

function pct(arr: number[], q: number): number { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; }

/**
 * Relatório de uma peça vestida. `geo` é a malha da roupa (não indexada, com uv planar no box da foto); `alphaAt(u, v)`
 * devolve a opacidade da foto (0–1) para medir cobertura — sem ele, a cobertura fica nula (não medida).
 */
export function garmentReport(s: Spec, geo: THREE.BufferGeometry, box: { x: number; top: number; w: number; h: number }, buildMs: number, alphaAt?: (u: number, v: number) => number, opts: { printMinNz?: number } = {}): GarmentReport {
  const pos = geo.getAttribute("position"); const uv = geo.getAttribute("uv"); const n = pos.count;
  const gaps: number[] = []; let inside = 0; let floating = 0;
  const byRegion: Record<string, { sum: number; inside: number; n: number }> = {};
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (alphaAt && uv && alphaAt(uv.getX(i), uv.getY(i)) < 0.4) continue;            // pixel transparente: não há tecido ali
    const { d, region } = signedDistanceToBody(s, x, y, z);
    if (region === "none") continue;
    const r = (byRegion[region] ??= { sum: 0, inside: 0, n: 0 }); r.n++;
    if (d < -0.002) { inside++; r.inside++; } else { gaps.push(d); r.sum += d; }
    if (d > 0.03) floating++;
  }
  const measured = Math.max(1, gaps.length + inside);
  // estiramento: área do triângulo em 3D ÷ área correspondente na foto (uv × box)
  const stretch: number[] = []; let printed = 0; const tris = Math.floor(n / 3);
  if (uv) for (let f = 0; f + 2 < n; f += 3) {
    if (opts.printMinNz != null && faceNz(pos, f) < opts.printMinNz) continue;          // triângulo sem foto (cor do tecido)
    printed++;
    const a3 = tri3(pos, f), a2 = tri2(uv, f) * box.w * box.h;
    if (a2 > 1e-9 && a3 > 1e-9) stretch.push(a3 / a2);
  }
  // cobertura: pontos da superfície do tronco projetados na foto; coberto = opaco e dentro do box
  let coverage: number | null = null;
  if (alphaAt) {
    let covered = 0, total = 0;
    for (const sec of s.torso) for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2; const x = Math.sin(ang) * sec.a, z = Math.cos(ang) * sec.b;
      if (z < 0) continue;                                                              // só a frente (a foto é frontal)
      total++;
      const u = (x - (box.x - box.w / 2)) / box.w, v = (sec.y - (box.top - box.h)) / box.h;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && alphaAt(u, v) >= 0.4) covered++;
    }
    coverage = total ? covered / total : 0;
  }
  const out: GarmentReport = {
    penetration: inside / measured, gapMeanCm: (gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)) * 100, gapP95Cm: pct(gaps, 0.95) * 100,
    gapMaxCm: (gaps.length ? Math.max(...gaps) : 0) * 100, floating: floating / measured, coverage,
    stretchMean: stretch.reduce((a, b) => a + b, 0) / Math.max(1, stretch.length), stretchP95: pct(stretch, 0.95), printShare: tris ? printed / tris : 0, vertices: n, triangles: tris, buildMs,
    byRegion: Object.fromEntries(Object.entries(byRegion).map(([k, r]) => [k, { gapMeanCm: (r.sum / Math.max(1, r.n - r.inside)) * 100, penetration: r.inside / Math.max(1, r.n), n: r.n }])),
  };
  return out;
}

/** Componente z da normal da face (frente = +z): diz se o triângulo encara a câmera frontal de onde veio a foto. */
export function faceNz(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, f: number): number {
  const ax = pos.getX(f), ay = pos.getY(f), az = pos.getZ(f), bx = pos.getX(f + 1) - ax, by = pos.getY(f + 1) - ay, bz = pos.getZ(f + 1) - az, cx = pos.getX(f + 2) - ax, cy = pos.getY(f + 2) - ay, cz = pos.getZ(f + 2) - az;
  const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx; const len = Math.hypot(nx, ny, nz);
  return len > 1e-12 ? nz / len : 0;
}

/**
 * Colisões corpo × roupa (requisitos 13 e 14): afasta da pele os vértices da roupa que ficaram dentro do corpo ou a
 * menos de `clearance` metros dele, na direção do gradiente da distância com sinal. Não mexe no que já está folgado.
 * No tronco o deslocamento é só horizontal (a barra e a gola não sobem nem descem). Vértices repetidos (malha não
 * indexada) recebem o mesmo resultado, então a malha não rasga. Devolve quantos vértices foram movidos.
 */
export function resolveCollisions(s: Spec, pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, clearance = 0.003, iterations = 12): number {
  const h = 0.002; let moved = 0; const done = new Map<string, V3>();
  const dist = (x: number, y: number, z: number) => signedDistanceToBody(s, x, y, z).d;
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
    const key = `${x0.toFixed(5)}|${y0.toFixed(5)}|${z0.toFixed(5)}`;
    const hit = done.get(key);
    if (hit) { if (hit[0] !== x0 || hit[1] !== y0 || hit[2] !== z0) { pos.setXYZ(i, hit[0], hit[1], hit[2]); moved++; } continue; }
    let x = x0, y = y0, z = z0;
    for (let it = 0; it < iterations; it++) {
      const { d, region } = signedDistanceToBody(s, x, y, z);
      if (!Number.isFinite(d) || d >= clearance) break;
      let gx = dist(x + h, y, z) - dist(x - h, y, z), gy = dist(x, y + h, z) - dist(x, y - h, z), gz = dist(x, y, z + h) - dist(x, y, z - h);
      if (region === "torso") gy = 0;
      let len = Math.hypot(gx, gy, gz);
      if (len < 1e-9) { gx = x; gy = 0; gz = z; len = Math.hypot(gx, gz) || 1; }
      const step = clearance - d; x += (gx / len) * step; y += (gy / len) * step; z += (gz / len) * step;
    }
    done.set(key, [x, y, z]);
    if (x !== x0 || y !== y0 || z !== z0) { pos.setXYZ(i, x, y, z); moved++; }
  }
  pos.needsUpdate = true;
  return moved;
}

function tri3(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, f: number): number {
  const ax = pos.getX(f), ay = pos.getY(f), az = pos.getZ(f), bx = pos.getX(f + 1) - ax, by = pos.getY(f + 1) - ay, bz = pos.getZ(f + 1) - az, cx = pos.getX(f + 2) - ax, cy = pos.getY(f + 2) - ay, cz = pos.getZ(f + 2) - az;
  const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx; return 0.5 * Math.hypot(nx, ny, nz);
}
function tri2(uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, f: number): number {
  const ax = uv.getX(f), ay = uv.getY(f); const bx = uv.getX(f + 1) - ax, by = uv.getY(f + 1) - ay, cx = uv.getX(f + 2) - ax, cy = uv.getY(f + 2) - ay;
  return 0.5 * Math.abs(bx * cy - by * cx);
}

/** Largura do tronco na altura do peito (para relatórios): em cm. */
export function chestWidthCm(s: Spec): number { return torsoHalfWidth(s.torso, s.levels.chest) * 200; }

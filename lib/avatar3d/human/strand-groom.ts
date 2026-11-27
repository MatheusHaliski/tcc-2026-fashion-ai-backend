/*
 * Avatar 3D (RF40) — fios de cabelo: o penteado (HairGroom) crescido a partir das medidas da foto e a sua forma
 * serializável (JSON em mm).
 */
import * as THREE from "three";
import type { AvatarHair, FringeStyle } from "../model";
import type { HairTexture } from "../hair";
import { hairline, type HairBuild } from "./hair-geometry";
import type { StrandContext } from "./strand-context";
import { BABY_KIND, growStyledFringe } from "./strand-fringe";
import { add, cross, dot, len, lerp, mul, norm, rng, smooth, sub, type V3 } from "./strand-math";

/** Penteado: guias (polilinhas) no espaço do avatar. `start[g]..start[g+1]` são os pontos da guia g. */
export interface HairGroom {
  version: 1;
  texture: HairTexture;
  long: boolean;
  points: Float32Array;
  start: Uint32Array;
  /** 0 = guia comum, 1 = franja desfiada (medida), 2 = franja reta, 3 = lateral, 4 = cortina, 5 = linha do cabelo */
  kind: Uint8Array;
}

// ------------------------------------------------------------------ penteado (guias)

/** Guias do penteado a partir das medidas da foto (o que a biblioteca da fase 3 vai substituir/deformar). */
export function growGroom(ctx: StrandContext, hair: AvatarHair, base: HairBuild, opts: { density?: number; seed?: number } = {}): HairGroom | null {
  const { fr, shell, O, k, hv, texture, long, yBottom, inFace, onSkin, browY } = ctx;
  const rand = rng(opts.seed ?? 1337);
  const bpos = (base.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
  // raízes: triângulos da calota dentro da linha do cabelo, por área
  const bidx = base.geometry.getIndex()!.array; const bcol = (base.geometry.getAttribute("color") as THREE.BufferAttribute).array as Float32Array;
  const tris: { a: number; b: number; c: number; area: number }[] = []; let total = 0;
  for (let t = 0; t < base.calotaIndex!; t += 3) {
    const i0 = bidx[t], i1 = bidx[t + 1], i2 = bidx[t + 2];
    if ((bcol[i0 * 4 + 3] + bcol[i1 * 4 + 3] + bcol[i2 * 4 + 3]) / 3 < 0.6) continue;
    const p0: V3 = [bpos[i0 * 3], bpos[i0 * 3 + 1], bpos[i0 * 3 + 2]], p1: V3 = [bpos[i1 * 3], bpos[i1 * 3 + 1], bpos[i1 * 3 + 2]], p2: V3 = [bpos[i2 * 3], bpos[i2 * 3 + 1], bpos[i2 * 3 + 2]];
    const area = len(cross(sub(p1, p0), sub(p2, p0))) / 2; if (!area) continue;
    tris.push({ a: i0, b: i1, c: i2, area }); total += area;
  }
  if (!tris.length) return null;
  const cum = new Float64Array(tris.length); let acc = 0; tris.forEach((t, i) => { acc += t.area; cum[i] = acc; });
  const P = (i: number): V3 => [bpos[i * 3], bpos[i * 3 + 1], bpos[i * 3 + 2]];
  const pick = () => { const x = rand() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return tris[lo]; };

  const density = Math.min(1.5, Math.max(0.2, opts.density ?? 1));
  const guides = Math.round((long ? 620 : 820) * density);
  // a risca medida na foto (hair-flow.ts, AvatarHair.part: −1…1 da meia-largura do rosto); sem medida: lateral no curto
  const partRel = typeof hair.part === "number" ? Math.max(-1, Math.min(1, hair.part)) : long ? 0 : 0.36;
  const partX = fr.cx + partRel * fr.halfW;
  const fringe = Math.min(1, hair.fringe ?? 0);
  // franja escolhida (reta/lateral/cortina) cresce à parte, depois do resto; a desfiada é a franja medida de antes
  const fstyle: FringeStyle = hair.fringeStyle ?? (fringe > 0.3 ? "wispy" : "none");
  const topExtra = Math.max(0, ((hair.top ?? 14) - 14) * k);                     // topete: fios do alto mais compridos
  // rosto livre (ctx.inFace): a mecha que chegaria à frente do rosto é desviada para o lado da risca e para trás,
  // emoldurando o rosto (como o cabelo de verdade, preso atrás da orelha ou de lado)
  const G: V3 = [0, -1, 0];
  const pts: number[] = [], start: number[] = [0], kind: number[] = [];
  for (let g = 0; g < guides; g++) {
    const t0 = pick(); let u = rand(), v = rand(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const A = P(t0.a), B = P(t0.b), Cc = P(t0.c);
    const root = add(A, add(mul(sub(B, A), u), mul(sub(Cc, A), v)));
    let n = norm(cross(sub(B, A), sub(Cc, A))); if (dot(n, sub(root, O)) < 0) n = mul(n, -1);
    const ny = n[1]; const phi = Math.atan2(root[0] - fr.cx, root[2] - fr.cz); const front = Math.abs(phi) < 0.75;
    const side = root[0] - partX >= 0 ? 1 : -1;
    // direção do penteado (projetada no plano do couro cabeludo)
    let want: V3;
    const bangs = fstyle === "wispy" && fringe > 0.3 && front && root[1] > fr.toY(8) && ny > 0.2;
    if (bangs) want = [side * 0.35, -0.35, 1];
    else {
      // Campo de penteado contínuo: a troca abrupta na normal/ângulo da raiz formava fileiras de mechas.
      const face = 1 - smooth(0.45, 1.1, Math.abs(phi)), crown = smooth(0.12, 0.65, ny);
      const top: V3 = long ? [side, -0.5, -0.25] : [side * lerp(0.9, 0.45, face), lerp(-0.25, 0.05, face), lerp(-0.55, -1, face)];
      const edge: V3 = long ? [side * 0.9 * face, lerp(-1, -0.3, face), lerp(-0.15, -0.45, face)] : [side * 0.45 * face, lerp(-1, 0.15, face), lerp(-0.15, -1, face)];
      want = add(mul(edge, 1 - crown), mul(top, crown));
    }
    let tan = norm(sub(want, mul(n, dot(want, n)))); if (!len(tan)) tan = norm(sub(G, mul(n, dot(G, n))));
    // comprimento
    const crown = smooth(fr.earY, fr.headTop, root[1]);
    let L: number;
    if (bangs) L = Math.max(0.03, root[1] - fr.toY(5.6) + 0.02);
    else if (long) L = Math.max(0.08, (root[1] - yBottom) * 1.25 + 0.04);
    else L = (root[1] < fr.earY ? lerp(0.012, 0.026, smooth(fr.chinY, fr.earY, root[1]))          // nuca batida
      : lerp(0.026, 0.07, crown) + topExtra * crown) * (texture === "coily" ? 0.7 : 1);
    const S = long ? 18 : bangs ? 7 : 6; const step = L / S;
    // curto liso/ondulado deita para trás (antes subia como gel); o crespo mantém o volume para cima
    const coily = texture === "coily";
    // volume medido (hv) vira folga junto da cabeça (hug), não fio espetado: liso/ondulado longo cai rente e solto
    const lift = (long ? 0.1 : coily ? 0.4 : 0.18) * hv; const grav = long ? 0.42 : bangs ? 0.25 : coily ? 0.06 : 0.2;
    const slack = coily ? 0.02 * hv : (long ? 0.0035 : 0.006) * hv;
    const line: V3[] = [root]; let dir = norm(add(tan, mul(n, lift))); let p = root;
    const offAt = (t: number) => 0.0012 + (long ? 0.004 : 0.0045) * (hv - 0.6) * (long ? smooth(0, 0.15, t) * (1 - 0.6 * t) : 1 - t);
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      dir = norm(add(dir, mul(G, grav * (0.5 + t))));
      let q = add(p, mul(dir, step)); q = shell.push(q, offAt(t));
      if (q[1] > fr.earY - 0.01) q = shell.hug(q, offAt(t), slack);                // no crânio, acompanha a cabeça
      if (bangs && q[1] < browY + 0.003) break;                                    // franja para na sobrancelha
      if (!bangs && inFace(q)) {
        const s = q[0] >= partX ? 1 : -1;
        for (let tries = 0; tries < 4 && inFace(q); tries++) { dir = norm(add(dir, [s * 1.4, 0.15, -0.8])); q = shell.push(add(p, mul(dir, step)), offAt(t)); }
        if (inFace(q)) break;
      }
      // têmpora/bochecha: a mecha que desceria colada na pele vai para trás da orelha; se não sair, termina ali
      if (!bangs && onSkin(q)) {
        for (let tries = 0; tries < 3 && onSkin(q); tries++) { dir = norm(add(add(dir, mul(norm(sub(q, O)), 0.5)), [0, 0, -0.9])); q = shell.push(add(p, mul(dir, step)), offAt(t)); }
        if (onSkin(q)) break;
      }
      if (long && q[1] < yBottom + (1 - smooth(1.4, Math.PI, Math.abs(phi))) * 0.04) { line.push(q); break; }
      dir = norm(sub(q, p)); p = q; line.push(q);
    }
    if (line.length < 3) continue;
    for (const q of line) pts.push(q[0], q[1], q[2]);
    start.push(pts.length / 3); kind.push(bangs ? 1 : 0);
  }
  // linha do cabelo: fios curtos e finos nascendo na borda da base, penteados para trás/para cima por cima dela — a
  // transição pele→cabelo vira fio, não a borda serrilhada da base (onde há franja reta/cortina, ela cobre a frente)
  const covered = (phi: number) => (fstyle === "blunt" || fstyle === "curtain") && Math.abs(phi) < 0.6;
  for (let i = 0; i < 300; i++) {
    const phi = (rand() * 2 - 1) * 1.2; if (covered(phi)) continue;
    // nasce já na superfície da base (que tem a espessura do cabelo), não na pele: deita sobre a borda
    const hl = hairline(fr, hair, phi, false); const sk = shell.skinAt(phi, hl + 0.001 + rand() * 0.005); if (!sk) continue;
    const root = shell.push(sk, 0.0008);
    const out = norm(sub(root, O)); const sideDir: V3 = [Math.sign(phi) * 0.5, 0, 0];
    const comb = norm(add(add([0, 0.75, -0.65], sideDir), mul(out, -dot(add([0, 0.75, -0.65], sideDir), out))));
    const L = 0.01 + rand() * 0.012; const S = 4; const line: V3[] = [root]; let p = root;
    for (let k2 = 1; k2 <= S; k2++) { let q = shell.push(add(p, mul(comb, L / S)), 0.0012); q = shell.hug(q, 0.0012, 0.0015); line.push(q); p = q; }
    for (const q of line) pts.push(q[0], q[1], q[2]); start.push(pts.length / 3); kind.push(BABY_KIND);
  }
  if (fstyle === "blunt" || fstyle === "side" || fstyle === "curtain") {
    const fg = growStyledFringe(ctx, fstyle, tris.map((t) => [P(t.a), P(t.b), P(t.c)] as [V3, V3, V3]), rand);
    for (const g of fg.lines) { for (const q of g) pts.push(q[0], q[1], q[2]); start.push(pts.length / 3); kind.push(fg.kind); }
  }
  if (!kind.length) return null;
  return { version: 1, texture, long, points: Float32Array.from(pts), start: Uint32Array.from(start), kind: Uint8Array.from(kind) };
}

/** Penteado em JSON (biblioteca da fase 3, testes): coordenadas em mm inteiros. */
export function groomToJSON(g: HairGroom): { version: 1; texture: HairTexture; long: boolean; start: number[]; kind: number[]; mm: number[] } {
  return { version: 1, texture: g.texture, long: g.long, start: Array.from(g.start), kind: Array.from(g.kind), mm: Array.from(g.points, (v) => Math.round(v * 1000)) };
}

export function groomFromJSON(o: ReturnType<typeof groomToJSON>): HairGroom {
  if (o.version !== 1 || o.start.length !== o.kind.length + 1 || o.start[o.start.length - 1] * 3 !== o.mm.length) throw new Error("penteado inválido");
  return { version: 1, texture: o.texture, long: o.long, start: Uint32Array.from(o.start), kind: Uint8Array.from(o.kind), points: Float32Array.from(o.mm, (v) => v / 1000) };
}

/*
 * Avatar 3D (RF40) — fios de cabelo: as fitas de cada guia do penteado no nível de detalhe pedido (strandsFromGroom).
 */
import { HAIR_LODS, type HairLod } from "./hair-lod";
import type { StrandContext } from "./strand-context";
import type { HairGroom } from "./strand-groom";
import { BABY_KIND } from "./strand-fringe";
import { add, cross, dot, len, mul, norm, rng, smooth, sub, type V3 } from "./strand-math";

export interface StrandGeometry {
  position: Float32Array; normal: Float32Array; tangent: Float32Array; uv: Float32Array; color: Float32Array;
  skinIndex: Uint16Array; skinWeight: Float32Array; index: Uint32Array;
  ribbons: number; guides: number; stray: number; lod: HairLod; triangles: number;
}

const guidePoints = (g: HairGroom, i: number): V3[] => {
  const out: V3[] = []; for (let p = g.start[i]; p < g.start[i + 1]; p++) out.push([g.points[p * 3], g.points[p * 3 + 1], g.points[p * 3 + 2]]);
  return out;
};

/** Reamostra a polilinha em `n` pontos igualmente espaçados pelo comprimento (cards: menos pontos, mesma forma). */
function resample(pts: V3[], n: number): V3[] {
  if (pts.length === n || pts.length < 2) return pts;
  const arcs = [0]; for (let i = 1; i < pts.length; i++) arcs.push(arcs[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = arcs[arcs.length - 1] || 1; const out: V3[] = []; let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L; while (j < pts.length - 2 && arcs[j + 1] < s) j++;
    const t = (s - arcs[j]) / ((arcs[j + 1] - arcs[j]) || 1);
    out.push(add(pts[j], mul(sub(pts[j + 1], pts[j]), Math.min(1, Math.max(0, t)))));
  }
  return out;
}

// ------------------------------------------------------------------ fios (fitas)

/** Fitas do penteado no nível `lod` (0 fios, 1 fios leves, 2 cards). */
export function strandsFromGroom(ctx: StrandContext, groom: HairGroom, lod: 0 | 1 | 2 = 1, opts: { seed?: number } = {}): StrandGeometry | null {
  const spec = HAIR_LODS[lod]; const { fr, shell, texture, long, bones, shoulderY, inFace, onSkin } = ctx;
  const rand = rng((opts.seed ?? 1337) ^ 0x5f3759df);
  const cards = lod === 2; const curls = !cards && (texture === "curly" || texture === "coily");
  const basePer = texture === "coily" ? 4 : texture === "curly" ? 5 : long ? 6 : 4;
  const perGuide = cards ? 1 : basePer * spec.strandsPerGuide;
  const nGuides = groom.kind.length;
  // guias usadas no nível (subconjunto determinístico) e, nos cards, o teto de triângulos
  const use: number[] = [];
  const pickRand = rng(97);
  let tris = 0;
  for (let g = 0; g < nGuides; g++) {
    if (pickRand() > spec.guideFraction) continue;
    const kind = groom.kind[g]; if (cards && kind === BABY_KIND) continue;
    const segs = Math.min(spec.maxPoints, groom.start[g + 1] - groom.start[g]) - 1;
    const ribbons = kind >= 2 && kind !== BABY_KIND ? perGuide * 2 : kind === BABY_KIND ? 1 : perGuide;
    if (spec.maxTriangles && tris + segs * 2 * ribbons > spec.maxTriangles) break;
    tris += segs * 2 * ribbons; use.push(g);
  }
  const pos: number[] = [], nor: number[] = [], tng: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [], index: number[] = [];
  let ribbons = 0, stray = 0;
  for (const g of use) {
    const gp = guidePoints(groom, g);
    // cacho e crespo: a hélice precisa de ≥ 5 pontos por volta; os fios desses penteados ganham pontos (até 2×)
    const pts = resample(gp, curls ? Math.min(2 * spec.maxPoints - 1, 2 * gp.length - 1) : Math.min(spec.maxPoints, gp.length));
    const nS = pts.length; const T: V3[] = []; const N: V3[] = []; const Bv: V3[] = []; const arcs: number[] = [0];
    for (let i = 0; i < nS; i++) {
      const tt = norm(sub(pts[Math.min(nS - 1, i + 1)], pts[Math.max(0, i - 1)])); const out = shell.outward(pts[i]);
      let b = norm(cross(tt, out)); if (!len(b)) b = [1, 0, 0];
      T.push(tt); N.push(norm(cross(b, tt))); Bv.push(b); if (i) arcs.push(arcs[i - 1] + len(sub(pts[i], pts[i - 1])));
    }
    const total2 = arcs[nS - 1] || 1; const stepLen = total2 / Math.max(1, nS - 1);
    const phG = rand() * 6.28;                                                   // a mecha ondula/cacheia junta: fase por guia
    // franja escolhida: penteada (sem onda/cacho), mais densa e mais larga para cobrir a testa; a reta com as pontas
    // todas na linha de corte (sem afinar nem desfiar)
    const fk = groom.kind[g]; const baby = fk === BABY_KIND; const styled = fk >= 2 && !baby; const blunt = fk === 2;
    if (baby && cards) continue;                                                // nos cards (nível 2) a base basta
    const per = styled ? perGuide * 2 : baby ? 1 : perGuide;
    for (let r = 0; r < per; r++) {
      const isStray = !cards && !styled && rand() < spec.stray * (long ? 1 : 0.35);   // curto: quase sem fio solto (parecia espetado)
      const ob = cards ? 0 : (rand() - 0.5) * (styled ? 0.016 : 0.012), on = cards ? 0 : (rand() - 0.2) * (styled ? 0.0025 : 0.004);
      const lf = blunt ? 1 : styled ? 0.93 + rand() * 0.07 : isStray ? 0.95 + rand() * 0.15 : 0.78 + rand() * 0.26;
      const w0 = (0.0032 + rand() * 0.0028) * (texture === "coily" && !styled ? 1.4 : 1) * spec.width * (isStray ? 0.35 : 1) * (styled ? 1.3 : baby ? 0.45 : 1);
      const tone = 1 + (rand() * 2 - 1) * (0.05 + 0.09 * ctx.variation);    // tom por fio: ±5% … ±14% conforme a variação medida
      const ao = cards ? 0.92 : 0.74 + 0.26 * smooth(-0.0012, 0.0028, on);     // oclusão: o interior da mecha escurece
      // Todas as larguras/LODs usam uma coluna inteira. Cortar metade no nível alto ou atravessar três colunas
      // nos cards alterava a densidade e criava descontinuidades de brilho no meio de uma mesma mecha.
      const uSpan = 0.111;
      const colBand = Math.floor(rand() * 8) / 8; const ph = phG + (rand() - 0.5) * 0.35; const clump = styled ? 0.15 + rand() * 0.2 : 0.55 + rand() * 0.3;
      const frizzPhase = rand() * Math.PI * 2;
      const sDir: V3 = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]);       // fio solto: para onde ele escapa
      const base0 = pos.length / 3; const centers: V3[] = [], samples: { s: number; tw: number; w: number }[] = [];
      for (let i = 0; i < nS; i++) {
        const t = arcs[i] / total2; if (t > lf + 1e-6 && i > 1) break;
        const s = arcs[i];
        // Na raiz não há deslocamento para fora: o fio nasce na calota, depois ganha folga.
        let off = add(mul(Bv[i], ob * (1 - clump * t)), mul(N[i], on * smooth(0, 0.18, t) * (1 - t)));
        const fz = cards || styled ? 0 : Math.sin(frizzPhase + t * 5.2) * 0.00022 * t; off = add(off, mul(Bv[i], fz));
        if (isStray) off = add(off, add(mul(N[i], 0.006 * t ** 1.5), mul(sDir, 0.004 * t * t)));
        // ondulado; nos cards, cacho e crespo viram onda larga (a hélice não cabe em 7 pontos)
        if (styled || baby) { /* franja e linha do cabelo penteadas: sem onda nem cacho */ }
        else if (texture === "wavy" || (cards && texture !== "straight")) off = add(off, mul(Bv[i], Math.sin(s / Math.max(0.05, 4 * stepLen) * 6.283 + ph) * (texture === "wavy" ? 0.0045 : 0.006) * smooth(0, 0.04, s)));
        else if ((texture === "curly" || texture === "coily") && !cards) {
          const rr = texture === "coily" ? 0.0035 : 0.0065, lam = Math.max(texture === "coily" ? 0.012 : 0.03, 5 * stepLen); const th = s / lam * 6.283 + ph;
          off = add(off, mul(add(mul(Bv[i], Math.cos(th)), mul(N[i], Math.sin(th))), rr * smooth(0, 0.02, s)));
        }
        const center = shell.push(add(pts[i], off), 0.0008);
        // a onda/hélice não deita no rosto; a franja cai sobre a testa (pele) mas nunca na frente dos olhos; a franja
        // escolhida tem a própria linha de corte (growStyledFringe)
        if (i > 1 && (fk === 0 ? inFace(center) || onSkin(center) : fk === 1 || baby ? inFace(center) : false)) break;
        const tw = t / lf; const w = w0 * (1 - (blunt ? 0.15 : cards ? 0.45 : 0.72) * Math.min(1, tw));
        centers.push(center); samples.push({ s, tw, w });
      }
      let made = 0;
      for (let i = 0; i < centers.length; i++) {
        const center = centers[i]; const { s, tw, w } = samples[i];
        // A tangente pertence à fita depois de onda, frizz e colisão, e não à guia antes desses deslocamentos.
        const tangent = norm(sub(centers[Math.min(centers.length - 1, i + 1)], centers[Math.max(0, i - 1)]));
        const widthDir = norm(sub(Bv[i], mul(tangent, dot(Bv[i], tangent))));
        const normal = norm(cross(widthDir, tangent));
        // Cards largos também precisam deixar o rosto livre nas bordas, não só na linha central da guia.
        const vertices = [-1, 1].map((sgn) => shell.push(add(center, mul(widthDir, (sgn * w) / 2)), 0.0006));
        if (vertices.some((q) => fk === 0 ? inFace(q) || onSkin(q) : (fk === 1 || baby) && inFace(q))) break;
        for (let side = 0; side < vertices.length; side++) {
          const q = vertices[side];
          pos.push(q[0], q[1], q[2]); nor.push(normal[0], normal[1], normal[2]); tng.push(tangent[0], tangent[1], tangent[2], 1);
          uv.push(colBand + (side ? uSpan + 0.007 : 0.007), s / 0.12);
          // raiz mais escura, ponta mais clara (+6%), tom do fio e oclusão da mecha
          const shade = tone * ao * (0.6 + 0.4 * smooth(0, 0.3, tw)) * (1 + 0.06 * smooth(0.7, 1, tw));
          const tip = blunt ? 1 - 0.35 * smooth(0.95, 1, tw) : 1 - 0.9 * smooth(0.72, 1, tw);
          col.push(shade, shade, shade, (isStray ? 0.8 : 1) * (0.55 + 0.45 * smooth(0, 0.06, tw)) * tip);
          const wH = smooth(fr.chinY - 0.08, fr.chinY + 0.02, q[1]), wS = 1 - smooth(shoulderY - 0.06, shoulderY + 0.02, q[1]);
          si.push(bones.head, bones.neck, bones.spine2, 0); sw.push(wH, Math.max(0, 1 - wH - wS), wS, 0);
        }
        if (i) { const a0 = base0 + (i - 1) * 2; index.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
        made++;
      }
      if (made >= 2) { ribbons++; if (isStray) stray++; }
    }
  }
  if (!ribbons) return null;
  const w = Float32Array.from(sw); for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let j = 0; j < 4; j++) w[i + j] /= s0; }
  return {
    position: Float32Array.from(pos), normal: Float32Array.from(nor), tangent: Float32Array.from(tng), uv: Float32Array.from(uv), color: Float32Array.from(col),
    skinIndex: Uint16Array.from(si), skinWeight: w, index: Uint32Array.from(index), ribbons, guides: use.length, stray, lod, triangles: index.length / 3,
  };
}

/*
 * Avatar 3D (RF40) — fios de cabelo: tipos de guia (franja escolhida, linha do cabelo) e o crescimento da franja
 * reta/lateral/cortina cortada numa linha.
 */
import type { StrandContext } from "./strand-context";
import { add, cross, dot, len, lerp, mul, norm, smooth, sub, type V3 } from "./strand-math";

export const FRINGE_KIND: Record<"blunt" | "side" | "curtain", number> = { blunt: 2, side: 3, curtain: 4 };
/** guias curtas da linha do cabelo (por cima da borda da base) */
export const BABY_KIND = 5;

/**
 * Franja escolhida: raízes numa faixa do alto da frente (até ~6 cm atrás da linha do cabelo), penteadas para a frente
 * e caindo sobre a testa, por fora da pele (colisão), cortadas numa linha:
 *  - reta: horizontal, na sobrancelha, e espelhada no eixo do rosto (simetria perfeita: cada guia tem o seu par);
 *  - lateral: varrida para um lado, corte em diagonal (curta do lado da risca, longa na têmpora do outro lado);
 *  - cortina: aberta ao meio, cada metade abre para o seu lado; curta no centro e mais longa nas laterais, por fora do
 *    rosto (nunca na frente dos olhos), também espelhada.
 * As pontas param exatamente na linha de corte (interpolação no último passo).
 */
export function growStyledFringe(ctx: StrandContext, style: "blunt" | "side" | "curtain", scalp: [V3, V3, V3][], rand: () => number): { lines: V3[][]; kind: number } {
  const { fr, shell, O, hv, inFace, browY } = ctx; const G: V3 = [0, -1, 0];
  const mirror = style !== "side"; const sweep = -1;                         // lateral: risca do lado +x, varre para −x
  const u = (x: number) => (x - fr.cx) / fr.halfW;
  const cutY = (x: number): number => {
    const a = u(x);
    if (style === "blunt") return browY + 0.004;
    if (style === "side") { const c = lerp(browY + 0.03, fr.toY(3.2), smooth(-0.8, 1.0, a * sweep)); return Math.abs(a) < 0.8 ? Math.max(c, browY + 0.003) : c; }
    const c = lerp(browY + 0.016, fr.toY(2.4), smooth(0.15, 0.95, Math.abs(a)));
    return Math.abs(a) < 0.8 ? Math.max(c, browY + 0.002) : c;                // abaixo da sobrancelha, só por fora do rosto
  };
  // faixa das raízes: frente da calota, do ângulo mais baixo da linha do cabelo até ~0,6 rad acima dela
  const elev = (q: V3) => Math.atan2(q[1] - O[1], q[2] - O[2]);
  const phiMax = style === "side" ? 0.78 : 0.62;
  const front = scalp.filter(([a, b, c]) => { const m = mul(add(add(a, b), c), 1 / 3); return Math.abs(Math.atan2(m[0] - fr.cx, m[2] - fr.cz)) < phiMax; });
  if (!front.length) return { lines: [], kind: FRINGE_KIND[style] };
  let e0 = Infinity; for (const [a, b, c] of front) { const m = mul(add(add(a, b), c), 1 / 3); e0 = Math.min(e0, elev(m)); }
  const band = front.filter(([a, b, c]) => { const e = elev(mul(add(add(a, b), c), 1 / 3)); return e >= e0 - 0.01 && e <= e0 + 0.62; });
  const areas = band.map(([a, b, c]) => len(cross(sub(b, a), sub(c, a))) / 2); const tot = areas.reduce((x, y) => x + y, 0) || 1;
  const n0 = style === "blunt" ? 190 : style === "curtain" ? 130 : 260;
  const lines: V3[][] = [];
  for (let g = 0, tries = 0; g < n0 && tries < n0 * 8; tries++) {
    let x = rand() * tot, k = 0; while (k < areas.length - 1 && x > areas[k]) { x -= areas[k]; k++; }
    const [A, B, C] = band[k]; let s1 = rand(), s2 = rand(); if (s1 + s2 > 1) { s1 = 1 - s1; s2 = 1 - s2; }
    const root = add(A, add(mul(sub(B, A), s1), mul(sub(C, A), s2)));
    if (mirror && root[0] < fr.cx) continue;                                  // metade +x; a outra é o espelho
    let n = norm(cross(sub(B, A), sub(C, A))); if (dot(n, sub(root, O)) < 0) n = mul(n, -1);
    const a = u(root[0]); const side = mirror ? 1 : sweep;
    // cortina: cai para a frente e vai abrindo para o lado a cada passo (arco em volta do rosto)
    const want: V3 = style === "blunt" ? [a * 0.22, -0.12, 1] : style === "side" ? [side * 1.1, -0.2, 0.8] : [0.05 + a * 0.3, -0.3, 1];
    let dir = norm(add(norm(sub(want, mul(n, dot(want, n)))), mul(n, 0.1 * hv)));
    const L = Math.max(0.05, (root[1] - fr.toY(2)) * 1.6 + 0.03); const S = 14; const step = L / S;
    const line: V3[] = [root]; let p = root; let done = false;
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      dir = norm(add(dir, mul(G, 0.3 * (0.4 + t))));
      if (style === "curtain") dir = norm(add(dir, [(0.02 + 0.22 * t * t) * (Math.sign(p[0] - fr.cx) || 1), 0, 0]));
      const off = (t2: number) => 0.0021 + 0.0016 * (1 - t2);
      let q = shell.push(add(p, mul(dir, step)), off(t));
      // chegou na linha de corte: termina exatamente nela (antes do desvio do rosto, que começa 8 mm acima da sobrancelha)
      const c0 = cutY(q[0]);
      if (q[1] <= c0) { const f = (p[1] - c0) / ((p[1] - q[1]) || 1); line.push(add(p, mul(sub(q, p), Math.max(0, Math.min(1, f))))); done = true; break; }
      // lateral e cortina: abaixo da sobrancelha só por fora do rosto (abre para o lado, como o cabelo de verdade)
      // (a margem de 8 mm do inFace vale para o cabelo comum; a franja pode descer até a própria linha de corte)
      const eyes = (x: V3) => inFace(x) && x[1] < browY - 0.002;
      if (style !== "blunt" && eyes(q)) {
        const sx = Math.sign(q[0] - fr.cx) || side;
        for (let k2 = 0; k2 < 4 && eyes(q); k2++) { dir = norm(add(dir, [sx * 1.3, 0.12, -0.35])); q = shell.push(add(p, mul(dir, step)), off(t)); }
        if (eyes(q)) break;
      }
      const cy = cutY(q[0]);
      if (q[1] <= cy) { const f = (p[1] - cy) / ((p[1] - q[1]) || 1); line.push(add(p, mul(sub(q, p), Math.max(0, Math.min(1, f))))); done = true; break; }
      dir = norm(sub(q, p)); p = q; line.push(q);
    }
    if (!done || line.length < 3) continue;
    lines.push(line); g++;
    if (mirror) lines.push(line.map((q) => [2 * fr.cx - q[0], q[1], q[2]] as V3));
  }
  return { lines, kind: FRINGE_KIND[style] };
}

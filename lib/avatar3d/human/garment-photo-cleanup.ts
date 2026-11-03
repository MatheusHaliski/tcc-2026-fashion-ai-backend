/*
 * Foto da peça — limpeza do raster antes de virar textura: recorte do fundo liso com borda suave (cutoutGarment),
 * buracos de oclusão preenchidos pelo tecido vizinho (fillInteriorHoles) e corte na barra do look inteiro (splitByHem).
 */
import type { GarmentRaster } from "./garment-photo";

export function cutoutGarment(raster: GarmentRaster): GarmentRaster | null {
  const { width: w, height: h, data } = raster;
  if (w < 8 || h < 8 || data.length !== w * h * 4) return null;
  let transparent = 0;
  for (let p = 3; p < data.length; p += 4) if (data[p] < 128) transparent++;
  if (transparent > w * h * 0.05) return raster;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((sum, p) => sum + data[p * 4 + c], 0) / 4);
  const distance = (p: number) => Math.hypot(...bg.map((v, c) => data[p * 4 + c] - v));
  if (corners.some((p) => distance(p) > 24)) return null;
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let count = 0, read = 0;
  const visit = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    if (data[p * 4 + 3] < 128 || distance(p) < 38) queue[count++] = p;
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  const result = new Uint8ClampedArray(data);
  while (read < count) {
    const p = queue[read++]; result[p * 4 + 3] = 0;
    const x = p % w, y = Math.floor(p / w);
    if (x > 0) visit(p - 1); if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w); if (y < h - 1) visit(p + w);
  }
  // borda do recorte: o pixel misto (tecido + fundo, o serrilhado da foto) projetado no molde virava uma linha clara ao
  // longo de costuras, bolsos e barra. O alfa sai da projeção da cor entre o fundo e o tecido vizinho (um pixel meio
  // denim, meio branco vira alfa 0,5) e a cor volta a ser a do tecido, sem a contaminação do fundo.
  const edge = new Uint8Array(w * h);
  const transparentAt = (q: number) => result[q * 4 + 3] === 0;
  for (let p = 0; p < w * h; p++) {
    if (transparentAt(p)) continue;
    const x = p % w, y = (p / w) | 0;
    if ((x > 0 && transparentAt(p - 1)) || (x < w - 1 && transparentAt(p + 1)) || (y > 0 && transparentAt(p - w)) || (y < h - 1 && transparentAt(p + w))) edge[p] = 1;
  }
  for (let p = 0; p < w * h; p++) {
    if (!edge[p]) continue;
    const x = p % w, y = (p / w) | 0;
    let inner = -1;
    for (const q of [p - 1, p + 1, p - w, p + w, p - w - 1, p - w + 1, p + w - 1, p + w + 1]) {
      const qx = q % w, qy = (q / w) | 0;
      if (q < 0 || q >= w * h || Math.abs(qx - x) > 1 || Math.abs(qy - y) > 1 || transparentAt(q) || edge[q]) continue;
      inner = q; break;
    }
    if (inner < 0) continue;
    let dot = 0, norm = 0;
    for (let c = 0; c < 3; c++) { const f = data[inner * 4 + c] - bg[c], v = data[p * 4 + c] - bg[c]; dot += f * v; norm += f * f; }
    if (norm < 1) continue;
    const a = Math.max(0, Math.min(1, dot / norm));
    if (a >= 0.97) continue;
    for (let c = 0; c < 3; c++) result[p * 4 + c] = Math.max(0, Math.min(255, Math.round(a > 0.05 ? bg[c] + (data[p * 4 + c] - bg[c]) / a : data[inner * 4 + c])));
    result[p * 4 + 3] = Math.round(result[p * 4 + 3] * a);
  }
  const coverage = 1 - count / (w * h);
  if (coverage < 0.04 || coverage > 0.9) return null;
  return { width: w, height: h, data: result };
}

/**
 * Buracos INTERNOS da foto recortada — o que a pessoa cobria (mão, braço, mecha de cabelo) sai transparente do filtro de
 * pessoa, e a foto de estúdio do servidor chega com os mesmos vazios. Projetados no molde, esses vazios viravam buracos
 * na roupa 3D (o corpo aparecia "dentro" da peça) ou manchas da cor lisa do tecido. Aqui cada pixel de buraco recebe a
 * cor do tecido vizinho (dilatação em ondas a partir da borda do buraco); a silhueta EXTERNA (transparente ligada à
 * borda da imagem) continua recortando. Buracos enormes (mais de 45% da peça) ficam como estão: não é um vazio de
 * oclusão, é a peça que não existe ali. Nada do desenho é inventado — é continuidade do tecido ao redor.
 */
export function fillInteriorHoles(raster: GarmentRaster): { filled: number; holes: number } {
  const { width: w, height: h, data } = raster; const n = w * h;
  if (w < 4 || h < 4 || data.length !== n * 4) return { filled: 0, holes: 0 };
  const clear = (p: number) => data[p * 4 + 3] < 128;
  // exterior: transparente ligado à borda
  const ext = new Uint8Array(n); const q = new Int32Array(n); let c = 0, r = 0;
  const push = (p: number) => { if (!ext[p] && clear(p)) { ext[p] = 1; q[c++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (r < c) { const p = q[r++]; const x = p % w; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < n - w) push(p + w); }
  let holes = 0, opaque = 0;
  const done = new Uint8Array(n);                                 // opaco ou já preenchido
  for (let p = 0; p < n; p++) { if (clear(p)) { if (!ext[p]) holes++; } else { done[p] = 1; opaque++; } }
  if (!holes || holes > (holes + opaque) * 0.45) return { filled: 0, holes };
  // frente de onda: buracos encostados em pixels prontos recebem a média deles; a onda seguinte usa os recém-preenchidos
  let wave: number[] = [];
  for (let p = 0; p < n; p++) {
    if (done[p] || ext[p]) continue; const x = p % w;
    if ((x > 0 && done[p - 1]) || (x < w - 1 && done[p + 1]) || (p >= w && done[p - w]) || (p < n - w && done[p + w])) wave.push(p);
  }
  let filled = 0; const seen = new Uint8Array(n); for (const p of wave) seen[p] = 1;
  while (wave.length) {
    const colors = new Map<number, [number, number, number]>();
    for (const p of wave) {
      const x = p % w; let rr = 0, gg = 0, bb = 0, k = 0;
      for (const u of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1]) if (u >= 0 && done[u]) { rr += data[u * 4]; gg += data[u * 4 + 1]; bb += data[u * 4 + 2]; k++; }
      if (k) colors.set(p, [rr / k, gg / k, bb / k]);
    }
    const next: number[] = [];
    for (const [p, col] of colors) {
      data[p * 4] = col[0]; data[p * 4 + 1] = col[1]; data[p * 4 + 2] = col[2]; data[p * 4 + 3] = 255; done[p] = 1; filled++;
      const x = p % w;
      for (const u of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1]) if (u >= 0 && !done[u] && !ext[u] && !seen[u]) { seen[u] = 1; next.push(u); }
    }
    wave = next;
  }
  return { filled, holes };
}

/**
 * Foto com mais de uma peça e sem esqueleto para separá-las (o recorte de estúdio do servidor traz o look inteiro —
 * blusa e calça — já sem a pessoa; ou a pessoa foi tirada mas a pose não foi lida): acha a BARRA pela mudança de cor
 * entre as linhas (mediana por linha dentro da peça) ou pelo vão entre as peças, e deixa só a parte pedida. Sem uma
 * mudança clara (peça única, vestido, conjunto da mesma estampa), a foto segue inteira — nada é cortado por palpite.
 */
export function splitByHem(raster: GarmentRaster, part: "upper" | "lower"): { hemRow: number | null } {
  const { width: w, height: h, data } = raster;
  if (data.length !== w * h * 4) return { hemRow: null };
  const rows: ({ rgb: [number, number, number]; cover: number } | null)[] = [];
  let y0 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const ch: number[][] = [[], [], []]; let on = 0;
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (data[o + 3] < 200) continue; on++; ch[0].push(data[o]); ch[1].push(data[o + 1]); ch[2].push(data[o + 2]); }
    if (on < 4) { rows.push(null); continue; }
    if (y0 < 0) y0 = y; y1 = y;
    rows.push({ rgb: ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]) as [number, number, number], cover: on });
  }
  const H = y1 - y0 + 1; if (y0 < 0 || H < 24) return { hemRow: null };
  // somas acumuladas: a comparação é de TUDO acima × TUDO abaixo do corte (uma estampa no peito não vira barra — a média
  // do que fica abaixo dela volta à cor do tecido), com a cobertura média de cada lado (vão / restos finos = barra)
  const acc: { r: number; g: number; b: number; cover: number; n: number }[] = [{ r: 0, g: 0, b: 0, cover: 0, n: 0 }];
  for (let y = 0; y < h; y++) { const a = acc[y], r = rows[y]; acc.push(r ? { r: a.r + r.rgb[0], g: a.g + r.rgb[1], b: a.b + r.rgb[2], cover: a.cover + r.cover, n: a.n + 1 } : { ...a }); }
  const seg = (a: number, b: number) => { const p = acc[a], q = acc[b]; const n = q.n - p.n; return n ? { rgb: [(q.r - p.r) / n, (q.g - p.g) / n, (q.b - p.b) / n], cover: (q.cover - p.cover) / n, n } : null; };
  let best = -1, bestY = -1;
  // da altura do busto até perto da barra: o cós/cinto da peça de baixo que sobrou fica nos últimos 8–20%
  for (let y = y0 + Math.round(H * 0.3); y <= y0 + Math.round(H * 0.94); y++) {
    const up = seg(y0, y), low = seg(y, y1 + 1);
    if (!up || !low || up.n < H * 0.15 || low.n < H * 0.04) continue;
    const dist = Math.hypot(up.rgb[0] - low.rgb[0], up.rgb[1] - low.rgb[1], up.rgb[2] - low.rgb[2]);
    // vão entre as peças ou restos finos (listras da outra peça que a cor não separou): cobertura cai para menos de 45%
    const gap = low.cover < up.cover * 0.45 || rows[y] === null ? 60 : 0;
    if (dist + gap < 38) continue;                                   // sem uma mudança clara, não há barra aqui
    // o lado que fica tem de ser uniforme perto do corte: uma gola ou pala de cor contrastante no alto de uma camisa
    // única fazia a "parte de cima" (gola + começo do corpo) parecer outra peça e decapitava a camisa
    const keep = part === "upper" ? seg(Math.max(y0, y - Math.round(H * 0.12)), y) : seg(y, Math.min(y1 + 1, y + Math.round(H * 0.12)));
    const whole = part === "upper" ? up : low;
    if (!keep || Math.hypot(keep.rgb[0] - whole.rgb[0], keep.rgb[1] - whole.rgb[1], keep.rgb[2] - whole.rgb[2]) > 28) continue;
    // entre as linhas que passam, fica a de corte mais nítido: contraste e queda de cobertura LOCAIS (linha a linha)
    const a = rows[y - 1], b = rows[y];
    const local = a && b ? Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]) * 0.5 + Math.max(0, 1 - b.cover / a.cover) * 60 : b ? 0 : 60;
    const score = dist + gap + local;
    if (score > best) { best = score; bestY = y; }
  }
  if (bestY < 0) return { hemRow: null };
  // o cós/cinto que sobrou logo acima da barra achada: linhas de outra cor que a do corpo da peça (mediana das linhas
  // do meio da parte mantida) ou bem mais estreitas que a peça sobem junto com o corte (para "lower", descem)
  let maxCover = 0; for (const r of rows) if (r) maxCover = Math.max(maxCover, r.cover);
  const bodyOf = (a: number, b: number): [number, number, number] | null => {
    const ch: number[][] = [[], [], []];
    for (let y = a; y < b; y++) { const r = rows[y]; if (!r) continue; ch[0].push(r.rgb[0]); ch[1].push(r.rgb[1]); ch[2].push(r.rgb[2]); }
    return ch[0].length < 4 ? null : (ch.map((v) => v.sort((p, q) => p - q)[v.length >> 1]) as [number, number, number]);
  };
  const leftover = (r: { rgb: [number, number, number]; cover: number }, body: [number, number, number] | null) =>
    (body ? Math.hypot(r.rgb[0] - body[0], r.rgb[1] - body[1], r.rgb[2] - body[2]) > 40 : false) || r.cover < maxCover * 0.35;
  if (part === "upper") {
    const body = bodyOf(y0 + Math.round(H * 0.3), Math.max(y0 + Math.round(H * 0.3) + 4, bestY - Math.round(H * 0.1)));
    while (bestY - 1 > y0 + H * 0.3) { const r = rows[bestY - 1]; if (r && leftover(r, body)) bestY--; else break; }
  } else {
    const body = bodyOf(Math.min(bestY + Math.round(H * 0.1), y1 - 4), y1 + 1);
    while (bestY + 1 < y1 - H * 0.1) { const r = rows[bestY]; if (r && leftover(r, body)) bestY++; else break; }
  }
  for (let y = part === "upper" ? bestY : y0; y < (part === "upper" ? h : bestY); y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = 0;
  return { hemRow: bestY };
}

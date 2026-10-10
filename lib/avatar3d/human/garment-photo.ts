/** Conservative cutout for product photos on a uniform backdrop. Complex photos
 * are rejected instead of projecting their background onto the avatar's clothes.
 * Transparent product cutouts retain their existing alpha and details.
 */
export interface GarmentRaster { width: number; height: number; data: Uint8ClampedArray }

/** A repeated textile sample, never the complete garment, label or background. */
export function fabricTile(raster: GarmentRaster): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h, data } = raster;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 240) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const size = Math.min(128, Math.floor((x1 - x0) * 0.28), Math.floor((y1 - y0) * 0.25));
  if (size < 24) return null;
  for (const fy of [0.56, 0.72]) for (const fx of [0.22, 0.6]) {
    const py = Math.round(y0 + (y1 - y0) * fy);
    // Flat-lay sleeves widen the global bounds. Sample the actual torso row,
    // otherwise every candidate straddles its transparent sides.
    let rowLeft = w, rowRight = -1;
    for (let x = 0; x < w; x++) if (data[(py * w + x) * 4 + 3] > 240) { rowLeft = Math.min(rowLeft, x); rowRight = x; }
    if (rowRight - rowLeft < size) continue;
    const px = Math.round(rowLeft + (rowRight - rowLeft - size) * fx);
    if (px + size > w || py + size > h) continue;
    const mean = [0, 0, 0]; let opaque = true;
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const k = ((py + y) * w + px + x) * 4;
      if (data[k + 3] < 240) opaque = false;
      for (let c = 0; c < 3; c++) mean[c] += data[k + c];
    }
    if (!opaque) continue;
    const samples = Math.ceil(size / 2) ** 2; for (let c = 0; c < 3; c++) mean[c] /= samples;
    let variance = 0;
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) for (let c = 0; c < 3; c++) {
      variance += (data[((py + y) * w + px + x) * 4 + c] - mean[c]) ** 2;
    }
    variance /= samples * 3;
    if (variance < 100) continue; // plain fabric: keep the measured color, don't repeat photographic shadows
    const period = (axis: 0 | 1) => {
      const errors: number[] = [];
      for (let lag = 3; lag <= Math.floor(size / 2) + 1; lag++) {
        let error = 0, n = 0;
        for (let y = 0; y < size - (axis === 1 ? lag : 0); y++) for (let x = 0; x < size - (axis === 0 ? lag : 0); x++) {
          const a = ((py + y) * w + px + x) * 4;
          const b = a + (axis === 0 ? lag * 4 : lag * w * 4);
          for (let c = 0; c < 3; c++) error += (data[a + c] - data[b + c]) ** 2;
          n += 3;
        }
        errors[lag] = error / n;
      }
      for (let lag = 4; lag <= Math.floor(size / 2); lag++) {
        if (errors[lag] < variance * 0.22 && errors[lag] + variance * 0.02 < Math.min(errors[lag - 1], errors[lag + 1])) return lag;
      }
      return null;
    };
    const width = period(0), height = period(1);
    if (width && height) return { x: px, y: py, width, height };
  }
  return null;
}

/**
 * Cor "mediana" de um conjunto de pixels como VETOR: a mediana canal a canal de um conjunto bimodal (metade azul, metade
 * laranja) inventa uma cor que não existe na foto (verde); aqui vale o pixel real mais perto das medianas por canal.
 */
export function medoid(px: ArrayLike<number>[]): [number, number, number] {
  const n = px.length; if (!n) return [0, 0, 0];
  const m = [0, 1, 2].map((i) => Array.from(px, (p) => p[i]).sort((a, b) => a - b)[n >> 1]);
  let best = 0, bd = Infinity;
  for (let k = 0; k < n; k++) { const d = (px[k][0] - m[0]) ** 2 + (px[k][1] - m[1]) ** 2 + (px[k][2] - m[2]) ** 2; if (d < bd) { bd = d; best = k; } }
  return [px[best][0], px[best][1], px[best][2]];
}

/** Robust wash/color at each fabric height, excluding the backdrop and the gap between trouser legs. */
export function fabricRows(raster: GarmentRaster, opts: { fromY?: number; toY?: number } = {}): { y: number; rgb: [number, number, number] }[] {
  const { width: w, height: h, data } = raster;
  const out: { y: number; rgb: [number, number, number] }[] = [];
  const step = Math.max(1, Math.floor(h / 64));
  // só o MIOLO de cada linha (metade central do que a linha tem de peça) e só entre a gola e a barra: os punhos nas
  // pontas e a gola em cima tingiam o painel do tecido (costas, laterais e mangas) com a cor dos acabamentos
  const y0 = Math.max(0, Math.floor(opts.fromY ?? 0)), y1 = Math.min(h, Math.ceil(opts.toY ?? h));
  for (let y = y0; y < y1; y += step) {
    let a = -1, b = -1;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 240) { if (a < 0) a = x; b = x; }
    if (a < 0) continue;
    const xa = Math.round(a + (b - a) * 0.25), xb = Math.round(a + (b - a) * 0.75);
    const channels: number[][] = [[], [], []];
    for (let x = xa; x <= xb; x += Math.max(1, Math.floor((xb - xa) / 80))) {
      const k = (y * w + x) * 4;
      if (data[k + 3] < 240) continue;
      for (let c = 0; c < 3; c++) channels[c].push(data[k + c]);
    }
    if (channels[0].length < 8) continue;
    out.push({ y, rgb: medoid(channels[0].map((_, k) => [channels[0][k], channels[1][k], channels[2][k]])) });
  }
  return out;
}

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

export function prepareGarmentPhoto(img: CanvasImageSource & { width: number; height: number }, opts: { keep?: "upper" | "lower" | null } = {}): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
    g.drawImage(img, 0, 0, c.width, c.height);
    const pixels = g.getImageData(0, 0, c.width, c.height);
    const cutout = cutoutGarment(pixels); if (!cutout) return null;
    if (opts.keep) splitByHem(cutout, opts.keep);                   // look inteiro sem esqueleto: fica só a parte pedida
    fillInteriorHoles(cutout);                                       // vazios de oclusão não viram buracos no molde
    pixels.data.set(cutout.data); g.putImageData(pixels, 0, 0);
    return c;
  } catch { return null; }
}

/** A foto reduzida (≤1024 px) como canvas, sem recorte — para o filtro de pessoa quando o fundo não é separável. */
function scaledCanvas(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement | null {
  try {
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d"); if (!g) return null; g.drawImage(img, 0, 0, c.width, c.height); return c;
  } catch { return null; }
}
/** A full-length catalog model cannot be used as an upper-garment texture. */
export function fullBodyUpperPhoto(raster: GarmentRaster): boolean {
  let x0 = raster.width, x1 = -1, y0 = raster.height, y1 = -1;
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    if (raster.data[(y * raster.width + x) * 4 + 3] < 240) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 > x0 && (y1 - y0) / (x1 - x0) > 2;
}

export type OutfitPhotoPart = "upper" | "lower" | "full" | "feet";

/** Only a verified, isolated garment can supply the photographic material. A
 * waist-up model is just as unsafe as a full-length model, regardless of aspect
 * ratio. Timeout, missing segmentation and missing pose use the measured fabric
 * color instead; they do not turn an unverified person into a clothing texture.
 */
export function canUseOutfitPhoto(result: import("@/lib/pieces/person-filter").PersonFilterResult, part: OutfitPhotoPart): boolean {
  if (!result.segmentationAvailable || result.people > 1) return false;
  if (!result.personFound) return result.people === 0;
  // pessoa tirada pela segmentação mas sem esqueleto para separar as peças: a foto segue e a barra é achada pela cor
  // (splitByHem) — a pessoa já não está na foto, só o(s) tecido(s)
  if (!result.garments) return part === "upper" || part === "lower";
  // With an explicit part, ‘ambiguous’ means both upper and lower garments exist,
  // not that the requested garment was left unfiltered.
  return result.garments.kept === part && (part !== "full" || !result.garments.ambiguous);
}

const outfitPhotoCache = new WeakMap<object, Map<OutfitPhotoPart, Promise<HTMLCanvasElement | null>>>();
export function prepareOutfitPhoto(img: CanvasImageSource & { width: number; height: number }, part: OutfitPhotoPart): Promise<HTMLCanvasElement | null> {
  let cache = outfitPhotoCache.get(img);
  if (!cache) { cache = new Map(); outfitPhotoCache.set(img, cache); }
  const hit = cache.get(part); if (hit) return hit;
  const task = (async () => {
    // fundo separável (recorte com alfa, estúdio liso): recorta aqui. Fundo de estúdio com molduras e sombras (foto de
    // catálogo com modelo): não dá para recortar pelos cantos — a foto segue inteira para o filtro de pessoa, que
    // separa pessoa e cenário pela segmentação; sem pessoa, não há o que aproveitar
    const cutout = prepareGarmentPhoto(img);
    const source = cutout ?? scaledCanvas(img);
    if (!source) return null;
    const hemPart = part === "upper" || part === "lower" ? part : null;
    const attempt = async (): Promise<HTMLCanvasElement | null | "timeout"> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            const { stripPerson } = await import("@/lib/pieces/person-filter");
            const blob = await new Promise<Blob | null>((resolve) => source.toBlob(resolve, "image/png"));
            if (!blob) return null;
            const result = await stripPerson(new File([blob], "catalog.png", { type: "image/png" }), { keep: part });
            if (!canUseOutfitPhoto(result, part)) return null;
            // sem pessoa: só o recorte serve (a foto crua com cenário não vira textura); look inteiro → barra pela cor
            if (!result.personFound) return cutout ? prepareGarmentPhoto(cutout, { keep: hemPart }) : null;
            const { loadOriented } = await import("@/lib/avatar3d/pipeline");
            // com esqueleto o filtro já deixou só a parte pedida (a barra pela cor/cobertura só tira restos finos da
            // outra peça, p.ex. a saia da mesma estampa); sem esqueleto, é ela que separa as peças
            return prepareGarmentPhoto(await loadOriented(result.file, 1024), { keep: hemPart });
          })(),
          new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), 45000); }),
        ]);
      } catch { return null; } finally { if (timer) clearTimeout(timer); }
    };
    // a primeira foto da sessão paga o carregamento do segmentador: um timeout vale uma segunda tentativa
    let out = await attempt(); if (out === "timeout") out = await attempt();
    return out === "timeout" ? null : out;
  })();
  cache.set(part, task); return task;
}

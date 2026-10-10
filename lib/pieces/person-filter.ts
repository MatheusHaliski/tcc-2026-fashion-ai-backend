import { loadOriented } from "@/lib/avatar3d/pipeline";
import { detectBody } from "@/lib/avatar3d/body-detect";
import { P, type PosePoint } from "@/lib/avatar3d/body";

/**
 * RF4 · pipeline da foto da peça, etapa "remoção de pessoa e cenário" (no navegador, antes do envio): a segmentação
 * multiclasse (cabelo, pele do corpo, pele do rosto × roupa × acessórios) já usada no avatar 3D tira o corpo humano da
 * foto — nada sai do aparelho. O que era pessoa vira TRANSPARENTE (não branco): assim o recorte do servidor não herda
 * manchas brancas de mão, pescoço ou rosto, e o que a pessoa cobria fica como buraco — nada é inventado. Com uma
 * pessoa na foto, o cenário (classe "fundo" da segmentação: parede, piso, móveis) também sai aqui, onde a segmentação
 * enxerga o corpo inteiro; o recorte do servidor só refina.
 *
 * Com o esqueleto (pose) da pessoa, a foto também é dividida em peça de cima × peça de baixo: quem fotografa a
 * camiseta vestida leva junto o jeans e o tênis. `keep` escolhe a peça (o padrão é a que ocupa mais área); a outra
 * roupa e os acessórios saem. Na faixa em que as duas se encontram (barra da camiseta sobre o cós), cada pixel vai para
 * a peça de cor mais parecida. Fotos sem pessoa passam intactas; a peça segue para o estúdio.
 */
export type GarmentPart = "upper" | "lower" | "full" | "feet";
export interface PersonFilterResult {
  file: File; personFound: boolean; removedPct: number; people: number; ms: number;
  /** False means absence of people was not verified, rather than a clean product photograph. */
  segmentationAvailable: boolean;
  /** partes com roupa na foto (fração da roupa em cada zona) e a parte mantida */
  garments?: { upper: number; lower: number; kept: GarmentPart; ambiguous: boolean } | null;
}

const PERSON = new Set([1, 2, 3]); // 1 cabelo · 2 pele do corpo · 3 pele do rosto
const CLOTHES = 4, OTHERS = 5;      // 4 roupa · 5 acessórios (bolsa, óculos, chapéu)
const MIN_FRACTION = 0.012; // abaixo disto é ruído da segmentação, não uma pessoa

type Zones = { shoulder: number; hip: number; torso: number; ankle: number };
function zones(pose: PosePoint[] | null): Zones | null {
  if (!pose) return null;
  const ok = (i: number) => (pose[i]?.visibility ?? 1) > 0.4;
  if (!ok(P.shL) || !ok(P.shR) || !ok(P.hipL) || !ok(P.hipR)) return null;
  const shoulder = (pose[P.shL].y + pose[P.shR].y) / 2, hip = (pose[P.hipL].y + pose[P.hipR].y) / 2;
  const torso = hip - shoulder;
  if (torso <= 0.02) return null;
  const ankles = [P.ankL, P.ankR].filter((i) => ok(i)).map((i) => pose[i].y);
  return { shoulder, hip, torso, ankle: ankles.length ? Math.max(...ankles) : 1.2 };
}

export async function stripPerson(file: File, opts: { keep?: GarmentPart } = {}): Promise<PersonFilterResult> {
  const t0 = performance.now();
  const img = await loadOriented(file, 1600);
  const det = await detectBody(img);
  const mask = det.mask;
  const done = (f: File, found: boolean, pct: number, garments: PersonFilterResult["garments"] = null) => ({ file: f, personFound: found, removedPct: pct, people: det.people, ms: Math.round(performance.now() - t0), segmentationAvailable: !!mask, garments });
  if (!mask) return done(file, false, 0);
  const { width: mw, height: mh, data } = mask;
  let person = 0;
  const flag = new Uint8Array(mw * mh);
  for (let i = 0; i < data.length; i++) if (PERSON.has(data[i])) { flag[i] = 1; person++; }
  if (person / (mw * mh) < MIN_FRACTION && det.people === 0) return done(file, false, 0);
  // 1 px de folga (na resolução da máscara) em volta da pele, para não sobrar um fio de pele na borda da roupa
  const skin = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const i = y * mw + x;
    skin[i] = flag[i] || (x > 0 && flag[i - 1]) || (x < mw - 1 && flag[i + 1]) || (y > 0 && flag[i - mw]) || (y < mh - 1 && flag[i + mw]) ? 1 : 0;
  }

  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height); const px = id.data;
  const idx = (x: number, y: number) => Math.min(mh - 1, Math.floor((y * mh) / c.height)) * mw + Math.min(mw - 1, Math.floor((x * mw) / c.width));
  const at = (x: number, y: number) => data[idx(x, y)];

  // peça de cima × de baixo pelo esqueleto: fora da faixa de encontro, a altura decide; dentro dela, a cor
  const z = zones(det.pose);
  let garments: PersonFilterResult["garments"] = null;
  let keep: GarmentPart = "full";
  let bandTop = 0, bandBottom = 0; let upperMean = [0, 0, 0], lowerMean = [0, 0, 0];
  if (z) {
    bandTop = z.hip - z.torso * 0.35; bandBottom = z.hip + z.torso * 0.25;
    let up = 0, low = 0, total = 0; const su = [0, 0, 0], sl = [0, 0, 0]; let nu = 0, nl = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (at(x, y) !== CLOTHES) continue;
      const v = y / c.height; total++;
      const o = (y * c.width + x) * 4;
      if (v < bandTop) { up++; if (v > z.shoulder + z.torso * 0.15 && v < z.hip - z.torso * 0.45) { su[0] += px[o]; su[1] += px[o + 1]; su[2] += px[o + 2]; nu++; } }
      else if (v > bandBottom && v < z.ankle - z.torso * 0.1) { low++; if (v < z.hip + z.torso * 0.9) { sl[0] += px[o]; sl[1] += px[o + 1]; sl[2] += px[o + 2]; nl++; } }
    }
    upperMean = nu ? su.map((s) => s / nu) : upperMean; lowerMean = nl ? sl.map((s) => s / nl) : lowerMean;
    const upper = total ? up / total : 0, lower = total ? low / total : 0;
    const ambiguous = upper > 0.15 && lower > 0.15;
    keep = opts.keep ?? (ambiguous ? (upper >= lower ? "upper" : "lower") : "full");
    garments = { upper: Math.round(upper * 100) / 100, lower: Math.round(lower * 100) / 100, kept: keep, ambiguous };
  }
  // decisão na resolução da máscara (cor amostrada no pixel correspondente da foto): fica só a peça — pessoa, cenário
  // (classe "fundo"), a outra roupa e os acessórios saem; a borda vem suave pela interpolação da decisão
  const d2 = (o: number, m: number[]) => (px[o] - m[0]) ** 2 + (px[o + 1] - m[1]) ** 2 + (px[o + 2] - m[2]) ** 2;
  const keepMask = new Float32Array(mw * mh);
  for (let my = 0; my < mh; my++) {
    const v = (my + 0.5) / mh; const y = Math.min(c.height - 1, Math.floor(v * c.height));
    for (let mx = 0; mx < mw; mx++) {
      const m = my * mw + mx; const k = data[m];
      const o = (y * c.width + Math.min(c.width - 1, Math.floor(((mx + 0.5) / mw) * c.width))) * 4;
      let out = skin[m] === 1 || k === 0;
      if (!out && z && keep !== "full" && (k === CLOTHES || k === OTHERS)) {
        if (k === OTHERS) out = true;
        else if (keep === "feet") out = v < z.ankle - z.torso * 0.3;
        else if (keep === "upper") out = v > bandBottom || (v >= bandTop && d2(o, lowerMean) < d2(o, upperMean));
        else out = v < bandTop || v > z.ankle - z.torso * 0.05 || (v <= bandBottom && d2(o, upperMean) < d2(o, lowerMean));
      }
      keepMask[m] = out ? 0 : 1;
    }
  }
  let removed = 0;
  for (let y = 0; y < c.height; y++) {
    const fy = Math.max(0, Math.min(mh - 1.001, ((y + 0.5) * mh) / c.height - 0.5)); const y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < c.width; x++) {
      const fx = Math.max(0, Math.min(mw - 1.001, ((x + 0.5) * mw) / c.width - 0.5)); const x0 = Math.floor(fx), tx = fx - x0;
      const i = y0 * mw + x0;
      const a = (keepMask[i] * (1 - tx) + keepMask[i + 1] * tx) * (1 - ty) + (keepMask[i + mw] * (1 - tx) + keepMask[i + mw + 1] * tx) * ty;
      const o = (y * c.width + x) * 4;
      // limiar suave: meio-tom só na faixa de transição, para a borda não ficar serrilhada nem com halo do fundo
      const alpha = Math.max(0, Math.min(1, (a - 0.35) / 0.3));
      if (alpha < 1) { px[o + 3] = Math.round(px[o + 3] * alpha); if (alpha === 0) removed++; }
    }
  }
  g.putImageData(id, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
  const name = file.name.replace(/\.[^.]+$/, "") + ".png";
  return done(new File([blob], name, { type: "image/png" }), true, Math.round((removed / (c.width * c.height)) * 100), garments);
}

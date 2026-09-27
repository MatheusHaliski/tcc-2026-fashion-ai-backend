import { loadOriented } from "@/lib/avatar3d/pipeline";
import { detectBody } from "@/lib/avatar3d/body-detect";

/**
 * RF4 · pipeline da foto da peça, etapa 0 (no navegador, antes do envio): detecta corpo humano na foto e o exclui,
 * deixando só a roupa. Usa a segmentação multiclasse (cabelo, pele do corpo, pele do rosto × roupa) já usada no avatar
 * 3D — nada sai do aparelho. Fotos sem pessoa passam intactas; a peça segue para o estúdio (fundo, luz, enquadramento).
 */
export interface PersonFilterResult { file: File; personFound: boolean; removedPct: number; people: number; ms: number }

const PERSON = new Set([1, 2, 3]); // 1 cabelo · 2 pele do corpo · 3 pele do rosto (4 = roupa, 5 = outros ficam)
const MIN_FRACTION = 0.012; // abaixo disto é ruído da segmentação, não uma pessoa

export async function stripPerson(file: File): Promise<PersonFilterResult> {
  const t0 = performance.now();
  const img = await loadOriented(file, 1600);
  const det = await detectBody(img);
  const mask = det.mask;
  const done = (f: File, found: boolean, pct: number) => ({ file: f, personFound: found, removedPct: pct, people: det.people, ms: Math.round(performance.now() - t0) });
  if (!mask) return done(file, false, 0);
  const { width: mw, height: mh, data } = mask;
  let person = 0;
  const flag = new Uint8Array(mw * mh);
  for (let i = 0; i < data.length; i++) if (PERSON.has(data[i])) { flag[i] = 1; person++; }
  const fraction = person / (mw * mh);
  if (fraction < MIN_FRACTION && det.people === 0) return done(file, false, 0);
  // dilatação de 1 px (na resolução da máscara) para não deixar um fio de pele na borda da roupa
  const grown = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const i = y * mw + x;
    if (flag[i]) { grown[i] = 1; continue; }
    if ((x > 0 && flag[i - 1]) || (x < mw - 1 && flag[i + 1]) || (y > 0 && flag[i - mw]) || (y < mh - 1 && flag[i + mw])) grown[i] = 1;
  }
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height); const px = id.data;
  let removed = 0;
  for (let y = 0; y < c.height; y++) {
    const my = Math.min(mh - 1, Math.floor((y * mh) / c.height));
    for (let x = 0; x < c.width; x++) {
      const mx = Math.min(mw - 1, Math.floor((x * mw) / c.width));
      if (!grown[my * mw + mx]) continue;
      const o = (y * c.width + x) * 4; px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = 255; removed++;
    }
  }
  g.putImageData(id, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.92));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return done(new File([blob], name, { type: "image/jpeg" }), true, Math.round((removed / (c.width * c.height)) * 100));
}

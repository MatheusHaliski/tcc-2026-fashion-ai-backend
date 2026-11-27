/*
 * Avatar 3D (RF40) / Provador — atlas de textura da peça: à esquerda a foto, à direita o tecido (ladrilho, retalho
 * espelhado ou degradê das linhas) que veste costas e laterais. Guarda os últimos atlas por imagem.
 */
import * as THREE from "three";
import { fabricPatch, fabricRows, fabricTile, medoid } from "./garment-photo";
import { isBackdrop, type PhotoInfo } from "./garment-photo-info";
import type { GarmentSpec } from "./garment-spec";

const garmentAtlases = new Map<object, { key: string; canvas: HTMLCanvasElement }>();

export function garmentTexture(img: (CanvasImageSource & { width: number; height: number }) | null, fabric: string,
  mapping?: { width: number; height: number; photoScaleX: number; photoScaleY: number } | null, info?: PhotoInfo | null, spec?: GarmentSpec): THREE.CanvasTexture {
  const cacheKey = JSON.stringify([fabric, mapping, spec?.kind, info?.box, info?.backdrop, info?.collarRow, info?.landmarks, info?.legRows]);
  const cached = img ? garmentAtlases.get(img) : null;
  if (cached?.key === cacheKey) {
    garmentAtlases.delete(img!); garmentAtlases.set(img!, cached);
    const texture = new THREE.CanvasTexture(cached.canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    texture.userData.atlasCacheHit = true;
    return texture;
  }
  const scale = img ? Math.min(1, 2048 / Math.max(img.width, img.height)) : 1;
  const W = img ? Math.max(1, Math.round(img.width * scale)) : 16, H = img ? Math.max(1, Math.round(img.height * scale)) : 16;
  const cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H; const g = cv.getContext("2d")!;
  g.fillStyle = fabric; g.fillRect(0, 0, W * 2, H);
  if (img) {
    const source = document.createElement("canvas"); source.width = img.width; source.height = img.height;
    const sg = source.getContext("2d", { willReadFrequently: true })!; sg.drawImage(img, 0, 0);
    const raster = sg.getImageData(0, 0, source.width, source.height);
    if (info?.backdrop) {
      const d = raster.data;
      for (let o = 0; o < d.length; o += 4) if (isBackdrop(d, o, info.backdrop)) d[o + 3] = 0;
      sg.putImageData(raster, 0, 0);
    }
    const upperPanels = spec && ["shirt", "hoodie", "sweater", "jacket", "coat"].includes(spec.kind) && info?.landmarks;
    const torsoCenter = upperPanels ? (upperPanels.neckline.x + upperPanels.hem.x) / 2 : null;
    const split = info && upperPanels ? torsoCenter
      : info?.legRows?.length ? (info.box.x0 + info.box.x1) / 2 : null;
    const panels = split === null ? [{}] : [{ fromX: 0, toX: split }, { fromX: split, toX: img.width }];
    for (const [panel, range] of panels.entries()) {
      const offset = W + panel * W / panels.length, panelWidth = W / panels.length;
      const tile = fabricTile(raster, range);
      const patch = tile ? null : fabricPatch(raster, range);
      if (!tile && !patch) {
        const bh = info ? info.box.y1 - info.box.y0 : img.height;
        let rows = fabricRows(raster, { ...range, inset: !upperPanels && info?.legRows?.length ? .1 : .25,
          ...(info ? { fromY: info.box.y0 + bh * (info.collarRow ?? 0.02), toY: info.box.y1 - bh * 0.03 } : {}) });
        if (!upperPanels && info?.legRows?.length && rows.length >= 8) {
          const chroma = (rgb: number[]) => {
            const minimum = Math.min(...rgb), range = Math.max(...rgb) - minimum;
            if (range < 12) return null;
            const channels = rgb.map(channel => channel - minimum), sum = channels.reduce((a, b) => a + b, 0);
            return channels.map(channel => channel / sum);
          };
          const cloth = chroma(medoid(rows.map(row => row.rgb)));
          const wash = rows.filter(row => {
            const hue = chroma(row.rgb);
            return !cloth || !hue || Math.hypot(...hue.map((channel, index) => channel - cloth[index])) < .4;
          });
          if (wash.length >= rows.length / 2) rows = wash;
        }
        if (rows.length) {
          const back = g.createLinearGradient(0, 0, 0, H);
          const photoHeight = mapping ? mapping.height * mapping.photoScaleY : img.height;
          const first = rows[0].y, last = rows[rows.length - 1].y;
          for (const row of rows) back.addColorStop(Math.min(1, Math.max(0, (row.y - first) / Math.max(1, Math.min(photoHeight, last - first)))), `rgb(${row.rgb.join(",")})`);
          g.fillStyle = back; g.fillRect(offset, 0, panelWidth, H);
        }
      } else {
        const sample = document.createElement("canvas");
        if (tile) {
          sample.width = tile.width; sample.height = tile.height;
          sample.getContext("2d")!.drawImage(source, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
        } else {
          const p = patch!; sample.width = p.width * 2; sample.height = p.height * 2; const sg2 = sample.getContext("2d")!;
          for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
            sg2.save(); sg2.translate(fx < 0 ? p.width * 2 : 0, fy < 0 ? p.height * 2 : 0); sg2.scale(fx, fy);
            sg2.drawImage(source, p.x, p.y, p.width, p.height, 0, 0, p.width, p.height); sg2.restore();
          }
        }
        const pattern = g.createPattern(sample, "repeat");
        if (pattern) {
          const sx = mapping ? W / (mapping.width * mapping.photoScaleX) : W / img.width;
          const sy = mapping ? H / (mapping.height * mapping.photoScaleY) : H / img.height;
          g.save(); g.beginPath(); g.rect(offset, 0, panelWidth, H); g.clip();
          g.translate(W, 0); g.scale(sx, sy); g.fillStyle = pattern; g.fillRect(0, 0, W / sx, H / sy); g.restore();
        }
      }
    }
    g.drawImage(info?.backdrop ? source : img, 0, 0, W, H);
  }
  if (img) {
    garmentAtlases.set(img, { key: cacheKey, canvas: cv });
    if (garmentAtlases.size > 4) garmentAtlases.delete(garmentAtlases.keys().next().value!);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.atlasCacheHit = false; return t;
}

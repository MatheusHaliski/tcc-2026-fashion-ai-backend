/*
 * Avatar 3D (RF40) / Provador — a malha final da peça (texturedGeometry): UV da foto na frente (calçado, peça de cima
 * com gola/marcos, pernas separadas, mangas), UV de tecido nas costas e o peso da foto por vértice.
 */
import * as THREE from "three";
import { landmarkProjection } from "./photo-landmarks";
import { baseNormals } from "./three-human";
import type { GarmentGeometry } from "./garment-body";
import { HAS_COLLAR_BAND } from "./garment-collar";
import { photoSleeves, type PhotoInfo, type SleeveSource, type SleeveSpan } from "./garment-photo-info";

export function texturedGeometry(gg: GarmentGeometry, posed: Float32Array, photo: PhotoInfo | null, noPhoto?: (v: number) => boolean,
  visibleAlpha: Float32Array = gg.alpha, sleeve?: SleeveSource): THREE.BufferGeometry {
  const sp = gg.spec; const n = gg.index.length / 3;
  let map: ((x: number, y: number, z?: number) => [number, number]) | null = null;
  let torsoCenter = 0;
  let photoScaleX = 1, photoScaleY = 1;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let v = 0; v < gg.position.length / 3; v++) {
    xMin = Math.min(xMin, gg.position[v * 3]); xMax = Math.max(xMax, gg.position[v * 3]);
    yMin = Math.min(yMin, gg.position[v * 3 + 1]); yMax = Math.max(yMax, gg.position[v * 3 + 1]);
  }

  if (photo && (sp.kind === "shoes" || sp.kind === "boots")) {
    let footXMin = Infinity, footXMax = -Infinity;
    let footYMin = Infinity, footYMax = -Infinity;
    let footZMin = Infinity, footZMax = -Infinity;
    for (let v = 0; v < posed.length / 3; v++) if (gg.alpha[v] > 0.01) {
      footXMin = Math.min(footXMin, posed[v * 3]); footXMax = Math.max(footXMax, posed[v * 3]);
      footYMin = Math.min(footYMin, posed[v * 3 + 1]); footYMax = Math.max(footYMax, posed[v * 3 + 1]);
      footZMin = Math.min(footZMin, posed[v * 3 + 2]); footZMax = Math.max(footZMax, posed[v * 3 + 2]);
    }
    const dx = Math.max(0.01, footXMax - footXMin), dy = Math.max(0.01, footYMax - footYMin), dz = Math.max(0.01, footZMax - footZMin);
    map = (x, y, z) => {
      const uP = (x - footXMin) / dx, vP = (y - footYMin) / dy, zP = z !== undefined ? (z - footZMin) / dz : 0.5;
      return [0.05 + 0.90 * (0.6 * uP + 0.4 * zP), 0.05 + 0.90 * vP];
    };
  } else if (photo) {
    let yTop = -Infinity, yBot = Infinity; const front: number[] = [];
    for (let v = 0; v < posed.length / 3; v++) if (gg.alpha[v] > 0.5 && !noPhoto?.(v) && gg.photoEligible?.[v] !== 0) { const y = posed[v * 3 + 1]; yTop = Math.max(yTop, y); yBot = Math.min(yBot, y); front.push(v); }
    const isUpperPiece = ["tee", "longsleeve", "crop", "hoodie", "shirt", "tank", "dress", "jacket", "coat", "sweater"].includes(sp.kind);
    const fy = ["pants", "shorts", "bermuda", "culottes", "skirt", "leggings"].includes(sp.kind) ? 0.45 : isUpperPiece ? 0.85 : sp.sleeve > 0.6 ? 0.93 : 0.62;
    const yRef = yTop - (yTop - yBot) * fy;
    let xl = Infinity, xr = -Infinity;
    for (const v of front) if (Math.abs(posed[v * 3 + 1] - yRef) < 0.012) { xl = Math.min(xl, posed[v * 3]); xr = Math.max(xr, posed[v * 3]); }
    const pw = (isUpperPiece ? photo.torsoWidthAt?.(fy) : null) ?? photo.widthAt(fy);
    if (Number.isFinite(xl) && pw && xr > xl) {
      const { box } = photo; const sx = (pw.x1 - pw.x0) / (xr - xl); const cxP = (pw.x0 + pw.x1) / 2, cxG = (xl + xr) / 2;
      photoScaleX = sx; torsoCenter = cxG;
      const bh = box.y1 - box.y0;
      let yFront = -Infinity;
      if (HAS_COLLAR_BAND.has(sp.kind) && photo.collarRow !== null) {
        const mid = front.filter((v) => Math.abs(posed[v * 3]) < 0.025);
        if (mid.length) {
          let z0 = Infinity, z1 = -Infinity; for (const v of mid) { z0 = Math.min(z0, posed[v * 3 + 2]); z1 = Math.max(z1, posed[v * 3 + 2]); }
          for (const v of mid) if (posed[v * 3 + 2] > (z0 + z1) / 2) yFront = Math.max(yFront, posed[v * 3 + 1]);
        }
      }
      if (Number.isFinite(yFront) && yFront - yBot > 0.1) {
        const yRib = yFront - 0.016; const rowRib = box.y0 + bh * photo.collarRow!;
        const sy = (box.y1 - rowRib) / (yRib - yBot);
        photoScaleY = sy;
        map = (x, y) => [(cxP + (x - cxG) * sx) / photo.width, 1 - (box.y1 - (y - yBot) * sy) / photo.height];
      } else {
        const sy = bh / Math.max(0.05, yTop - yBot);
        photoScaleY = sy;
        map = (x, y) => [(cxP + (x - cxG) * sx) / photo.width, 1 - (box.y0 + (yTop - y) * sy) / photo.height];
      }
      if (photo.legRows?.length && sp.leg>0 && Number.isNaN(sp.hem)) {
        const whole=map!;
        const makeLeg=(side:"left"|"right")=>{
          const rows=photo.legRows!.flatMap(row=>{
            const modelY=yTop-(row.y-box.y0)/Math.max(1,bh)*(yTop-yBot);
            const candidates=front.filter(v=>Math.abs(posed[v*3+1]-modelY)<.025 && (side==="left"?posed[v*3]<cxG:posed[v*3]>=cxG));
            if(candidates.length<2)return [];
            const modelLeft=Math.min(...candidates.map(v=>posed[v*3])),modelRight=Math.max(...candidates.map(v=>posed[v*3]));
            if(modelRight-modelLeft<.005)return [];
            return [{modelY,modelLeft,modelRight,photoY:row.y,photoLeft:row[side].x0,photoRight:row[side].x1}];
          });
          return rows.length>=4?landmarkProjection(rows,photo.width,photo.height):null;
        };
        const left=makeLeg("left"),right=makeLeg("right");
        if(left&&right){
          const start=photo.legRows[0].y;
          map=(x,y)=>{
            const base=whole(x,y),photoY=(1-base[1])*photo.height;
            const f=Math.min(1,Math.max(0,(photoY-start)/Math.max(1,bh*.06)));
            const leg=(x<cxG?left:right)(x,y);
            return [base[0]*(1-f)+leg[0]*f,base[1]];
          };
        }
      }
      if (photo.landmarks && isUpperPiece) {
        const lm = photo.landmarks;
        const shouldersY = yTop - .02;
        const modelRow = (y: number) => {
          const row = front.filter(v => Math.abs(posed[v * 3 + 1] - y) < .025);
          if (row.length < 2) return { left: xl, right: xr };
          return { left: Math.min(...row.map(v => posed[v * 3])), right: Math.max(...row.map(v => posed[v * 3])) };
        };
        const top = modelRow(shouldersY), hem = modelRow(yBot + .02), ph = photo.torsoWidthAt?.(.98) ?? photo.widthAt(.98) ?? pw;
        map = landmarkProjection([
          { modelY: shouldersY, modelLeft: top.left, modelRight: top.right, photoY: (lm.leftShoulder.y + lm.rightShoulder.y) / 2, photoLeft: lm.leftShoulder.x, photoRight: lm.rightShoulder.x },
          { modelY: yRef, modelLeft: xl, modelRight: xr, photoY: box.y0 + bh * fy, photoLeft: pw.x0, photoRight: pw.x1 },
          { modelY: yBot, modelLeft: hem.left, modelRight: hem.right, photoY: box.y1, photoLeft: ph.x0, photoRight: ph.x1 },
        ], photo.width, photo.height);
      }
    }
  }

  let sleeveUv: ((v: number) => [number, number] | null) | null = null;
  const spans = map && photo && sleeve && sp.sleeve > 0 ? photoSleeves(photo) : null;
  if (spans && photo && sleeve) {
    const bh = photo.box.y1 - photo.box.y0; const bins = 24;
    const edges: Record<"l" | "r", { min: number; max: number }[]> = { l: [], r: [] };
    const where = (v: number) => {
      const a = sleeve.along(v); if (!(a >= 0) || !sleeve.isSleeve(v)) return null;
      const t = Math.min(1, Math.max(0, a / Math.max(0.01, sp.sleeve)));
      return { side: (posed[v * 3] < torsoCenter ? "l" : "r") as "l" | "r", t, bin: Math.min(bins - 1, Math.floor(t * bins)) };
    };
    for (let v = 0; v < posed.length / 3; v++) {
      const at = where(v); if (!at) continue;
      const e = edges[at.side][at.bin] ?? (edges[at.side][at.bin] = { min: Infinity, max: -Infinity });
      e.min = Math.min(e.min, posed[v * 3]); e.max = Math.max(e.max, posed[v * 3]);
    }
    const spanAt = (rows: SleeveSpan[], t: number): SleeveSpan => {
      const fy = rows[0].fy + t * (rows[rows.length - 1].fy - rows[0].fy);
      let k = 0; while (k < rows.length - 2 && rows[k + 1].fy < fy) k++;
      const a = rows[k], b = rows[Math.min(rows.length - 1, k + 1)]; const f = b.fy > a.fy ? (fy - a.fy) / (b.fy - a.fy) : 0;
      return { fy, x0: a.x0 + (b.x0 - a.x0) * f, x1: a.x1 + (b.x1 - a.x1) * f };
    };
    sleeveUv = (v) => {
      const at = where(v); if (!at) return null;
      const rows = at.side === "l" ? spans.left : spans.right; const e = edges[at.side][at.bin];
      if (!rows || !e || e.max - e.min < 1e-4) return null;
      const s = spanAt(rows, at.t); const cross = (posed[v * 3] - e.min) / (e.max - e.min);
      return [(s.x0 + cross * (s.x1 - s.x0)) / photo.width, 1 - (photo.box.y0 + s.fy * bh) / photo.height];
    };
  }

  const pos: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [];
  const fabricUv: number[] = [], photoWeight: number[] = [];
  const normals = baseNormals(posed, gg.index, Uint32Array.from({ length: posed.length / 3 }, (_, i) => i));
  const cache = new Map<string, number>(); const index: number[] = [];
  for (let t = 0; t < n; t++) {
    const vs = [gg.index[t * 3], gg.index[t * 3 + 1], gg.index[t * 3 + 2]];
    const isFront = !!map;
    for (const v of vs) {
      const key = `${v}:${isFront ? 1 : 0}`; let i = cache.get(key);
      if (i === undefined) {
        i = pos.length / 3; cache.set(key, i);
        pos.push(gg.position[v * 3], gg.position[v * 3 + 1], gg.position[v * 3 + 2]);
        const sleeveAt = sleeveUv?.(v) ?? null;
        
        const gGroup = gg.source[v] >= 0 ? 1 : 3;
        const isLowerPiece = gGroup === 3 || ["pants", "shorts", "bermuda", "culottes", "skirt", "leggings"].includes(sp.kind);
        const isShoe = sp.kind === "shoes" || sp.kind === "boots";

        const normalZ = normals[v * 3 + 2];
        const isBackView = photo?.isBackView ?? false;
        
        const angleThreshold = isShoe 
          ? 1.0 
          : isLowerPiece 
          ? Math.min(1, Math.max(0, (normalZ + 0.65) / 0.85)) 
          : isBackView 
          ? Math.min(1, Math.max(0, (-normalZ + 0.35) / 0.85))
          : Math.min(1, Math.max(0, (normalZ + 0.35) / 0.85));

        const isSleeveVertex = sleeve?.isSleeve(v) ?? false;
        const blend = isFront && (sleeveAt || isSleeveVertex || isLowerPiece || isShoe || !noPhoto?.(v)) && gg.photoEligible?.[v] !== 0 
          ? angleThreshold 
          : 0;

        if (sleeveAt) {
          uv.push(0.5 * Math.min(0.999, Math.max(0.001, sleeveAt[0])), Math.min(0.999, Math.max(0.001, sleeveAt[1])));
        } else if (map) {
          const [u, w] = map(posed[v * 3], posed[v * 3 + 1], posed[v * 3 + 2]);
          uv.push(0.5 * Math.min(0.999, Math.max(0.001, u)), Math.min(0.999, Math.max(0.001, w)));
        } else {
          uv.push(0.501 + 0.498 * (gg.position[v * 3] - xMin) / Math.max(0.01, xMax - xMin),
            0.001 + 0.998 * (gg.position[v * 3 + 1] - yMin) / Math.max(0.01, yMax - yMin));
        }
        fabricUv.push(0.501 + 0.498 * (gg.position[v * 3] - xMin) / Math.max(0.01, xMax - xMin),
          0.001 + 0.998 * (gg.position[v * 3 + 1] - yMin) / Math.max(0.01, yMax - yMin));
        photoWeight.push(blend * blend * (3 - 2 * blend));
        col.push(1, 1, 1, visibleAlpha[v]);
        for (let k = 0; k < 4; k++) { si.push(gg.skinIndex[v * 4 + k]); sw.push(gg.skinWeight[v * 4 + k]); }
      }
      index.push(i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("fabricUv", new THREE.Float32BufferAttribute(fabricUv, 2));
  g.setAttribute("photoWeight", new THREE.Float32BufferAttribute(photoWeight, 1));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(index); g.computeVertexNormals();
  g.userData.fabricMapping = { width: Math.max(0.01, xMax - xMin), height: Math.max(0.01, yMax - yMin), photoScaleX, photoScaleY };
  return g;
}

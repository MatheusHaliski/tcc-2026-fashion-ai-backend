/*
 * Avatar 3D (RF40) — cabelo: a malha pronta (HairBuild), a textura de fios desenhada no canvas e o material da
 * calota/cortina/cobertura (finish).
 */
import * as THREE from "three";
import { installHairCoverage } from "./hair-coverage";

/**
 * calotaIndex: quantos índices (a partir do 0) são da calota — o couro cabeludo coberto, onde nascem os fios
 * (lib/avatar3d/human/hair-strands.ts); o resto é a cortina do cabelo médio/longo.
 */
export interface HairBuild { geometry: THREE.BufferGeometry; material: THREE.Material; kind: "hair" | "cover"; calotaIndex?: number }

function strandTexture(color: string, texture: string, cover: boolean, variation = 0): THREE.CanvasTexture {
  const W = 256, H = 512; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
  const base = new THREE.Color(color); g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  if (cover) {                                              // tecido: trama fina, sem fios
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.04})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.03})`; g.fillRect(x, 0, 1, H); }
  } else {
    // variação medida na foto (hair.variation): cabelo com muito contraste sombra/reflexo ganha mechas mais separadas
    const dark = base.clone().multiplyScalar(0.78 - 0.14 * variation), light = base.clone().lerp(new THREE.Color("#fff3dc"), 0.08 + 0.2 * variation);
    // raízes um pouco mais escuras (alto do mapa)
    const grad = g.createLinearGradient(0, 0, 0, H * 0.3); grad.addColorStop(0, `#${base.clone().multiplyScalar(0.8).getHexString()}`); grad.addColorStop(1, `#${base.getHexString()}`);
    g.fillStyle = grad; g.fillRect(0, 0, W, H * 0.3);
    const curly = texture === "curly" || texture === "coily";
    // Canvas recebe sRGB; componentes de THREE.Color são lineares e não podem ser multiplicados por 255 aqui.
    const rgba = (c: THREE.Color, a: number) => { const s = c.clone().convertLinearToSRGB(); return `rgba(${Math.round(s.r * 255)},${Math.round(s.g * 255)},${Math.round(s.b * 255)},${a})`; };
    for (let i = 0; i < (curly ? 5000 : 1600); i++) {
      const x = rnd() * W, y0 = rnd() * H; const c = rnd() < 0.5 ? dark : light;
      g.strokeStyle = rgba(c, curly ? 0.12 + rnd() * 0.18 : 0.15 + rnd() * 0.25); g.lineWidth = curly ? 0.8 + rnd() * 0.8 : 0.5 + rnd() * 0.9;
      g.beginPath();
      if (curly) { const r = texture === "coily" ? 1.2 + rnd() * 1.8 : 2.5 + rnd() * 3.5; const a0 = rnd() * 6.28; g.arc(x, y0, r, a0, a0 + 1.6 + rnd() * 2.2); }
      else { const len = 60 + rnd() * 200; g.moveTo(x, y0); const wav = texture === "wavy" ? 5 : 1.2; for (let t = 0; t <= len; t += 8) g.lineTo(x + Math.sin((y0 + t) / 24) * wav, y0 + t); }
      g.stroke();
    }
    // A base cobre o miolo do cabelo; só a máscara geométrica da linha/ponta pode recortá-la.
    // Alfa aleatório em toda a textura abria buracos no volume sob MSAA, inclusive no couro cabeludo.
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function finish(pos: number[], uv: number[], col: number[], si: number[], sw: number[], index: number[], colHex: string, texture: string, covered: boolean, base = false, variation = 0): HairBuild {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  const w = sw.slice(); for (let i = 0; i < w.length; i += 4) { const s0 = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1; for (let k = 0; k < 4; k++) w[i + k] /= s0; }
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  g.setIndex(index); g.computeVertexNormals();
  // com fios por cima (hair-strands.ts) esta malha é a base: mais escura, é o "fundo" entre as mechas
  const baseHex = base && !covered ? `#${new THREE.Color(colHex).multiplyScalar(0.62).getHexString()}` : colHex;
  const tex = typeof document !== "undefined" ? strandTexture(baseHex, texture, covered, variation) : null;
  // cabelo escuro (níveis 1–3) sem brilho próprio vira silhueta preta na cena: sheen mais alto e mais frio revela a forma
  const bc = new THREE.Color(baseHex); const darkHair = 0.2126 * bc.r + 0.7152 * bc.g + 0.0722 * bc.b < 0.025;
  const mat = new THREE.MeshPhysicalMaterial({
    // base sob os fios: fosca e escura (a profundidade entre as mechas, não uma superfície com brilho), e a linha do
    // cabelo some aos poucos (alpha-to-coverage com MSAA) em vez do recorte duro que serrilhava nos triângulos da testa
    color: tex ? "#ffffff" : baseHex, map: tex, vertexColors: true, alphaTest: base && !covered ? 0.3 : 0.5, alphaToCoverage: !covered, side: THREE.DoubleSide,
    roughness: covered ? 0.9 : base ? 0.92 : 0.58, sheen: covered ? 0.2 : base ? 0.05 : darkHair ? 0.55 : 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(baseHex).lerp(new THREE.Color("#ffffff"), darkHair ? 0.45 : 0.25),
    // fio: o brilho é uma faixa em anel em volta da cabeça (reflexo anisotrópico ao longo de u), não um ponto de plástico
    anisotropy: covered || base ? 0 : 0.3,
    // A folga geométrica mantém o cabelo fora da pele/roupa. O viés de inclinação atravessava o rosto em perfil.
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -1,
  });
  if (!covered) installHairCoverage(mat);
  mat.name = covered ? "cobertura" : "cabelo";
  return { geometry: g, material: mat, kind: covered ? "cover" : "hair" };
}

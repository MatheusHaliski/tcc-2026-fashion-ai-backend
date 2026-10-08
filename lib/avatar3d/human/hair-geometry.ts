/*
 * Avatar 3D (RF40) — cabelo (ou cobertura de cabeça) no corpo humano, a partir do que a foto mediu
 * (lib/avatar3d/hair.ts): comprimento, textura, volume no alto e dos lados, franja, cor.
 *
 *   calota  — os vértices do couro cabeludo do próprio corpo (acima da linha do cabelo, contornando as orelhas),
 *             afastados pela espessura do cabelo; herdam os pesos de pele, então acompanham a cabeça;
 *   cortina — cabelo médio/longo: uma superfície que desce da borda da calota pelas costas e pelos lados até o
 *             comprimento medido, sempre por fora do pescoço, dos ombros e das costas (raio do corpo + folga),
 *             presa à cabeça no alto e ao tronco embaixo;
 *   textura — fios desenhados num canvas (cor medida, raízes mais escuras, mechas mais claras); ondulado e cacheado
 *             ganham ondas/relevo na geometria e cachos no desenho;
 *   cobertura — lenço, turbante, boné ou gorro: a mesma calota, mais alta, na cor da cobertura, sem fios.
 * Tudo em coordenadas de repouso do corpo (m), com os pesos de pele do mesmo esqueleto.
 */
import * as THREE from "three";
import type { BodyAsset } from "./asset";
import type { Composed } from "./compose";
import { landmarksOn } from "./compose";
import type { AvatarHair } from "../model";

const CANON_FOREHEAD = 8.26, CANON_CHIN = -9.4, SKULL_TOP = 13;     // y no canônico do rosto (cm)

/**
 * calotaIndex: quantos índices (a partir do 0) são da calota — o couro cabeludo coberto, onde nascem os fios
 * (lib/avatar3d/human/hair-strands.ts); o resto é a cortina do cabelo médio/longo.
 */
export interface HairBuild { geometry: THREE.BufferGeometry; material: THREE.Material; kind: "hair" | "cover"; calotaIndex?: number }

export interface HeadFrame { cx: number; cz: number; y10: number; k: number; toY: (yc: number) => number; earY: number; chinY: number; headTop: number; halfW: number }

export function headFrame(a: BodyAsset, c: Composed): HeadFrame {
  const L = landmarksOn(a, c.body); const P = (i: number) => [L[i * 3], L[i * 3 + 1], L[i * 3 + 2]];
  const f = P(10), ch = P(152), l = P(234), r = P(454);
  const k = (f[1] - ch[1]) / (CANON_FOREHEAD - CANON_CHIN);
  let top = -Infinity; for (const v of a.meta.vertices.top) top = Math.max(top, c.body[v * 3 + 1]);
  return { cx: (l[0] + r[0]) / 2, cz: (l[2] + r[2]) / 2 - 0.012, y10: f[1], k, toY: (yc) => f[1] + (yc - CANON_FOREHEAD) * k, earY: (l[1] + r[1]) / 2, chinY: ch[1], headTop: top, halfW: Math.abs(l[0] - r[0]) / 2 };
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Altura da linha do cabelo em função do ângulo em volta da cabeça (0 = frente, π = nuca). */
/** Ruído determinístico por ângulo (−1…1): linha do cabelo e pontas irregulares, sem sorteio a cada render. */
const wobble = (x: number) => Math.sin(x * 23.1) * 0.5 + Math.sin(x * 41.7 + 1.3) * 0.3 + Math.sin(x * 7.3 + 0.4) * 0.2;
const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

const scalpCache = new WeakMap<BodyAsset, { ear: Uint8Array; edge: Float32Array }>();

/**
 * A orelha também tem peso no osso Head; esse peso não a torna couro cabeludo. Classificamos a pinna na forma
 * neutra do asset (topologia estável), antes de alterações de rosto/estatura, e suavizamos a borda na vizinhança.
 * O cabelo longo pode cair por fora dela, mas a calota nunca copia suas dobras nem faz nascer fios na orelha.
 */
function scalpRegions(a: BodyAsset): { ear: Uint8Array; edge: Float32Array } {
  const cached = scalpCache.get(a); if (cached) return cached;
  const L = landmarksOn(a, a.body.position), p = a.body.position;
  const k = (L[10 * 3 + 1] - L[152 * 3 + 1]) / (CANON_FOREHEAD - CANON_CHIN);
  const cx = (L[234 * 3] + L[454 * 3]) / 2, cz = (L[234 * 3 + 2] + L[454 * 3 + 2]) / 2 - 0.012;
  const halfW = Math.abs(L[234 * 3] - L[454 * 3]) / 2, cy = L[10 * 3 + 1] + (0.8 - CANON_FOREHEAD) * k;
  const head = a.meta.bones.findIndex((b) => b.name === "mixamorig:Head");
  const ear = new Uint8Array(a.meta.counts.body), edge = new Float32Array(a.meta.counts.body).fill(1);
  for (let v = 0; v < ear.length; v++) {
    if (a.body.skinIndex[v * 4] !== head) continue;
    const x = p[v * 3] - cx, y = p[v * 3 + 1], z = p[v * 3 + 2];
    const phi = Math.abs(Math.atan2(x, z - cz));
    const d = ((y - cy) / (4.9 * k)) ** 2 + ((z - (cz - 0.026)) / (3.1 * k)) ** 2;
    if (Math.abs(x) > halfW * 0.82 && phi > 1.55 && phi < 2.35 && d < 1) { ear[v] = 1; edge[v] = 0; }
  }
  const rv = a.body.renderVertex, idx = a.body.index;
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [rv[idx[t]], rv[idx[t + 1]], rv[idx[t + 2]]];
    if (tri.some((v) => ear[v])) for (const v of tri) if (!ear[v]) edge[v] = 0.45;
  }
  const inner = edge.slice();
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [rv[idx[t]], rv[idx[t + 1]], rv[idx[t + 2]]];
    if (tri.some((v) => inner[v] < 1)) for (const v of tri) if (edge[v] === 1) edge[v] = 0.85;
  }
  const regions = { ear, edge }; scalpCache.set(a, regions); return regions;
}

/** Máscara da pinna, na topologia do corpo original (não da malha duplicada de render). */
export function earVertexMask(a: BodyAsset): Uint8Array { return scalpRegions(a).ear; }

export function hairline(fr: HeadFrame, hair: AvatarHair, phi: number, covered: boolean): number {
  return hairlineBase(fr, hair, phi, covered) + (covered ? 0 : wobble(phi) * 0.0035);   // linha viva, não régua
}

function hairlineBase(fr: HeadFrame, hair: AvatarHair, phi: number, covered: boolean): number {
  const a = Math.abs(phi);
  // o ponto 10 do MediaPipe (topo da malha do rosto) fica só ~3 cm acima da sobrancelha; a linha do cabelo de verdade,
  // ~5–6 cm: nascendo no ponto 10 a testa ficava curta e o cabelo virava "cuia". A franja medida desce a linha até a
  // sobrancelha (canônico ≈ 5,1)
  // franja escolhida (reta, lateral, cortina, nenhuma): a franja é feita de fios caindo sobre a testa; a linha da base
  // fica no lugar — descer a base até a sobrancelha deixava uma superfície lisa na testa (o "capacete")
  const baseFringe = hair.fringeStyle && hair.fringeStyle !== "wispy" ? 0 : Math.min(1, hair.fringe);
  const front = covered ? fr.toY(CANON_FOREHEAD + 1.2) : fr.toY(CANON_FOREHEAD + 2 - baseFringe * 4.8);
  const temple = fr.toY(covered ? 5.5 : 6.2);
  const long = hair.length === "medium" || hair.length === "long";
  // sobre a orelha: o cabelo desce até onde a foto mostra (médio/longo cobre a orelha toda; curto pode cobrir o alto dela)
  const ear = covered ? fr.toY(3.2) : long ? fr.toY(-2.5) : fr.toY(Math.min(2.9, Math.max(-1.5, hair.bottom ?? 2.9)));
  const nape = covered ? fr.toY(0) : fr.toY(hair.length === "buzz" ? -4 : -6.5);
  // costeleta à frente da orelha (curto), contorno por cima da orelha e descida até a nuca atrás dela
  const shortish = !long && !covered;
  const sideburn = shortish ? fr.toY(1.2) : temple;
  if (a < 0.6) return lerp(front, temple, smooth(0.35, 0.6, a));
  if (a < 1.2) return lerp(temple, sideburn, smooth(0.8, 1.15, a));
  if (a < 1.85) return lerp(sideburn, ear, smooth(1.2, 1.4, a));
  if (a < 2.35) return lerp(ear, nape, smooth(1.85, 2.35, a));
  return nape;
}

function strandTexture(color: string, texture: string, cover: boolean): THREE.CanvasTexture {
  const W = 256, H = 512; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
  const base = new THREE.Color(color); g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  if (cover) {                                              // tecido: trama fina, sem fios
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.04})`; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.03})`; g.fillRect(x, 0, 1, H); }
  } else {
    const dark = base.clone().multiplyScalar(0.78), light = base.clone().lerp(new THREE.Color("#fff3dc"), 0.08);
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
    // alfa com "pontas": a borda (linha do cabelo, pontas da cortina) desfia em fios, sem recorte liso
    const id = g.getImageData(0, 0, W, H);
    for (let x = 0; x < W; x++) { const a = 150 + Math.floor(rnd() * 105); for (let y = 0; y < H; y++) id.data[(y * W + x) * 4 + 3] = Math.min(255, a + ((y * 7 + x * 13) % 23)); }
    g.putImageData(id, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/** Ruído suave 3D (soma de senos) para o relevo de cachos: determinístico, sem dependência. */
const bump = (x: number, y: number, z: number, f: number) =>
  (Math.sin(x * f * 1.7 + Math.sin(y * f * 1.3)) + Math.sin(y * f * 2.1 + Math.sin(z * f * 1.1)) + Math.sin(z * f * 1.9 + Math.sin(x * f * 0.9))) / 3;

function finish(pos: number[], uv: number[], col: number[], si: number[], sw: number[], index: number[], colHex: string, texture: string, covered: boolean, base = false): HairBuild {
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
  const tex = typeof document !== "undefined" ? strandTexture(baseHex, texture, covered) : null;
  const mat = new THREE.MeshPhysicalMaterial({
    // base sob os fios: fosca e escura (a profundidade entre as mechas, não uma superfície com brilho), e a linha do
    // cabelo some aos poucos (alpha-to-coverage com MSAA) em vez do recorte duro que serrilhava nos triângulos da testa
    color: "#ffffff", map: tex, vertexColors: true, alphaTest: base && !covered ? 0.3 : 0.5, alphaToCoverage: base && !covered, side: THREE.DoubleSide,
    roughness: covered ? 0.9 : base ? 0.92 : 0.58, sheen: covered ? 0.2 : base ? 0.05 : 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(baseHex).lerp(new THREE.Color("#ffffff"), 0.25),
    // fio: o brilho é uma faixa em anel em volta da cabeça (reflexo anisotrópico ao longo de u), não um ponto de plástico
    anisotropy: covered || base ? 0 : 0.3,
    // A folga geométrica mantém o cabelo fora da pele/roupa. O viés de inclinação atravessava o rosto em perfil.
    polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -1,
  });
  mat.name = covered ? "cobertura" : "cabelo";
  return { geometry: g, material: mat, kind: covered ? "cover" : "hair" };
}

/** Raspado: o próprio couro cabeludo, 2–3 mm para fora, com a linha do cabelo desfiada. */
function buzzShell(a: BodyAsset, c: Composed, normals: Float32Array, hair: AvatarHair, fr: HeadFrame): HairBuild | null {
  const nb = a.meta.counts.body;
  const scalp = scalpRegions(a);
  const headBone = a.meta.bones.findIndex((b) => b.name === "mixamorig:Head");
  const inScalp = new Uint8Array(nb); const phiOf = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    if (a.body.skinIndex[v * 4] !== headBone || scalp.ear[v]) continue;
    const x = c.body[v * 3] - fr.cx, z = c.body[v * 3 + 2] - fr.cz; const phi = Math.atan2(x, z); phiOf[v] = phi;
    if (c.body[v * 3 + 1] >= hairline(fr, hair, phi, false) - 0.02) inScalp[v] = 1;
  }
  const rv = a.body.renderVertex; const idx = a.body.index; const map = new Map<number, number>();
  const pos: number[] = [], uv: number[] = [], si: number[] = [], sw: number[] = [], col: number[] = [], index: number[] = [];
  const add = (v: number) => {
    let i = map.get(v); if (i !== undefined) return i; i = pos.length / 3; map.set(v, i);
    const t = 0.0025;
    pos.push(c.body[v * 3] + normals[v * 3] * t, c.body[v * 3 + 1] + normals[v * 3 + 1] * t, c.body[v * 3 + 2] + normals[v * 3 + 2] * t);
    uv.push((phiOf[v] / (2 * Math.PI) + 0.5) * 10, (fr.headTop - c.body[v * 3 + 1]) / 0.25);
    for (let j = 0; j < 4; j++) { const w = a.body.skinWeight[v * 4 + j]; si.push(w ? a.body.skinIndex[v * 4 + j] : 0); sw.push(w / 255); }
    const hl = hairline(fr, hair, phiOf[v], false); col.push(1, 1, 1, smooth(hl - 0.02, hl + 0.006, c.body[v * 3 + 1]) * scalp.edge[v]);
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) { const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]]; if (inScalp[p] && inScalp[q] && inScalp[r]) index.push(add(p), add(q), add(r)); }
  return index.length ? finish(pos, uv, col, si, sw, index, hair.color!, "straight", false) : null;
}

/** Meia-largura (cm, canônico) da silhueta numa altura do canônico, interpolando HAIR_LEVELS (16, 14, …, −24). */
function outlineAt(outline: number[] | undefined, yc: number): number {
  if (!outline?.length) return 0;
  const f = (16 - yc) / 2; const i = Math.floor(f); const t = f - i;
  const a = outline[Math.max(0, Math.min(outline.length - 1, i))] ?? 0, b = outline[Math.max(0, Math.min(outline.length - 1, i + 1))] ?? 0;
  if (!a || !b) return t < 0.5 ? a : b;
  return a + (b - a) * t;
}

/**
 * Cabelo (ou cobertura) em duas partes, as duas presas ao esqueleto:
 *   calota  — o couro cabeludo do próprio corpo afastado ao longo da normal (no alto a normal é vertical, então o
 *             volume forma uma cúpula, nunca um "disco"); a espessura em cada altura faz a largura bater com a
 *             silhueta do cabelo na foto (HAIR_LEVELS), e na testa ela começa rente e cresce para o alto;
 *   cortina — cabelo médio/longo: anéis que descem da borda da calota pelos lados e pelas costas até o comprimento
 *             medido, por fora do pescoço, dos ombros e das costas; abaixo dos ombros, só atrás.
 */
export function buildHair(a: BodyAsset, c: Composed, normals: Float32Array, hair: AvatarHair, volume = 1, opts: { base?: boolean } = {}): HairBuild | null {
  const covered = !!hair.cover;
  if (!covered && (!hair.present || hair.length === "bald" || !hair.color)) return null;
  const fr = headFrame(a, c); const nb = a.meta.counts.body; const k = fr.k;
  const scalp = scalpRegions(a);
  if (!covered && hair.length === "buzz") return buzzShell(a, c, normals, hair, fr);
  const texture = covered ? "straight" : hair.texture ?? "straight";
  const bone = (n: string) => a.meta.bones.findIndex((b) => b.name === "mixamorig:" + n);
  const headB = bone("Head"), neckB = bone("Neck"), spine2 = bone("Spine2");
  const armBones = new Set(a.meta.bones.map((b, i) => (/(Arm|ForeArm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const long = !covered && (hair.length === "medium" || hair.length === "long");
  const coily = texture === "coily";
  const curly = texture === "curly";
  // teto da espessura da calota. Cabelo médio/longo liso fica rente ao crânio nos lados (1–2 cm): a largura que a foto
  // mostra ao lado do rosto é do cabelo pendurado, e quem a desenha é a cortina — na calota ela virava a "aba" de capacete
  // volume medido na foto (lib/avatar3d/hair.ts, hairVolume): rente encolhe os tetos, volumoso os alarga
  const hv = covered ? 1 : Math.min(1.9, Math.max(0.7, hair.volume ?? 1));
  const maxSide = (covered ? 0.05 : coily ? 0.09 : curly ? 0.045 : long ? 0.02 : 0.016) * (covered ? 1 : hv);   // curto liso: laterais batidas
  const maxTop = (covered ? 0.09 : coily ? 0.1 : curly ? 0.04 : 0.035) * (covered ? 1 : Math.min(1.6, hv));
  const topCanon = covered ? Math.max(SKULL_TOP + 2, ...HAIR_TOPS(hair.outline)) : Math.max(SKULL_TOP + 0.5, hair.top || SKULL_TOP + 1);
  // volume mínimo de cabelo de verdade (fios têm corpo: nunca "pintado" no crânio). A silhueta da foto só aumenta isso;
  // com o alto da cabeça cortado na foto (hair.cut), a altura medida não vale e fica o mínimo do comprimento.
  const curlyish = texture === "curly" || coily;
  const minSide = covered ? 0.012 : (hair.length === "medium" || hair.length === "long" ? 0.014 : 0.01) * (coily ? 1.6 : curlyish ? 1.3 : 1);
  const minTop = covered ? 0.02 : (hair.length === "medium" || hair.length === "long" ? 0.022 : hair.cut ? 0.024 : 0.018) * (coily ? 1.6 : curlyish ? 1.3 : 1);
  const tTop = Math.min(maxTop, Math.max(minTop, hair.cut && !covered ? 0 : (topCanon - SKULL_TOP) * k));
  // meia-largura do crânio por altura: elipse pela largura do rosto na altura dos olhos e pelo topo da cabeça — lisa,
  // sem as orelhas (que dariam "abas" no cabelo logo abaixo delas)
  const halfW = (y: number) => y <= fr.earY ? fr.halfW * 0.97 : fr.halfW * 0.97 * Math.sqrt(Math.max(0.05, 1 - ((y - fr.earY) / Math.max(0.05, fr.headTop - fr.earY)) ** 2));
  const rawSide = (y: number) => {
    const W = outlineAt(hair.outline, CANON_FOREHEAD + (y - fr.y10) / k) * k;
    return W ? Math.max(minSide, Math.min(maxSide, W - halfW(y))) : minSide;
  };
  const sideAt = new Map<number, number>();
  const tSideAt = (y: number) => {                                         // média móvel de ±1,5 cm na altura
    const key = Math.round(y / 0.005); let t = sideAt.get(key);
    if (t === undefined) { t = 0; for (let d = -3; d <= 3; d++) t += rawSide(key * 0.005 + d * 0.005); t /= 7; sideAt.set(key, t); }
    return t;
  };
  const vol = (coily ? 1.12 : texture === "curly" ? 1.06 : 1) * volume;   // volume: ajuste fino da pessoa (0,6–1,6)
  // ---- calota
  const inScalp = new Uint8Array(nb); const phiOf = new Float32Array(nb); const thick = new Float32Array(nb);
  for (let v = 0; v < nb; v++) {
    const b0 = a.body.skinIndex[v * 4]; if (b0 !== headB && b0 !== neckB || scalp.ear[v]) continue;
    const x = c.body[v * 3] - fr.cx, y = c.body[v * 3 + 1], z = c.body[v * 3 + 2] - fr.cz;
    const phi = Math.atan2(x, z); phiOf[v] = phi;
    const hl = hairline(fr, hair, phi, covered); if (y < hl - 0.02) continue;
    inScalp[v] = 1;
    const ny = Math.max(0, normals[v * 3 + 1]);
    let t = lerp(tSideAt(y) * (Math.abs(phi) > 2 ? 0.9 : 1), tTop, ny * ny) * vol;
    const frontness = 1 - smooth(0.5, 1.1, Math.abs(phi));
    t *= lerp(1, smooth(hl, hl + Math.max(0.05, t * 2.2), y), frontness);    // testa: rente na linha do cabelo, sem aba
    // borda de baixo da calota (acima da orelha, na nuca): o cabelo curto termina rente, sem "aba"
    thick[v] = t * smooth(hl - 0.012, hl + (long ? 0.008 : 0.04), y) + 0.0015;
  }
  const rv = a.body.renderVertex; const idx = a.body.index; const map = new Map<number, number>();
  const pos: number[] = [], uv: number[] = [], si: number[] = [], sw: number[] = [], col: number[] = [], index: number[] = [];
  const add = (v: number) => {
    let i = map.get(v); if (i !== undefined) return i; i = pos.length / 3; map.set(v, i);
    let t = thick[v];
    if (!covered && (texture === "curly" || coily)) t += bump(c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2], coily ? 260 : 150) * (coily ? 0.006 : 0.0035);
    else if (!covered && t > 0.006) {
      // mechas: sulcos que descem do alto da cabeça (a direção do fio), com leve torção — a luz quebra em faixas e a
      // superfície deixa de ser uma casca lisa; somem no topo (redemoinho) e na borda
      const ny = Math.max(0, normals[v * 3 + 1]); const y = c.body[v * 3 + 1];
      const u = phiOf[v] * 15 + Math.sin(y * 55 + phiOf[v] * 2) * 0.7;
      t += (Math.abs(Math.sin(u)) ** 0.6 - 0.62) * (opts.base ? 0.0015 : 0.0032) * (1 - ny ** 4) * Math.min(1, t / 0.012);
      t += bump(c.body[v * 3], c.body[v * 3 + 1], c.body[v * 3 + 2], 70) * 0.0015;
    }
    pos.push(c.body[v * 3] + normals[v * 3] * t, c.body[v * 3 + 1] + normals[v * 3 + 1] * t, c.body[v * 3 + 2] + normals[v * 3 + 2] * t);
    uv.push((phiOf[v] / (2 * Math.PI) + 0.5) * 10, (fr.headTop - c.body[v * 3 + 1]) / 0.25);
    for (let j = 0; j < 4; j++) { const w = a.body.skinWeight[v * 4 + j]; si.push(w ? a.body.skinIndex[v * 4 + j] : 0); sw.push(w / 255); }
    const hl = hairline(fr, hair, phiOf[v], covered); col.push(1, 1, 1, smooth(hl - 0.02, hl + 0.006, c.body[v * 3 + 1]) * scalp.edge[v]);
    return i;
  };
  for (let t = 0; t < idx.length; t += 3) { const p = rv[idx[t]], q = rv[idx[t + 1]], r = rv[idx[t + 2]]; if (inScalp[p] && inScalp[q] && inScalp[r]) index.push(add(p), add(q), add(r)); }
  const calotaIndex = index.length;
  // ---- cortina (médio/longo)
  if (long) {
    const bottomC = Math.min(hair.bottom ?? -12, -4);
    // nasce na altura das têmporas, deitada sobre a calota (sem degrau na lateral), e desce até o comprimento medido
    const yStart = fr.toY(4.2), yBottom = fr.toY(bottomC), shoulderY = fr.chinY - 0.09;
    const NA = 72, dy = 0.008; const levels = Math.max(2, Math.ceil((yStart - yBottom + 0.05) / dy));
    const angOf = (x: number, z: number) => Math.round(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * NA) % NA;
    const rBody = new Float32Array((levels + 1) * NA);
    for (let v = 0; v < nb; v++) {
      if (armBones.has(a.body.skinIndex[v * 4])) continue;
      const y = c.body[v * 3 + 1]; if (y > yStart + dy || y < yBottom - 0.05 - dy) continue;
      const x = c.body[v * 3] - fr.cx, z = c.body[v * 3 + 2] - fr.cz; const r = Math.hypot(x, z);
      const li = Math.round((yStart - y) / dy); const aj = angOf(x, z);
      for (const l of [li - 1, li, li + 1]) if (l >= 0 && l <= levels) { const q = l * NA + aj; rBody[q] = Math.max(rBody[q], r); }
    }
    for (let l = 0; l <= levels; l++) for (let j = 0; j < NA; j++) if (!rBody[l * NA + j]) {
      let best = 0; for (let d = 1; d < NA / 2 && !best; d++) best = Math.max(rBody[l * NA + ((j + d) % NA)], rBody[l * NA + ((j - d + NA) % NA)]);
      rBody[l * NA + j] = best;
    }
    // raio da calota por altura e ângulo: a cortina passa por fora dela, colada, onde as duas se encontram
    const capR = new Float32Array((levels + 1) * NA);
    for (let q = 0; q < pos.length / 3; q++) {
      const li = Math.round((yStart - pos[q * 3 + 1]) / dy); if (li < 0 || li > levels) continue;
      const x = pos[q * 3] - fr.cx, z = pos[q * 3 + 2] - fr.cz; const j = angOf(x, z); const k2 = li * NA + j;
      capR[k2] = Math.max(capR[k2], Math.hypot(x, z));
    }
    const capAt = (l: number, j: number) => capR[l * NA + j] || capR[l * NA + ((j + 1) % NA)] || capR[l * NA + ((j - 1 + NA) % NA)];
    // borda da frente: atrás da orelha até o ombro; abaixo dele o cabelo se abre sobre os ombros (transição suave)
    const edgeAt = (y: number) => lerp(1.9, 1.15, smooth(shoulderY, shoulderY - 0.07, y));
    // corte em "U": as laterais mais curtas que as costas; pontas irregulares mecha a mecha
    const bottomAt = (phi: number) => yBottom + (1 - smooth(1.4, Math.PI, Math.abs(phi))) * 0.04 + wobble(phi * 1.9) * 0.012;
    const weights = (y: number) => {
      const wH = smooth(fr.chinY - 0.08, fr.chinY + 0.02, y), wS = 1 - smooth(shoulderY - 0.06, shoulderY + 0.02, y);
      si.push(headB, neckB, spine2, 0); sw.push(wH, Math.max(0, 1 - wH - wS), wS, 0);
    };
    // caimento: por fora do corpo com folga para a roupa (mais abaixo do pescoço), sem "prateleira" nos ombros — o fio
    // não dobra para fora mais rápido que 45° (antecipa o ombro) e, caindo, quase não volta para dentro
    const need = new Float32Array((levels + 1) * NA);
    for (let l = 0; l <= levels; l++) { const y = yStart - l * dy; const clr = lerp(0.012, 0.03, smooth(fr.chinY - 0.02, shoulderY + 0.02, y)); for (let j = 0; j < NA; j++) need[l * NA + j] = rBody[l * NA + j] + clr; }
    for (let j = 0; j < NA; j++) {
      for (let l = levels - 1; l >= 0; l--) need[l * NA + j] = Math.max(need[l * NA + j], need[(l + 1) * NA + j] - dy);
      for (let l = 1; l <= levels; l++) need[l * NA + j] = Math.max(need[l * NA + j], need[(l - 1) * NA + j] - dy * 0.12);
    }
    const vid = new Int32Array((levels + 1) * NA).fill(-1); const rIn = new Float32Array((levels + 1) * NA);
    for (let l = 0; l <= levels; l++) {
      const y = yStart - l * dy; const hang = smooth(yStart, yStart - 0.06, y);      // 0 junto da calota → 1 pendurado
      const W = outlineAt(hair.outline, CANON_FOREHEAD + (y - fr.y10) / k) * k;
      for (let j = 0; j < NA; j++) {
        const phi = (j / NA) * 2 * Math.PI - Math.PI; const ap = Math.abs(phi); const edge = edgeAt(y);
        const bot = bottomAt(phi);
        if (ap < edge || y < bot - dy) continue;                                   // rosto e peito livres; fim da mecha
        const sideness = Math.abs(Math.sin(phi)); const cap = capAt(l, j);
        const tip = smooth(bot + 0.05, bot, y);
        let r = Math.max(need[l * NA + j] + (0.004 + 0.008 * Math.max(0, hv - 1)) * hang, W ? lerp(fr.halfW + 0.012, W, sideness) * hang : 0, cap ? cap + 0.0015 : 0);
        r -= 0.006 * tip * (texture === "straight" ? 1 : 0.4);                       // pontas voltam para dentro
        if (texture === "wavy") r += Math.sin((yStart - y) * 90 + j * 0.3) * 0.004 * hang;
        if (texture === "curly" || coily) r += (0.006 + 0.012 * (l / levels)) * vol * hang + bump(Math.cos(phi), y, Math.sin(phi), 40) * 0.006;
        rIn[l * NA + j] = r; vid[l * NA + j] = pos.length / 3;
        pos.push(fr.cx + Math.sin(phi) * r, Math.max(y, bot), fr.cz + Math.cos(phi) * r);
        uv.push(((phi + Math.PI) / (2 * Math.PI)) * 10, (fr.headTop - y) / 0.25);
        weights(y);
        const edgeA = smooth(edge, edge + 0.18, ap);
        const topA = smooth(yStart, yStart - 0.03, y);                              // nasce transparente sobre a calota: sem emenda
        col.push(1, 1, 1, Math.min(1 - 0.8 * tip, 0.3 + 0.7 * edgeA, 0.25 + 0.75 * topA));
      }
    }
    for (let l = 0; l < levels; l++) for (let j = 0; j < NA; j++) {
      const j2 = (j + 1) % NA; const p = vid[l * NA + j], q = vid[l * NA + j2], r = vid[(l + 1) * NA + j], s2 = vid[(l + 1) * NA + j2];
      if (p >= 0 && q >= 0 && r >= 0 && s2 >= 0) index.push(p, r, q, q, r, s2);
      else if (p >= 0 && q >= 0 && r >= 0) index.push(p, r, q);
      else if (p >= 0 && q >= 0 && s2 >= 0) index.push(p, s2, q);
    }
    // mechas soltas por fora (faixas de 3–5 cm, comprimentos e caimentos diferentes): quebram a silhueta de "caixa" e
    // dão profundidade — o que se vê de lado e de costas passa a ser cabelo em camadas, não um painel
    // mechas soltas: só sem os fios (com eles, hair-strands.ts faz esse papel); cacho/crespo: o relevo já quebra a forma
    const cards = opts.base ? 0 : texture === "straight" || texture === "wavy" ? 70 : 0;
    for (let n = 0; n < cards; n++) {
      const h1 = hash(n), h2 = hash(n + 97), h3 = hash(n + 193);
      const phiC = (n % 2 ? 1 : -1) * (1.95 + (Math.PI - 1.95) * h1);
      // todas nascem coladas na cortina (sem borda de cima visível) e se soltam aos poucos; muda o comprimento
      const half = 0.007 + 0.007 * h2; const yTop = yStart - 0.02; const yEnd = bottomAt(phiC) + (h2 - 0.4) * 0.035 - 0.01 * h3;
      const j = Math.round(((phiC + Math.PI) / (2 * Math.PI)) * NA) % NA;
      let prev = -1;
      for (let y = yTop; y > yEnd - 1e-4; y -= dy) {
        const l = Math.min(levels, Math.max(0, Math.round((yStart - y) / dy))); const base = rIn[l * NA + j];
        if (!base) { prev = -1; continue; }
        const along = (yTop - y) / Math.max(0.01, yTop - yEnd); const tip = smooth(0.78, 1, along);
        const r = base + 0.0015 + (0.001 + 0.004 * h1) * smooth(0.05, 0.35, along);
        const sway = (texture === "wavy" ? Math.sin((yTop - y) * 80 + n) * 0.006 : Math.sin((yTop - y) * 14 + n) * 0.004) / r;
        const dphi = (half * (1 - 0.45 * tip)) / r; const i0 = pos.length / 3;
        for (const s0 of [-1, 1]) {
          const ph = phiC + sway + s0 * dphi;
          pos.push(fr.cx + Math.sin(ph) * r, y, fr.cz + Math.cos(ph) * r);
          uv.push(((ph + Math.PI) / (2 * Math.PI)) * 10 + n * 0.37, (fr.headTop - y) / 0.25);
          weights(y);
          col.push(1, 1, 1, (1 - 0.85 * tip) * (0.3 + 0.7 * smooth(0, 0.1, along)));
        }
        if (prev >= 0) index.push(prev, i0, prev + 1, prev + 1, i0, i0 + 1);
        prev = i0;
      }
    }
  }
  if (index.length < 30) return null;
  return { ...finish(pos, uv, col, si, sw, index, covered ? hair.cover! : hair.color!, texture, covered, !!opts.base), calotaIndex };
}

/** Alturas (cm, canônico) em que a silhueta ainda tem largura — a mais alta é o topo da cobertura. */
function HAIR_TOPS(outline: number[] | undefined): number[] {
  if (!outline?.length) return [SKULL_TOP + 2];
  const i = outline.findIndex((v) => v > 0); return i < 0 ? [SKULL_TOP + 2] : [16 - 2 * i + 1];
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useTex } from "@/components/three/common";
import { useI18n } from "@/lib/i18n/i18n";
import { fmtPriceShort } from "@/lib/i18n/money";
import { DustPuff, GoldDot, HangTag, pointer } from "./room-props";
import { ApprovedAsset } from "./approved-asset";

/*
 * Roupa pendurada de verdade (arara e guarda-roupa): cabide com o gancho no varão e a peça com volume, perpendicular
 * ao varão — de lado, uma ao lado da outra, como numa loja ou num closet. A silhueta vem do tipo da peça (camiseta,
 * manga longa, casaco, vestido, calça dobrada no cabide, saia, short), extrudada com a espessura do tecido no cabide e
 * pintada com a cor da peça (a média da foto quando não há cor gravada). A foto sem fundo vai nas duas faces: de frente
 * a peça aparece inteira; vista do corredor, é uma fatia colorida. Unidades em metros; origem no varão, y para baixo.
 */

export type HungKind = "top" | "longTop" | "coat" | "dress" | "pants" | "skirt" | "shorts" | "shelf";

/** Peça como o quarto a conhece (o mínimo para pendurar). */
export interface HungPiece { id: string; name?: string; category?: string | null; subcategory?: string | null; colorHex?: string | null; imageUrl?: string | null; thumbnailUrl?: string | null; states?: string[]; salePrice?: number | null }
/** O que a peça pendurada precisa da cena: destaque, clique, movimento reduzido, etiquetas e o cabide da loja. */
export interface HungCtx {
  highlight: string | null; onPick: (id: string) => void; reduced: boolean; tagged: Set<string>;
  hanger?: THREE.MeshStandardMaterialParameters; hangerModel?: string | null; engine?: { hidden: Set<string> };
}

const SHORT_TOP = /t_?shirt|camiseta|tee\b|tank|regata|crop|polo|bodysuit|^body/;
const LONG = /long|manga_longa|camisa|shirt|blusa_manga|sweater|sueter|moletom|hoodie|sweatshirt|cardigan|tricot/;
const COAT = /coat|casaco|parka|trench|sobretudo|blazer|jaqueta|jacket|windbreaker|corta_vento|kimono|quimono/;
const DRESS = /vestido|dress|macac|jumpsuit|romper|jardineira|conjunto/;
const SKIRT = /saia|skirt/;
const SHORTS = /short|bermuda/;

/** Como a peça vai para a arara: pelo tipo gravado (categoria e subcategoria), nunca pelo nome. */
export function hungKindOf(p: Pick<HungPiece, "category" | "subcategory">): HungKind {
  const c = (p.category ?? "").toLowerCase(), s = (p.subcategory ?? "").toLowerCase();
  if (/shoe|calcad|accessor|acessor|bag|bolsa/.test(c)) return "shelf";
  if (c.startsWith("full_body") || DRESS.test(s)) return "dress";
  if (c.startsWith("lower") || /calca|pants|jeans|legging|jogger|chino|cargo/.test(s) || SKIRT.test(s) || SHORTS.test(s)) {
    return SKIRT.test(s) ? "skirt" : SHORTS.test(s) ? "shorts" : "pants";
  }
  if (COAT.test(s)) return "coat";
  return !SHORT_TOP.test(s) && LONG.test(s) ? "longTop" : "top";
}

/** Comprimento natural no cabide (m): a calça vai dobrada sobre a barra; o casaco é o mais longo. */
export const HUNG_LENGTH: Record<Exclude<HungKind, "shelf">, number> = { top: 0.62, longTop: 0.68, coat: 0.86, dress: 0.95, pants: 0.56, skirt: 0.58, shorts: 0.4 };
/** Espessura da peça pendurada (m): frente + costas sem corpo dentro; malha e casaco ficam mais encorpados. */
export const HUNG_DEPTH: Record<Exclude<HungKind, "shelf">, number> = { top: 0.058, longTop: 0.068, coat: 0.09, dress: 0.058, pants: 0.06, skirt: 0.05, shorts: 0.052 };

/**
 * Volume da peça vista de lado (a espessura vira um perfil, não uma placa): mais cheia nos ombros, onde o cabide abre o
 * tecido, afinando até a barra — vestido e saia abrem embaixo —, com dobras verticais suaves que crescem para a barra.
 * `t` = 0 no cabide e 1 na barra; `x` ao longo da largura da peça. Devolve o fator da espessura naquele ponto.
 */
export function hungProfile(kind: Exclude<HungKind, "shelf">, t: number, x: number): number {
  const u = Math.min(1, Math.max(0, t));
  const flare = kind === "dress" || kind === "skirt";
  const body = flare ? 0.85 + 0.75 * u * u : 1 - 0.4 * u + 0.28 * Math.exp(-((u - 0.1) ** 2) / 0.012);
  return body;
}

/**
 * Dobras do pano pendurado (m, deslocamento para fora do plano): ondas verticais que nascem estreitas no cabide e
 * abrem e aprofundam até a barra, com fase própria de cada peça (`seed`) — o tecido cai, não é uma placa.
 */
export function clothFolds(t: number, x: number, seed = 0): number {
  const u = Math.min(1, Math.max(0, t)), spread = 0.55 + 0.45 * u;
  return (0.004 + 0.013 * u) * Math.sin((x / spread) * 58 + seed * 6.28 + u * 1.7) + 0.003 * u * Math.sin((x / spread) * 23 + seed * 3.1);
}

/**
 * Silhueta da peça no cabide (frente), no plano xy: x de −meia largura a +meia largura, y de 0 (barra do cabide) para
 * baixo até −`length`. Camiseta com manga curta aberta; manga longa caindo junto ao corpo; calça/saia/short presas na
 * barra; vestido abrindo para a barra.
 */
export function hungShape(kind: Exclude<HungKind, "shelf">, length = HUNG_LENGTH[kind]): THREE.Shape {
  const s = new THREE.Shape(), L = -length;
  const path = (pts: [number, number][]) => { s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); s.closePath(); return s; };
  switch (kind) {
    case "top":
      return path([[-0.06, -0.02], [-0.2, -0.055], [-0.27, -0.17], [-0.215, -0.205], [-0.195, L + 0.01], [-0.18, L], [0.18, L], [0.195, L + 0.01], [0.215, -0.205], [0.27, -0.17], [0.2, -0.055], [0.06, -0.02], [0, -0.06]]);
    case "longTop": case "coat": {
      const w = kind === "coat" ? 0.23 : 0.2, cuff = Math.max(L + 0.04, -0.6);
      return path([[-0.06, -0.02], [-w, -0.06], [-w - 0.05, -0.12], [-w - 0.04, cuff], [-w + 0.01, cuff - 0.01], [-w + 0.005, L], [w - 0.005, L], [w - 0.01, cuff - 0.01], [w + 0.04, cuff], [w + 0.05, -0.12], [w, -0.06], [0.06, -0.02], [0, kind === "coat" ? -0.16 : -0.07]]);
    }
    case "dress":
      return path([[-0.05, -0.02], [-0.15, -0.05], [-0.16, -0.3], [-0.13, -0.42], [-0.27, L], [0.27, L], [0.13, -0.42], [0.16, -0.3], [0.15, -0.05], [0.05, -0.02]]);
    case "skirt":
      return path([[-0.17, -0.03], [-0.26, L], [0.26, L], [0.17, -0.03]]);
    case "shorts":
      return path([[-0.2, -0.03], [-0.22, L], [-0.03, L], [0, L + 0.1], [0.03, L], [0.22, L], [0.2, -0.03]]);
    default: // calça dobrada sobre a barra do cabide: as duas pernas juntas, com a divisa no fim
      return path([[-0.17, -0.03], [-0.18, L], [-0.01, L], [0, L + 0.06], [0.01, L], [0.18, L], [0.17, -0.03]]);
  }
}

/** Cor média dos pixels opacos da foto (24 × 24); null se a imagem não puder ser lida (CORS) ou não tiver tecido. */
export function averageColor(image: CanvasImageSource): string | null {
  try {
    const c = document.createElement("canvas"); c.width = 24; c.height = 24; const g = c.getContext("2d"); if (!g) return null;
    g.drawImage(image, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (n < 12) return null;
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(gg)}${hex(b)}`;
  } catch { return null; }
}

function useFabricColor(tex: THREE.Texture | null, fallback?: string | null): string {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => { setColor(tex?.image ? averageColor(tex.image as CanvasImageSource) : null); }, [tex]);
  return fallback ?? color ?? "#c9c4bb";
}

/**
 * Cabide: gancho no varão, pescoço e braços na linha do ombro; a calça ganha a barra de baixo. O cabide comprado na
 * loja (módulo "hangers", RF39) troca o desenho pelo modelo aprovado, no mesmo tamanho.
 */
function Hanger({ kind, finish, gold, modelUrl }: { kind: Exclude<HungKind, "shelf">; finish?: THREE.MeshStandardMaterialParameters; gold?: boolean; modelUrl?: string | null }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(gold ? { color: "#C9A227", metalness: 0.9, roughness: 0.25 } : { color: finish?.color ?? "#8a6a4a", metalness: finish?.metalness ?? 0.15, roughness: finish?.roughness ?? 0.55 }), [gold, finish?.color, finish?.metalness, finish?.roughness]);
  const bottom = kind === "pants" || kind === "skirt" || kind === "shorts";
  const drawn = (
    <group>
      <mesh position={[0, 0.03, 0]} material={mat}><torusGeometry args={[0.022, 0.0035, 8, 18, Math.PI * 1.35]} /></mesh>
      <mesh position={[0, 0.0, 0]} material={mat}><cylinderGeometry args={[0.0035, 0.0035, 0.03, 6]} /></mesh>
      {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.1, -0.04, 0]} rotation={[0, 0, sd * 1.32]} material={mat}><cylinderGeometry args={[0.006, 0.006, 0.21, 8]} /></mesh>)}
      {bottom && <mesh position={[0, -0.065, 0]} rotation={[0, 0, Math.PI / 2]} material={mat}><cylinderGeometry args={[0.005, 0.005, 0.38, 8]} /></mesh>}
    </group>
  );
  // o desenho fica enquanto o modelo aprovado carrega (ou se ele falhar)
  return modelUrl && !gold ? <ApprovedAsset url={modelUrl} size={[0.42, 0.17, 0.04]} centered>{drawn}</ApprovedAsset> : drawn;
}

/** Giro próprio da peça no varão (rad, ±0,17), estável por peça: a fileira não fica "perfeita" demais. */
export function hangJitter(id: string): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.34;
}

/**
 * Peça pendurada no varão (origem no varão). `along` é o eixo do varão no espaço do pai: a peça fica perpendicular a
 * ele, com um pequeno giro próprio (`jitter`, rad) como nas araras de verdade. `maxLength` encurta peças longas que
 * bateriam no fundo do vão (a dobra fica no cabide).
 */
export function HungGarment({ p, ctx, along = "x", jitter = 0, maxLength = Infinity, swingKey = 0 }: { p: HungPiece; ctx: HungCtx; along?: "x" | "z"; jitter?: number; maxLength?: number; swingKey?: number }) {
  const { t } = useI18n();
  const kind = hungKindOf(p); const hung = kind === "shelf" ? "top" : kind;
  const length = Math.min(HUNG_LENGTH[hung], maxLength), depth = HUNG_DEPTH[hung];
  const url = p.imageUrl ?? p.thumbnailUrl;
  const tex = useTex(url);
  const forgotten = !!p.states?.includes("ESQUECIDA");
  const color = useFabricColor(tex, p.colorHex);
  const cloth = useMemo(() => buildCloth(hung, length, depth, tex, hangJitter(p.id) + 0.5), [hung, length, depth, tex, p.id]);
  useEffect(() => () => cloth.dispose(), [cloth]);
  const highlight = ctx.highlight === p.id;
  const swing = useRef<THREE.Group>(null); const start = useRef(-1); const [puff, setPuff] = useState(0);
  useEffect(() => { if (swingKey) start.current = performance.now(); }, [swingKey]);
  useEffect(() => { cloth.front.color.set(forgotten ? "#b9b4aa" : cloth.photo ? "#ffffff" : color); cloth.back.color.set(forgotten ? "#a9a49b" : color); cloth.setSheen(color); }, [cloth, color, forgotten]);
  useFrame(({ clock }) => {
    CLOTH_TIME.value = clock.elapsedTime; CLOTH_SWAY.value = ctx.reduced ? 0 : 1;
    const glow = highlight ? 0.22 + 0.15 * Math.sin(clock.elapsedTime * 4) : 0; cloth.front.emissiveIntensity = glow; cloth.back.emissiveIntensity = glow;
    if (!swing.current) return;
    const s = start.current < 0 ? 99 : (performance.now() - start.current) / 1000;
    swing.current.rotation.x = s < 1.8 && !ctx.reduced ? Math.sin(s * 9) * 0.14 * Math.exp(-s * 2.2) : 0;   // balança no gancho e para
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); start.current = performance.now();
    if (forgotten && !ctx.reduced) { setPuff((x) => x + 1); setTimeout(() => ctx.onPick(p.id), 380); } else ctx.onPick(p.id);
  };
  const yaw = (along === "x" ? Math.PI / 2 : 0) + jitter;
  return (
    <group rotation={[0, yaw, 0]} visible={!ctx.engine?.hidden.has(p.id)} name={`hung-${p.id}`}>
      <group ref={swing}>
        <Hanger kind={hung} finish={ctx.hanger} gold={p.states?.includes("FAVORITA")} modelUrl={ctx.hangerModel} />
        <mesh geometry={cloth.frontGeo} material={cloth.front} castShadow receiveShadow onClick={click} {...pointer} />
        <mesh geometry={cloth.backGeo} material={cloth.back} castShadow receiveShadow onClick={click} {...pointer} />
        <group position={[0, -0.12, 0]}><DustPuff trigger={puff} reduced={ctx.reduced} /></group>
        {p.states?.includes("30_USOS") && <GoldDot position={[cloth.width / 2 - 0.03, -0.08, depth / 2 + 0.012]} />}
        {highlight && <pointLight position={[0, -length / 2, 0.35]} intensity={1.4} distance={1.1} color="#ffe6a0" />}
      </group>
      {/* etiquetas no gancho, de frente para quem olha a fileira */}
      <group rotation={[0, -yaw, 0]} position={[0, -0.1, 0]}>
        {p.salePrice != null && <HangTag text={fmtPriceShort(Number(p.salePrice), "BRL", 0)} position={[0.03, -0.02, 0.05]} />}
        {ctx.tagged.has(p.id) && <HangTag text={t("room3d.roomScene.n2_chance")} color="#fde2e4" fg="#9d174d" position={[-0.03, -0.12, 0.05]} />}
        {p.states?.includes("GARIMPO") && <HangTag text={t("common.garimpo")} color="#1F7A76" fg="#fff" position={[0.02, -0.22, 0.05]} w={0.11} />}
      </group>
    </group>
  );
}

/** Tempo e intensidade do balanço do pano, um só para todas as peças (um programa de shader para todas). */
const CLOTH_TIME = { value: 0 }, CLOTH_SWAY = { value: 1 };

/** Trama fina do tecido como mapa de normais (fios alternados, como tela), compartilhada por todas as peças. */
let weaveTex: THREE.Texture | null = null;
function weave(): THREE.Texture | null {
  if (weaveTex || typeof document === "undefined") return weaveTex;
  const n = 64, c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"); if (!g) return null;
  const img = g.createImageData(n, n), hgt = (x: number, y: number) => {
    const u = ((x % n) + n) % n, v = ((y % n) + n) % n, over = (Math.floor(u / 4) + Math.floor(v / 4)) % 2 === 0;
    return over ? Math.sin((u % 4) / 4 * Math.PI) : Math.sin((v % 4) / 4 * Math.PI) * 0.8;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1), k = (y * n + x) * 4;
    const nx = -dx * 0.6, ny = -dy * 0.6, nz = 1, l = Math.hypot(nx, ny, nz);
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  weaveTex = new THREE.CanvasTexture(c); weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping; weaveTex.repeat.set(9, 14);
  return weaveTex;
}

/** Máscara de dentro/fora da peça numa grade (true = tecido) e a distância (m) de cada nó até a borda. */
function insideGrid(nx: number, ny: number, w: number, h: number, inside: (u: number, v: number) => boolean) {
  const cols = nx + 1, rows = ny + 1, inn = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) inn[j * cols + i] = inside(i / nx, j / ny) ? 1 : 0;
  const dist = new Float32Array(cols * rows), cw = w / nx, ch = h / ny;
  for (let k = 0; k < inn.length; k++) {
    if (!inn[k]) continue;
    const i0 = k % cols, j0 = Math.floor(k / cols); let best = Math.min(i0 * cw, (nx - i0) * cw, j0 * ch, (ny - j0) * ch);
    for (let q = 0; q < inn.length; q++) if (!inn[q]) { const d = Math.hypot((q % cols - i0) * cw, (Math.floor(q / cols) - j0) * ch); if (d < best) best = d; }
    dist[k] = best;
  }
  return dist;
}

/** Alfa da foto amostrado (leitura do canvas; null se a imagem não puder ser lida) e a caixa do tecido na imagem. */
function photoAlpha(image: CanvasImageSource): { at: (u: number, v: number) => number; box: { x0: number; y0: number; x1: number; y1: number } } | null {
  try {
    const W = 96, H = 96, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); if (!g) return null;
    g.drawImage(image, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 96) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    return { at: (u, v) => d[(Math.min(H - 1, Math.max(0, Math.round(v * (H - 1)))) * W + Math.min(W - 1, Math.max(0, Math.round(u * (W - 1))))) * 4 + 3] / 255, box: { x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H } };
  } catch { return null; }
}

/** Ponto dentro do polígono (contorno da silhueta), par-ímpar. */
function inPolygon(pts: THREE.Vector2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Monta o pano: duas folhas (frente e costas) numa grade fina, afastadas pela espessura da peça e coladas na borda
 * (a costura), com as dobras da queda. Com foto, o contorno é o da foto (recorte e caixa lidos do alfa) e a frente leva
 * a foto; as costas ficam na cor do tecido. Sem foto, a silhueta do tipo vira a máscara.
 */
function buildCloth(kind: Exclude<HungKind, "shelf">, length: number, depth: number, tex: THREE.Texture | null, seed: number) {
  const nx = 22, ny = 34;
  const alpha = tex?.image ? photoAlpha(tex.image as CanvasImageSource) : null;
  // caixa do tecido na foto (calça dobrada: a metade de cima)
  const box = alpha?.box ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  const crop = kind === "pants" && alpha ? { ...box, y1: box.y0 + (box.y1 - box.y0) * 0.55 } : box;
  const outline = hungShape(kind, length).getSpacedPoints(120), sb = new THREE.Box2().setFromPoints(outline);
  const aspect = alpha ? ((crop.x1 - crop.x0) * (tex!.image as { width: number }).width) / Math.max(1, (crop.y1 - crop.y0) * (tex!.image as { height: number }).height) : (sb.max.x - sb.min.x) / Math.max(0.01, sb.max.y - sb.min.y);
  const height = length, width = Math.min(0.62, Math.max(0.28, height * aspect));
  const inside = alpha
    ? (u: number, v: number) => alpha.at(crop.x0 + u * (crop.x1 - crop.x0), crop.y0 + v * (crop.y1 - crop.y0)) > 0.4
    : (u: number, v: number) => inPolygon(outline, sb.min.x + u * (sb.max.x - sb.min.x), sb.max.y - v * (sb.max.y - sb.min.y));
  const dist = insideGrid(nx, ny, width, height, inside);
  const make = (side: 1 | -1) => {
    const g = new THREE.PlaneGeometry(width, height, nx, ny); g.translate(0, -height / 2, 0);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const i = k % (nx + 1), j = Math.floor(k / (nx + 1)), x = pos.getX(k), y = pos.getY(k), tt = -y / height;
      const edge = THREE.MathUtils.smoothstep(dist[j * (nx + 1) + i], 0, 0.05);
      pos.setZ(k, edge * (side * (depth / 2) * hungProfile(kind, tt, x) + clothFolds(tt, x, seed)));
      if (alpha) uv.setXY(k, crop.x0 + (i / nx) * (crop.x1 - crop.x0), 1 - (crop.y0 + (j / ny) * (crop.y1 - crop.y0)));
    }
    if (side < 0) { const idx = g.index!; for (let q = 0; q < idx.count; q += 3) { const a = idx.getX(q + 1); idx.setX(q + 1, idx.getX(q + 2)); idx.setX(q + 2, a); } }
    g.computeVertexNormals(); return g;
  };
  // sem foto: a silhueta desenhada num canvas é a máscara de recorte das duas folhas
  let mask: THREE.Texture | null = null;
  if (!alpha && typeof document !== "undefined") {
    const c = document.createElement("canvas"); c.width = 128; c.height = 192; const g2 = c.getContext("2d");
    if (g2) {
      g2.fillStyle = "#000"; g2.fillRect(0, 0, 128, 192); g2.fillStyle = "#fff"; g2.filter = "blur(1.2px)"; g2.beginPath();   // borda macia: o recorte (alphaTest) sai liso
      outline.forEach((q, n) => { const px = ((q.x - sb.min.x) / (sb.max.x - sb.min.x)) * 128, py = ((sb.max.y - q.y) / (sb.max.y - sb.min.y)) * 192; if (n) g2.lineTo(px, py); else g2.moveTo(px, py); });
      g2.closePath(); g2.fill(); mask = new THREE.CanvasTexture(c);
    }
  }
  const material = (front: boolean) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: front && alpha ? tex : null, alphaMap: alpha ? null : mask, alphaTest: 0.4, transparent: false,
      roughness: 0.92, metalness: 0, sheen: 0.75, sheenRoughness: 0.7, normalMap: weave(), normalScale: new THREE.Vector2(0.32, 0.32),
      emissive: new THREE.Color("#ffd54a"), emissiveIntensity: 0,
    });
    if (!front && alpha) { m.map = tex; }   // costas: o mesmo recorte da foto, tingido com a cor do tecido (sem estampa inventada)
    m.customProgramCacheKey = () => `hung-cloth-${front}-${!!alpha}`;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uClothTime = CLOTH_TIME; shader.uniforms.uClothSway = CLOTH_SWAY; shader.uniforms.uClothH = { value: height };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uClothTime; uniform float uClothSway; uniform float uClothH;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nfloat clothT = clamp(-position.y / uClothH, 0.0, 1.0);\ntransformed.z += sin(uClothTime * 1.6 + position.y * 7.0 + position.x * 4.0) * 0.004 * clothT * clothT * uClothSway;\ntransformed.x += sin(uClothTime * 1.1 + position.y * 4.0) * 0.0025 * clothT * uClothSway;");
      if (!front && alpha) shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = diffuse;");
    };
    return m;
  };
  const front = material(true), back = material(false), frontGeo = make(1), backGeo = make(-1);
  return {
    front, back, frontGeo, backGeo, width, photo: !!alpha,
    setSheen: (hex: string) => { const c = new THREE.Color(hex).lerp(new THREE.Color("#ffffff"), 0.35); front.sheenColor.copy(c); back.sheenColor.copy(c); },
    dispose: () => { front.dispose(); back.dispose(); frontGeo.dispose(); backGeo.dispose(); mask?.dispose(); },
  };
}

/** Sapato ou acessório na prateleira da arara: par de sapatos (ou a peça) com a cor da peça e a foto por cima. */
export function ShelfPiece({ p, ctx, position }: { p: HungPiece; ctx: HungCtx; position: [number, number, number] }) {
  const tex = useTex(p.imageUrl ?? p.thumbnailUrl); const color = useFabricColor(tex, p.colorHex);
  const shoe = /shoe|calcad/.test((p.category ?? "").toLowerCase());
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); ctx.onPick(p.id); };
  return (
    <group position={position} visible={!ctx.engine?.hidden.has(p.id)} name={`shelf-${p.id}`} onClick={click} {...pointer}>
      {shoe ? [-0.055, 0.055].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <RoundedBox args={[0.09, 0.07, 0.25]} radius={0.025} position={[0, 0.035, 0]} castShadow><meshStandardMaterial color={color} roughness={0.7} /></RoundedBox>
          <mesh position={[0, 0.006, 0]}><boxGeometry args={[0.095, 0.012, 0.26]} /><meshStandardMaterial color="#f4f1ea" roughness={0.6} /></mesh>
        </group>
      )) : <RoundedBox args={[0.24, 0.16, 0.12]} radius={0.03} position={[0, 0.08, 0]} castShadow><meshStandardMaterial color={color} roughness={0.75} /></RoundedBox>}
      {tex && <mesh position={[0, shoe ? 0.075 : 0.165, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[shoe ? 0.18 : 0.2, shoe ? 0.2 : 0.1]} /><meshStandardMaterial map={tex} transparent alphaTest={0.12} /></mesh>}
    </group>
  );
}

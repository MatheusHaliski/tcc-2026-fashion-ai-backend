/*
 * Provador — acessórios em 2D sobre a foto (Fase 1 do plano por categoria): o FASHN veste roupa, não acessório. Óculos,
 * chapéus, brincos, colar, gravata, relógio, pulseira e bolsas vão por cima da foto (a gerada pela GPU ou a enviada),
 * posicionados pelos pontos do rosto (MediaPipe Face Landmarker, 478 pontos) e do corpo (Pose Landmarker, 33 pontos)
 * detectados no próprio navegador. É uma prévia aproximada: não mostra caimento, oclusão nem tamanho real.
 * Tudo aqui é puro (sem DOM): recebe pontos normalizados e devolve onde desenhar, em fração da imagem.
 */
import type { Landmark } from "@/lib/avatar3d/geometry";
import type { PosePoint } from "@/lib/avatar3d/body";

export type AnchorKind = "eyes" | "head" | "ears" | "neck" | "wrist" | "hip" | "hand";

/** Subcategoria → onde vai no corpo e a largura relativa à medida de referência (rosto, ombros ou antebraço). */
const SPEC: Record<string, { kind: AnchorKind; scale: number }> = {
  sunglasses: { kind: "eyes", scale: 1.55 }, eyeglasses: { kind: "eyes", scale: 1.5 },
  cap: { kind: "head", scale: 1.2 }, hat: { kind: "head", scale: 1.65 }, beanie: { kind: "head", scale: 1.12 },
  hair_accessory: { kind: "head", scale: 0.55 },
  earrings: { kind: "ears", scale: 0.13 },
  necklace: { kind: "neck", scale: 0.42 }, scarf: { kind: "neck", scale: 0.72 }, tie: { kind: "neck", scale: 0.13 },
  bow_tie: { kind: "neck", scale: 0.2 },
  watch: { kind: "wrist", scale: 0.42 }, bracelet: { kind: "wrist", scale: 0.4 },
  handbag: { kind: "hip", scale: 0.55 }, tote_bag: { kind: "hip", scale: 0.7 }, crossbody_bag: { kind: "hip", scale: 0.45 },
  clutch: { kind: "hand", scale: 0.4 },
};

/** Acessórios que a prévia 2D sabe posicionar; o resto (cinto, anel, carteira, luvas, meias, mochila) fica de fora. */
export const ACCESSORY_2D = Object.keys(SPEC);
export const accessoryKind = (subcategory?: string | null): AnchorKind | null => SPEC[subcategory ?? ""]?.kind ?? null;

/** Centro (x, y), largura (w) em fração da imagem e giro em graus; uma peça pode ter mais de um lugar (um brinco por orelha). */
export interface Placement { x: number; y: number; w: number; rotate: number }
export interface Detected { face: Landmark[] | null; pose: PosePoint[] | null }
interface Px { x: number; y: number }

const seen = (p: PosePoint | undefined, min = 0.5) => !!p && (p.visibility ?? 1) >= min && p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1;
const deg = (a: Px, b: Px) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const dist = (a: Px, b: Px) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Px, b: Px, t: number): Px => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Onde desenhar o acessório. `width`/`height` são da foto (para medir em pixels, não em fração) e `aspect` é altura/largura
 * da imagem do acessório. Devolve [] quando os pontos de que ele precisa não foram vistos (rosto virado, braço fora da foto).
 */
export function placeAccessory(subcategory: string | null | undefined, found: Detected, width: number, height: number, aspect = 1): Placement[] {
  const spec = SPEC[subcategory ?? ""];
  if (!spec || width <= 0 || height <= 0) return [];
  const px = (p: { x: number; y: number }): Px => ({ x: p.x * width, y: p.y * height });
  const out = (center: Px, w: number, rotate: number): Placement => ({ x: center.x / width, y: center.y / height, w: w / width, rotate });
  // empurra o centro meia altura ao longo do "para baixo" da peça girada: assim o ponto de apoio fica na borda de cima
  const below = (top: Px, w: number, rotate: number, t = 0.5): Px => {
    const r = (rotate * Math.PI) / 180; const h = w * aspect * t;
    return { x: top.x - Math.sin(r) * h, y: top.y + Math.cos(r) * h };
  };
  const f = found.face; const pose = found.pose;

  if (spec.kind === "eyes" || spec.kind === "head" || spec.kind === "ears") {
    if (!f || f.length < 468) return [];
    const eyeL = px(f[33]); const eyeR = px(f[263]); const tilt = deg(eyeL, eyeR);
    const faceW = dist(px(f[234]), px(f[454]));
    if (spec.kind === "eyes") {
      const w = dist(eyeL, eyeR) * spec.scale;
      // um pouco acima da linha dos cantos dos olhos, na direção da ponte do nariz
      return [out(lerp(lerp(eyeL, eyeR, 0.5), px(f[168]), 0.25), w, tilt)];
    }
    if (spec.kind === "head") {
      const w = faceW * spec.scale;
      const brow = lerp(px(f[10]), px(f[168]), subcategory === "beanie" || subcategory === "cap" ? 0.3 : 0.15);
      // a borda de baixo do chapéu na testa: o centro sobe meia altura (o giro acompanha a cabeça)
      const r = (tilt * Math.PI) / 180; const h = w * aspect * 0.5;
      const center = subcategory === "hair_accessory"
        ? lerp(px(f[10]), px(f[338]), 0.6)
        : { x: brow.x + Math.sin(r) * h, y: brow.y - Math.cos(r) * h };
      return [out(center, w, tilt)];
    }
    // brincos: o lóbulo fica logo abaixo do fim da mandíbula perto da orelha (o Face Landmarker não marca a orelha)
    const w = faceW * spec.scale;
    return [[f[234], f[132]], [f[454], f[361]]].map(([ear, jaw]) => {
      const lobe = lerp(px(ear), px(jaw), 0.75);
      return out(below(lobe, w, tilt), w, tilt);
    });
  }

  if (!pose || pose.length < 25) return [];
  const sL = pose[11]; const sR = pose[12];
  if (!seen(sL) || !seen(sR)) return [];
  const shoulderL = px(sL); const shoulderR = px(sR); const shoulders = dist(shoulderL, shoulderR);
  const mid = lerp(shoulderL, shoulderR, 0.5);

  if (spec.kind === "neck") {
    if (!f || f.length < 468) return [];
    // giro pela linha dos ombros, sempre da esquerda para a direita da imagem (de frente ou de costas)
    const chin = px(f[152]); const tilt = shoulderL.x < shoulderR.x ? deg(shoulderL, shoulderR) : deg(shoulderR, shoulderL);
    const at = subcategory === "necklace" ? 0.45 : subcategory === "scarf" ? 0.4 : 0.55;
    const w = shoulders * spec.scale;
    return [out(below(lerp(chin, mid, at), w, tilt), w, tilt)];
  }

  // lado com o braço mais visível; na foto de frente o lado esquerdo da pessoa fica à direita da imagem
  const side = (left: number, right: number) => ((pose[left]?.visibility ?? 0) >= (pose[right]?.visibility ?? 0) ? left : right);

  if (spec.kind === "wrist") {
    const wrist = side(15, 16); const elbow = wrist === 15 ? 13 : 14;
    if (!seen(pose[wrist]) || !seen(pose[elbow])) return [];
    const a = px(pose[elbow]); const b = px(pose[wrist]);
    // largura pela medida do antebraço; a pulseira fica atravessada no braço, um pouco antes do pulso
    return [out(lerp(a, b, 0.9), dist(a, b) * spec.scale, deg(a, b) - 90)];
  }

  if (spec.kind === "hand") {
    const wrist = side(15, 16); const index = wrist === 15 ? 19 : 20;
    if (!seen(pose[wrist])) return [];
    const hand = seen(pose[index], 0.3) ? lerp(px(pose[wrist]), px(pose[index]), 0.6) : px(pose[wrist]);
    return [out(hand, shoulders * spec.scale, 0)];
  }

  // bolsa no quadril, do lado do ombro mais visível, um pouco para fora do corpo
  const hipIndex = side(23, 24); const shoulder = hipIndex === 23 ? shoulderL : shoulderR;
  if (!seen(pose[hipIndex])) return [];
  const hip = px(pose[hipIndex]); const outward = Math.sign(shoulder.x - mid.x) || 1;
  const w = shoulders * spec.scale;
  const top = { x: hip.x + outward * shoulders * 0.32, y: hip.y - dist(shoulder, hip) * 0.12 };
  return [out(below(top, w, 0), w, 0)];
}

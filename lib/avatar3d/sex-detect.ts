/*
 * Avatar 3D (RF40) — sexo do corpo base estimado pelo rosto, no próprio aparelho (a foto não sai do navegador):
 * a rede de idade/sexo do @vladmandic/face-api (MIT; TinyXception treinada com rostos alinhados em 112×112).
 *
 *   recorte — o mesmo que o face-api usa (caixa mínima do contorno do rosto, das sobrancelhas e do queixo + 20%),
 *             montado com os pontos do MediaPipe e com a cabeça endireitada (sem a inclinação lateral);
 *   média   — a foto e o espelho dela: a rede erra menos quando olha as duas metades do rosto dos dois lados;
 *   uso     — abaixo de SEX_CONFIDENT de certeza vale o sexo do cadastro; a pessoa sempre pode trocar o corpo base.
 *
 * Só escolhe o corpo base (proporções de referência e o cabelo que se supõe quando a foto não mostra). Não é gravado
 * como dado da pessoa e não aparece em lugar nenhum além da prévia do avatar.
 */
import type { Sex } from "./body-spec";

type Pt = [number, number];

export interface SexGuess { sex: Sex; confidence: number; pMale: number; age: number }
/** Certeza mínima para a estimativa valer sozinha (sem ela, o sexo do cadastro). */
export const SEX_CONFIDENT = 0.7;

const MODEL_URL = "/mediapipe/face-api";
// contorno do rosto do nível dos olhos até o queixo (os pontos 0–16 do padrão de 68), sobrancelhas (17–26) e queixo
const JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
const BROWS = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const EYE_L = [33, 133], EYE_R = [362, 263];

type FaceApi = typeof import("@vladmandic/face-api");
let netP: Promise<FaceApi> | null = null;
function net(): Promise<FaceApi> {
  if (!netP) netP = import("@vladmandic/face-api").then(async (fa) => { await fa.nets.ageGenderNet.loadFromUri(MODEL_URL); return fa; });
  return netP;
}

/** Caixa do rosto no referencial da cabeça endireitada: centro de giro, ângulo e retângulo (x, y, largura, altura). */
export function faceBox(px: Pt[]): { cx: number; cy: number; angle: number; x: number; y: number; w: number; h: number } {
  const mid = (ids: number[]) => ids.reduce((a, i) => [a[0] + px[i][0] / ids.length, a[1] + px[i][1] / ids.length], [0, 0]);
  const l = mid(EYE_L), r = mid(EYE_R);
  const angle = Math.atan2(r[1] - l[1], r[0] - l[0]);
  const cx = (l[0] + r[0]) / 2, cy = (l[1] + r[1]) / 2; const c = Math.cos(-angle), s = Math.sin(-angle);
  const pts = [...JAW, ...BROWS].map((i) => { const dx = px[i][0] - cx, dy = px[i][1] - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; });
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const w = x1 - x0, h = y1 - y0;
  return { cx, cy, angle, x: x0 - w * 0.1, y: y0 - h * 0.1, w: w * 1.2, h: h * 1.2 };
}

function crop(src: HTMLCanvasElement, px: Pt[], mirror: boolean): HTMLCanvasElement {
  const b = faceBox(px); const k = 160 / Math.max(b.w, b.h);
  const out = document.createElement("canvas"); out.width = Math.max(8, Math.round(b.w * k)); out.height = Math.max(8, Math.round(b.h * k));
  const g = out.getContext("2d")!; g.imageSmoothingQuality = "high";
  if (mirror) { g.translate(out.width, 0); g.scale(-1, 1); }
  g.scale(k, k); g.translate(-b.x, -b.y); g.translate(b.cx, b.cy); g.rotate(-b.angle); g.translate(-b.cx, -b.cy);
  g.drawImage(src, 0, 0);
  return out;
}

/** Combina as previsões (probabilidade de "masculino" e idade) da foto e do espelho. */
export function combine(preds: { pMale: number; age: number }[]): SexGuess | null {
  const ok = preds.filter((p) => Number.isFinite(p.pMale));
  if (!ok.length) return null;
  const pMale = ok.reduce((a, p) => a + p.pMale, 0) / ok.length; const age = ok.reduce((a, p) => a + p.age, 0) / ok.length;
  return { sex: pMale >= 0.5 ? "MASCULINO" : "FEMININO", confidence: +Math.max(pMale, 1 - pMale).toFixed(3), pMale: +pMale.toFixed(3), age: Math.round(age) };
}

/** Sexo estimado pelo rosto (px: os pontos do MediaPipe em pixels da imagem). null se o modelo não carregar. */
export async function detectSex(src: HTMLCanvasElement, px: Pt[]): Promise<SexGuess | null> {
  try {
    const fa = await net();
    const preds: { pMale: number; age: number }[] = [];
    for (const mirror of [false, true]) {
      const r = await fa.nets.ageGenderNet.predictAgeAndGender(crop(src, px, mirror)) as { age: number; gender: string; genderProbability: number };
      preds.push({ pMale: r.gender === "male" ? r.genderProbability : 1 - r.genderProbability, age: r.age });
    }
    return combine(preds);
  } catch { return null; }
}

/** Sexo do corpo base: a estimativa pelo rosto quando segura; senão o do cadastro; sem os dois, a estimativa. */
export function bodySex(guess: SexGuess | null, profile: Sex | null | undefined): Sex {
  if (guess && guess.confidence >= SEX_CONFIDENT) return guess.sex;
  return profile ?? guess?.sex ?? "FEMININO";
}

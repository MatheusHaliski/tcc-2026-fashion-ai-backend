/*
 * Avatar 3D (RF40) — filtro de qualidade das fotos. Regra: quando a foto não tem informação suficiente, o app pede
 * outra foto (ou mais fotos) em vez de inventar o que falta. "block" impede gerar; "warn" deixa gerar, mas avisa o
 * que vai sair estimado. Os códigos viram texto em avatar3d.q.<CÓDIGO> (i18n).
 */
import type { Pose, Role } from "./geometry";
import type { FaceStats, HairStats } from "./image-stats";

export type Severity = "block" | "warn";
export interface Issue { code: string; severity: Severity; params?: Record<string, number | string> }

/**
 * Limites calibrados nas fotos de teste do MediaPipe e nas variações delas (docs/avatar3d/VALIDACAO.md): oclusão
 * 0,04–0,09 em rostos limpos, 0,13 com armação escura, 0,25 com mão e manga; nitidez 2,7 desfocada × ≥ 175 nítidas.
 */
export const LIMITS = {
  faceMinPx: 150, faceGoodPx: 260,               // largura do rosto (orelha a orelha) na foto
  frontYawWarn: 12, frontYawBlock: 22, pitchWarn: 14, pitchBlock: 24, rollWarn: 30,
  sideYawMin: 18, sideYawMax: 62,
  lumBlock: 50, lumWarn: 75, lumHigh: 215, clipHighBlock: 0.25, clipHighWarn: 0.1, clipLowBlock: 0.15,
  balanceWarn: 1.4, balanceBlock: 2.6,
  sharpBlock: 6, sharpWarn: 14,
  blink: 0.55, jawOpen: 0.35, rmsWarn: 0.9, occWarn: 0.115,
} as const;

export interface PhotoCheck {
  role: Role; faces: number; width: number; height: number;
  inFrame?: boolean;                     // todos os pontos do rosto dentro da foto (com margem)
  pose?: Pose; stats?: FaceStats; blend?: Record<string, number>; rms?: number;
  occlusion?: number;                    // fração da pele do rosto coberta por algo que não é pele
}

export function checkPhoto(p: PhotoCheck): Issue[] {
  const out: Issue[] = []; const L = LIMITS;
  if (p.faces === 0) return [{ code: "NO_FACE", severity: "block" }];
  if (p.faces > 1) return [{ code: "MULTIPLE_FACES", severity: "block", params: { n: p.faces } }];
  if (p.inFrame === false) out.push({ code: "FACE_CUT", severity: "block" });
  const s = p.stats;
  if (s) {
    if (s.faceWidthPx < L.faceMinPx) out.push({ code: "FACE_SMALL", severity: "block", params: { px: Math.round(s.faceWidthPx) } });
    else if (p.role === "front" && s.faceWidthPx < L.faceGoodPx) out.push({ code: "FACE_SMALL", severity: "warn", params: { px: Math.round(s.faceWidthPx) } });
    if (s.lum < L.lumBlock) out.push({ code: "TOO_DARK", severity: "block" });
    else if (s.lum < L.lumWarn) out.push({ code: "TOO_DARK", severity: "warn" });
    if (s.clipHigh > L.clipHighBlock) out.push({ code: "TOO_BRIGHT", severity: "block" });
    else if (s.lum > L.lumHigh || s.clipHigh > L.clipHighWarn) out.push({ code: "TOO_BRIGHT", severity: "warn" });
    if (s.clipLow > L.clipLowBlock) out.push({ code: "DEEP_SHADOWS", severity: "block" });
    if (s.balance > L.balanceBlock) out.push({ code: "SIDE_LIGHT", severity: "block", params: { ratio: +s.balance.toFixed(2) } });
    else if (s.balance > L.balanceWarn) out.push({ code: "SIDE_LIGHT", severity: "warn", params: { ratio: +s.balance.toFixed(2) } });
    if (s.sharpness < L.sharpBlock) out.push({ code: "BLURRY", severity: "block" });
    else if (s.sharpness < L.sharpWarn) out.push({ code: "BLURRY", severity: "warn" });
  }
  const q = p.pose;
  if (q) {
    const yaw = Math.abs(q.yaw), pitch = Math.abs(q.pitch);
    if (p.role === "front") {
      if (yaw > L.frontYawBlock) out.push({ code: "LOOK_AT_CAMERA", severity: "block", params: { deg: Math.round(yaw) } });
      else if (yaw > L.frontYawWarn) out.push({ code: "LOOK_AT_CAMERA", severity: "warn", params: { deg: Math.round(yaw) } });
    } else {
      if (yaw < L.sideYawMin) out.push({ code: "TURN_MORE", severity: "block", params: { deg: Math.round(yaw) } });
      else if (yaw > L.sideYawMax) out.push({ code: "TURN_LESS", severity: "block", params: { deg: Math.round(yaw) } });
    }
    if (pitch > L.pitchBlock) out.push({ code: "HEAD_UP_DOWN", severity: "block", params: { deg: Math.round(pitch) } });
    else if (pitch > L.pitchWarn) out.push({ code: "HEAD_UP_DOWN", severity: "warn", params: { deg: Math.round(pitch) } });
    if (Math.abs(q.roll) > L.rollWarn) out.push({ code: "HEAD_TILT", severity: "warn", params: { deg: Math.round(Math.abs(q.roll)) } });
  }
  const b = p.blend;
  if (b && p.role === "front") {
    if ((b.eyeBlinkLeft ?? 0) > L.blink && (b.eyeBlinkRight ?? 0) > L.blink) out.push({ code: "EYES_CLOSED", severity: "block" });
    if ((b.jawOpen ?? 0) > L.jawOpen) out.push({ code: "MOUTH_OPEN", severity: "warn" });
  }
  const occ = p.occlusion ?? 0;
  // Só avisa: o índice não separa barba, sombra e sardas de uma mão na frente do rosto (barba grisalha chega a 0,51;
  // mão na testa, 0,25). Com o avatar feito de uma foto só, a pessoa vê a prévia antes de salvar e decide.
  if (occ > L.occWarn || (p.rms !== undefined && p.rms > L.rmsWarn)) out.push({ code: "FACE_OCCLUDED", severity: "warn", params: { pct: Math.round(occ * 100) } });
  return out;
}

export const blocking = (issues: Issue[]) => issues.some((i) => i.severity === "block");

/**
 * O conjunto de fotos: precisa de uma foto de frente sem bloqueio. Com só a frente, a profundidade (perfil do nariz,
 * queixo, orelhas) é estimada: o app pede as fotos de 3/4 em vez de fingir que viu. Cabelo cortado pela borda da foto
 * também vira pedido de foto (a altura real do cabelo não aparece).
 */
export function checkSet(photos: { role: Role; issues: Issue[] }[], hair?: HairStats | null): { ready: boolean; issues: Issue[]; ask: string[] } {
  const issues: Issue[] = []; const ask: string[] = [];
  const front = photos.find((p) => p.role === "front" && !blocking(p.issues));
  if (!front) { issues.push({ code: "NEED_FRONT", severity: "block" }); ask.push("front"); }
  // O avatar é feito com UMA foto (a de perfil): não se pede foto de 3/4 nem de lado.
  if (hair?.cutTop) { issues.push({ code: "HAIR_CUT", severity: "warn" }); ask.push("front-head"); }
  if (hair?.unsure) { issues.push({ code: "HAIR_UNSURE", severity: "warn" }); ask.push("front-hair"); }
  return { ready: !!front, issues, ask };
}

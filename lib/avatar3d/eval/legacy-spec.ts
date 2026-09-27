/*
 * Linha de base da avaliação: o manequim antigo (components/three/mannequin.tsx na versão do commit f5271c8, a que está em produção) descrito no
 * formato Spec, com as mesmas constantes, para que as métricas meçam o "antes" do mesmo jeito que o "depois".
 * Não é usado na tela. Diferenças que o formato mostra: não há mãos (só uma esfera no punho), o ombro é uma esfera
 * encostada no tronco, a borda de baixo do tronco fica aberta sobre as coxas e as proporções vêm só do sexo.
 */
import type { Section, Spec, V3 } from "../body-spec";

const BODY = {
  FEMININO: { h: 1, shoulder: 0.19, hipR: 0.17, waistR: 0.125, chestR: 0.155, headR: 0.1 },
  MASCULINO: { h: 1.06, shoulder: 0.225, hipR: 0.16, waistR: 0.145, chestR: 0.185, headR: 0.105 },
};
const Y = { ankle: 0.08, knee: 0.48, crotch: 0.8, waist: 1.02, bust: 1.22, shoulder: 1.37, neck: 1.43, head: 1.57 };
const ZS = 0.62;

export function legacySpec(sex: "FEMININO" | "MASCULINO"): Spec {
  const b = BODY[sex]; const k = b.h; const fem = sex === "FEMININO";
  const prof: [number, number][] = [[b.hipR * 0.6, Y.crotch - 0.02], [b.hipR, Y.crotch + 0.06], [b.hipR * 0.98, Y.crotch + 0.12], [b.waistR, Y.waist], [b.waistR * 1.05, Y.waist + 0.08],
    [b.chestR * (fem ? 1 : 0.98), Y.bust], [b.chestR * (fem ? 0.93 : 1.02), Y.bust + 0.1], [b.shoulder * 0.62, Y.shoulder], [0.05, Y.neck - 0.01]];
  const torso: Section[] = prof.map(([r, y]) => ({ y: y * k, a: r, b: r * ZS }));
  const stature = Y.head * k + b.headR * 1.16;
  const joints: Record<string, V3> = {}; const limbs: Spec["limbs"] = [];
  for (const s of [-1, 1] as const) {
    const side = s < 0 ? "R" : "L";
    const ball: V3 = [s * b.shoulder, Y.shoulder * k - 0.02, 0];                         // esfera do ombro (r 0,052)
    const elbow: V3 = [s * (b.shoulder + 0.05), (Y.waist + 0.04) * k, 0.01]; const wrist: V3 = [s * (b.shoulder + 0.07), 0.84 * k, 0.04];
    const hip: V3 = [s * b.hipR * 0.5, Y.crotch * k, 0], knee: V3 = [s * b.hipR * 0.48, Y.knee * k, 0.01], ankle: V3 = [s * b.hipR * 0.45, Y.ankle * k, 0];
    limbs.push({ name: `upperArm${side}`, from: ball, to: elbow, r0: 0.052, r1: 0.036 });
    limbs.push({ name: `forearm${side}`, from: elbow, to: wrist, r0: 0.034, r1: 0.027 });
    limbs.push({ name: `thigh${side}`, from: hip, to: knee, r0: 0.075, r1: 0.055 });
    limbs.push({ name: `shin${side}`, from: knee, to: ankle, r0: 0.05, r1: 0.036 });
    Object.assign(joints, { [`shoulder${side}`]: ball, [`elbow${side}`]: elbow, [`wrist${side}`]: wrist, [`hip${side}`]: hip, [`knee${side}`]: knee, [`ankle${side}`]: ankle });
  }
  const headC: V3 = [0, Y.head * k, 0];
  return {
    stature,
    head: { center: headC, rx: b.headR, ry: b.headR * 1.16, rz: b.headR, chinY: headC[1] - b.headR * 1.16, topY: stature },
    neck: { from: [0, (Y.neck + 0.02) * k - 0.05, 0], to: [0, (Y.neck + 0.02) * k + 0.05, 0], r: 0.045 },
    torso, levels: { crotch: (Y.crotch - 0.02) * k, hip: (Y.crotch + 0.06) * k, waist: Y.waist * k, chest: Y.bust * k, shoulder: Y.shoulder * k, neckBase: Y.neck * k }, limbs, hands: [],
    feet: [-1, 1].map((s) => ({ name: `foot${s < 0 ? "R" : "L"}`, center: [s * b.hipR * 0.45, 0.035, 0.05] as V3, size: [0.075, 0.06, 0.2] as V3 })),
    joints: { ...joints, head: headC, neckBase: [0, Y.neck * k, 0], chin: [0, headC[1] - b.headR * 1.16, 0.05] },
  };
}

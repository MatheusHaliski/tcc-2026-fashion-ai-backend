/*
 * Avatar 3D — locomoção: comer (prato e garfo) e a fase da garfada.
 */
import { type MotionInput, type MotionState, type Rig } from "./locomotion-model";
import { A, B, C, D, hash, mix, pulse, smooth, V1, V2 } from "./locomotion-math";
import { arm, chest, curl, handTo, headPt, lean } from "./locomotion-kinematics";
import { idleHead } from "./locomotion-gait";

/** Garfada (s): o garfo desce ao prato, sobe à boca, morde e volta; o resto do ciclo é mastigar e olhar em volta. */
const BITE = { cycle: 5.2, down: [0.2, 0.9], up: [0.9, 1.55], at: [1.55, 1.9], back: [1.9, 2.5] } as const;
/** Fase da garfada de quem come (para a boca: 0 longe, 1 no garfo) e a mastigação (0–1) logo depois. */
export function eatPhase(time: number, seed: number): { atMouth: number; chew: number } {
  const u = (time + hash(seed + 61) * BITE.cycle) % BITE.cycle;
  const atMouth = smooth(BITE.up[0] + 0.3, BITE.at[0], u) * (1 - smooth(BITE.at[1], BITE.back[1] - 0.2, u));
  const chewing = smooth(BITE.at[1], BITE.at[1] + 0.2, u) * (1 - smooth(BITE.cycle - 1.4, BITE.cycle - 0.6, u));
  return { atMouth, chew: chewing * (0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 1.7)) };
}
/**
 * Comer: prato pequeno na mão esquerda à frente da cintura (palma para cima, nivelado), garfo na direita. A cada ~5 s
 * o garfo desce ao prato (corta), sobe à boca com a cabeça vindo ao encontro, e volta; depois mastiga olhando em volta.
 * Andando, o prato fica parado à frente e o garfo descansa nele.
 */
export function eat(r: Rig, st: MotionState, t: number, walking: number, inp: MotionInput) {
  const u = ((inp.time ?? st.t) + hash(st.seed + 61) * BITE.cycle) % BITE.cycle;
  // prato: firme à frente da cintura, sem acompanhar o balanço do braço
  chest(r, 0.1, -0.27, 0.27, A); A.y = Math.max(A.y, 0.9 * r.dim.hipH + 0.05);
  arm(r, 0, A, 0.7, -1, -0.5); handTo(r, 0, -0.55, 0.05, 0.84, 0, 1, 0); curl(r, 0, 0.12, 0.05);
  // garfo: do prato à boca e de volta (a mão fica ~11 cm abaixo e à frente da boca: os dentes do garfo chegam nela)
  const cut = pulse(BITE.down[0], BITE.down[1], 0.15, u) * (1 - walking);
  const mouth = walking > 0.5 ? 0 : smooth(BITE.up[0], BITE.at[0], u) * (1 - smooth(BITE.at[1], BITE.back[1], u));
  B.copy(A).add(V1.set(-0.05, 0.08 - 0.025 * cut * Math.abs(Math.sin(u * 18)), 0.02));
  headPt(r, -0.02, -0.14, 0.15, C);
  V2.copy(B).lerp(C, mouth);
  arm(r, 1, V2, -0.7, -1, -0.4);
  // dedos apontam para o prato (garfo para baixo) e, na boca, para cima e para trás (o garfo entra na boca)
  handTo(r, 1, mix(0.25, 0.1, mouth), mix(-0.55, 0.7, mouth), mix(0.8, -0.35, mouth), mix(0.9, 0.7, mouth), mix(0.2, 0, mouth), mix(0, 0.3, mouth), 0.9);
  curl(r, 1, 0.5, 0.45);
  // cabeça: olha o prato para pegar, vem ao encontro do garfo, mastiga olhando em volta
  const lookPlate = (1 - mouth) * pulse(BITE.down[0] - 0.2, BITE.up[0] + 0.2, 0.25, u);
  lean(r, r.k.Neck, (6 * lookPlate + 4 * mouth) * D); lean(r, r.k.Head, (14 * lookPlate + 6 * mouth) * D);
  if (mouth < 0.1 && lookPlate < 0.1) idleHead(r, st, 0.8);
  void t;
}

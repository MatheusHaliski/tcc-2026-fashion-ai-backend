/**
 * Animações comuns a todos os jogos (seção 2): três poses, a reação ao resultado (comemora com 3 estrelas, acena com
 * 1 ou 2, encolhe os ombros com 0), o passo de caminhada e os gestos dos figurantes (aplauso, aceno, comemoração).
 * A respiração parada é a de lib/avatar3d/human/pose.ts; girar é o giro do avatar na tela.
 */
import { clip, onda, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Mão na cintura e peso numa perna. */
const POSE_1 = clip("POSE_1", 2.6, 1.3, [
  segura("RightArm", "rz", -38, 2.6),
  segura("RightForeArm", "rz", 95, 2.6),
  segura("Hips", "rz", 4, 2.6),
  segura("Spine", "rz", -3, 2.6),
  segura("Head", "ry", -12, 2.6),
  segura("LeftArm", "rz", 6, 2.6),
]);

/** Mão no cabelo, quadril para o outro lado. */
const POSE_2 = clip("POSE_2", 2.6, 1.3, [
  segura("LeftArm", "rz", 150, 2.6, 0.5, 0.5),
  segura("LeftForeArm", "rz", 110, 2.6, 0.5, 0.5),
  segura("Hips", "rz", -5, 2.6),
  segura("Spine2", "ry", 8, 2.6),
  segura("Head", "rz", 6, 2.6),
]);

/** Vira de costas e olha por cima do ombro. */
const POSE_3 = clip("POSE_3", 3.2, 1.6, [
  segura("raiz", "ry", 150, 3.2, 0.7, 0.7),
  segura("Neck", "ry", -28, 3.2, 0.9, 0.7),
  segura("Head", "ry", -42, 3.2, 0.9, 0.7),
  segura("RightArm", "rz", -38, 3.2, 0.7, 0.6),
  segura("RightForeArm", "rz", 95, 3.2, 0.7, 0.6),
]);

/** 3 estrelas: os dois braços para o alto e três pulinhos. */
const REACAO_3 = clip("REACAO_3", 2.8, 0.5, [
  segura("LeftArm", "rz", 155, 2.8, 0.35, 0.5),
  segura("RightArm", "rz", -155, 2.8, 0.35, 0.5),
  segura("Spine", "rx", -6, 2.8),
  segura("Head", "rx", -10, 2.8),
  tr("raiz", "py", [
    [0, 0],
    [0.35, 0.09],
    [0.7, 0],
    [1.05, 0.09],
    [1.4, 0],
    [1.75, 0.07],
    [2.1, 0],
  ]),
]);

/** 1 ou 2 estrelas: aceno com o braço direito, para o lado. */
const REACAO_1 = clip("REACAO_1", 2.6, 0.9, [
  segura("RightArm", "rz", -150, 2.6, 0.45, 0.5),
  onda("RightForeArm", "rz", 22, 2.6, 3, 0.45, 2.1),
  segura("Head", "rz", -6, 2.6),
]);

/** 0 estrelas: encolhe os ombros, palmas para cima. */
const REACAO_0 = clip("REACAO_0", 2.2, 0.8, [
  segura("LeftShoulder", "rz", 12, 2.2, 0.35, 0.5),
  segura("RightShoulder", "rz", -12, 2.2, 0.35, 0.5),
  segura("LeftArm", "rz", 14, 2.2, 0.35, 0.5),
  segura("RightArm", "rz", -14, 2.2, 0.35, 0.5),
  segura("LeftForeArm", "rz", 40, 2.2, 0.35, 0.5),
  segura("RightForeArm", "rz", -40, 2.2, 0.35, 0.5),
  segura("Head", "rz", 8, 2.2),
]);

/** Um ciclo de caminhada (dois passos); repete enquanto o avatar anda. */
const CAMINHAR = clip(
  "CAMINHAR",
  1.2,
  0.3,
  [
    onda("LeftUpLeg", "rx", -24, 1.2, 1),
    onda("RightUpLeg", "rx", 24, 1.2, 1),
    tr("LeftLeg", "rx", [
      [0, 0],
      [0.6, 0],
      [0.9, 26],
      [1.2, 0],
    ]),
    tr("RightLeg", "rx", [
      [0, 0],
      [0.3, 26],
      [0.6, 0],
      [1.2, 0],
    ]),
    onda("LeftArm", "rx", 16, 1.2, 1),
    onda("RightArm", "rx", -16, 1.2, 1),
    onda("Hips", "ry", 5, 1.2, 1),
    onda("Spine1", "ry", -4, 1.2, 1),
  ],
  true,
);

/** Figurante: aplauso (os braços sobem à frente e batem). */
const F_APLAUSO = clip("F_APLAUSO", 3, 0.5, [
  segura("bracoE", "rx", -62, 3, 0.3, 0.4),
  segura("bracoD", "rx", -62, 3, 0.3, 0.4),
  onda("bracoE", "rz", -10, 3, 5, 0.3, 2.6),
  onda("bracoD", "rz", 10, 3, 5, 0.3, 2.6),
]);

/** Figurante: de pé, os braços para o alto (a plateia levanta, o time comemora). */
const F_COMEMORA = clip("F_COMEMORA", 3, 0.6, [
  segura("bracoE", "rz", 150, 3, 0.4, 0.5),
  segura("bracoD", "rz", -150, 3, 0.4, 0.5),
  onda("raiz", "py", 0.06, 3, 3, 0.4, 2.5),
]);

/** Figurante: aceno com um braço (torcida, passante). */
const F_ACENA = clip("F_ACENA", 4, 1, [
  segura("bracoD", "rz", -145, 4, 0.5, 0.6),
  onda("bracoD", "rx", 14, 4, 4, 0.5, 3.4),
]);

/** Figurante: lamenta (o corpo cai um pouco para a frente e balança a cabeça com o tronco). */
const F_LAMENTA = clip("F_LAMENTA", 2.4, 0.8, [
  segura("raiz", "rx", 8, 2.4, 0.4, 0.6),
  onda("raiz", "ry", 8, 2.4, 2, 0.4, 1.8),
]);

/** Luz: dois flashes curtos (menos de 3 por segundo). */
const L_FLASH = clip("L_FLASH", 1.2, 0.08, [
  tr("luz", "v", [
    [0, 0],
    [0.08, 1],
    [0.3, 0],
    [0.6, 0],
    [0.68, 1],
    [0.9, 0],
    [1.2, 0],
  ]),
]);

/** Luz: acende devagar e fica (a sequência mantém acesa). */
const L_ACENDE = clip("L_ACENDE", 2.4, 1.2, [segura("luz", "v", 1, 2.4, 0.8, 0.6)]);

export const CLIPS_COMUNS: Clip[] = [POSE_1, POSE_2, POSE_3, REACAO_3, REACAO_1, REACAO_0, CAMINHAR, F_APLAUSO, F_COMEMORA, F_ACENA, F_LAMENTA, L_FLASH, L_ACENDE];

export const POSES_COMUNS = ["POSE_1", "POSE_2", "POSE_3"];

/** Reação ao resultado pelas estrelas. */
export function reacaoPorEstrelas(estrelas: number): string {
  if (estrelas >= 3) return "REACAO_3";
  return estrelas >= 1 ? "REACAO_1" : "REACAO_0";
}

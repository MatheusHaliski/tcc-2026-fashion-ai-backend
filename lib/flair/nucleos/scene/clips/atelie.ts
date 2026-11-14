/**
 * Animações próprias do Grupo Ateliê 3D: o aceno da torcida (8), a luz de palco da era (9), o piloto (11: pôr o
 * capacete, baixar a viseira, braços cruzados) e o herói (13: três poses e a capa ao vento). O giro lento do
 * manequim é ambiente, em graus por segundo (animations.ts).
 */
import { clip, onda, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Põe o capacete: as duas mãos sobem até a cabeça e descem. */
const POR_O_CAPACETE = clip("POR_O_CAPACETE", 3.0, 1.2, [
  segura("LeftArm", "rz", 120, 3.0, 0.8, 0.8),
  segura("RightArm", "rz", -120, 3.0, 0.8, 0.8),
  segura("LeftForeArm", "rz", 105, 3.0, 0.8, 0.8),
  segura("RightForeArm", "rz", -105, 3.0, 0.8, 0.8),
  tr("Head", "rx", [
    [0, 0],
    [0.8, 12],
    [1.6, 0],
    [3.0, 0],
  ]),
]);

/** Baixa a viseira: a mão direita vai à testa e desce. */
const BAIXAR_A_VISEIRA = clip("BAIXAR_A_VISEIRA", 2.0, 0.8, [
  segura("RightArm", "rz", -105, 2.0, 0.6, 0.6),
  tr("RightForeArm", "rz", [
    [0, 0],
    [0.6, -120],
    [1.0, -95],
    [1.4, -95],
    [2.0, 0],
  ]),
  segura("Head", "rx", 5, 2.0, 0.6, 0.6),
]);

/** Braços cruzados, queixo erguido. */
const BRACOS_CRUZADOS = clip("BRACOS_CRUZADOS", 3.0, 1.2, [
  segura("LeftArm", "rx", -32, 3.0, 0.6, 0.6),
  segura("RightArm", "rx", -32, 3.0, 0.6, 0.6),
  segura("LeftForeArm", "rz", -100, 3.0, 0.6, 0.6),
  segura("RightForeArm", "rz", 100, 3.0, 0.6, 0.6),
  segura("Head", "rx", -6, 3.0, 0.6, 0.6),
  segura("Spine1", "rx", -4, 3.0, 0.6, 0.6),
]);

/** Herói 1: punhos na cintura, peito aberto, pés afastados. */
const POSE_DE_HEROI_1 = clip("POSE_DE_HEROI_1", 3.0, 1.2, [
  segura("LeftArm", "rz", 40, 3.0),
  segura("LeftForeArm", "rz", -100, 3.0),
  segura("RightArm", "rz", -40, 3.0),
  segura("RightForeArm", "rz", 100, 3.0),
  segura("LeftUpLeg", "rz", 8, 3.0),
  segura("RightUpLeg", "rz", -8, 3.0),
  segura("Spine1", "rx", -8, 3.0),
  segura("Head", "rx", -8, 3.0),
]);

/** Herói 2: um punho para o alto, pronto para voar. */
const POSE_DE_HEROI_2 = clip("POSE_DE_HEROI_2", 3.0, 1.2, [
  segura("RightArm", "rz", -172, 3.0, 0.5, 0.6),
  segura("LeftArm", "rz", 26, 3.0, 0.5, 0.6),
  segura("LeftForeArm", "rz", -80, 3.0, 0.5, 0.6),
  segura("Head", "rx", -16, 3.0, 0.5, 0.6),
  segura("raiz", "py", 0.05, 3.0, 0.5, 0.6),
]);

/** Herói 3: pouso — um joelho dobra, o tronco desce, um braço para trás. */
const POSE_DE_HEROI_3 = clip("POSE_DE_HEROI_3", 3.2, 1.3, [
  segura("Hips", "py", -0.22, 3.2, 0.6, 0.8),
  segura("LeftUpLeg", "rx", -52, 3.2, 0.6, 0.8),
  segura("LeftLeg", "rx", 78, 3.2, 0.6, 0.8),
  segura("RightUpLeg", "rx", 8, 3.2, 0.6, 0.8),
  segura("RightLeg", "rx", 52, 3.2, 0.6, 0.8),
  segura("Spine", "rx", 18, 3.2, 0.6, 0.8),
  segura("RightArm", "rx", 40, 3.2, 0.6, 0.8),
  segura("LeftArm", "rz", 36, 3.2, 0.6, 0.8),
  segura("Head", "rx", -14, 3.2, 0.6, 0.8),
]);

/** Capa ao vento: a capa levanta atrás do manequim e ondula. */
const M_CAPA_AO_VENTO = clip("M_CAPA_AO_VENTO", 4.0, 1.0, [
  segura("movel", "rx", -22, 4.0, 1.0, 1.0),
  onda("movel", "rz", 5, 4.0, 3, 0.5, 3.5),
]);

/** Luz de palco da era: sobe e desce devagar (uma volta a cada 4 segundos). */
const L_PALCO_DA_ERA = clip("L_PALCO_DA_ERA", 4.0, 1.0, [onda("luz", "v", 0.45, 4.0, 1)]);

export const CLIPS_ATELIE: Clip[] = [POR_O_CAPACETE, BAIXAR_A_VISEIRA, BRACOS_CRUZADOS, POSE_DE_HEROI_1, POSE_DE_HEROI_2, POSE_DE_HEROI_3, M_CAPA_AO_VENTO, L_PALCO_DA_ERA];

export const POSES_DE_PILOTO = ["POR_O_CAPACETE", "BAIXAR_A_VISEIRA", "BRACOS_CRUZADOS"];
export const POSES_DE_HEROI = ["POSE_DE_HEROI_1", "POSE_DE_HEROI_2", "POSE_DE_HEROI_3"];

/**
 * Animações próprias do Personagem de Filme (4: três poses de cena do gênero, "ação" e "corta", a claquete) e do
 * Road to Glory (5: cinco poses de ensaio, virar o rosto e olhar para a câmera).
 */
import { clip, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Noir 1: ajeita a gola do casaco, olhar de lado. */
const POSE_DE_CENA_1 = clip("POSE_DE_CENA_1", 2.8, 1.2, [
  segura("RightArm", "rz", -30, 2.8),
  segura("RightForeArm", "rz", 150, 2.8),
  segura("Head", "ry", -22, 2.8),
  segura("Head", "rx", 6, 2.8),
  segura("Spine2", "ry", -8, 2.8),
]);

/** Noir 2: mão no queixo, pensando. */
const POSE_DE_CENA_2 = clip("POSE_DE_CENA_2", 2.8, 1.2, [
  segura("LeftArm", "rz", 22, 2.8),
  segura("LeftForeArm", "rz", -155, 2.8),
  segura("RightArm", "rx", -18, 2.8),
  segura("RightForeArm", "rz", 80, 2.8),
  segura("Head", "rx", 8, 2.8),
  segura("Hips", "rz", 4, 2.8),
]);

/** Noir 3: aponta para o lado, o corpo em diagonal. */
const POSE_DE_CENA_3 = clip("POSE_DE_CENA_3", 2.8, 1.2, [
  segura("LeftArm", "rz", 88, 2.8, 0.45, 0.5),
  segura("Head", "ry", 40, 2.8, 0.45, 0.5),
  segura("Spine2", "ry", 14, 2.8, 0.45, 0.5),
  segura("RightArm", "rz", -10, 2.8),
]);

/** "Ação": entra em cena num passo firme, ombros abertos. */
const ACAO = clip("ACAO", 2.0, 0.6, [
  segura("raiz", "pz", 0.2, 2.0, 0.4, 0.6),
  segura("Spine", "rx", -5, 2.0, 0.4, 0.6),
  segura("LeftArm", "rz", 12, 2.0, 0.4, 0.6),
  segura("RightArm", "rz", -12, 2.0, 0.4, 0.6),
  segura("Head", "rx", -5, 2.0, 0.4, 0.6),
]);

/** "Corta": solta o corpo e passa a mão na testa. */
const CORTA = clip("CORTA", 2.4, 1.0, [
  segura("RightArm", "rz", -40, 2.4, 0.5, 0.6),
  segura("RightForeArm", "rz", 150, 2.4, 0.5, 0.6),
  segura("Spine", "rx", 6, 2.4, 0.5, 0.6),
  segura("Head", "rx", 10, 2.4, 0.5, 0.6),
]);

/** A claquete: o braço sobe e bate. */
const M_CLAQUETE = clip("M_CLAQUETE", 1.2, 0.4, [
  tr("movel", "rz", [
    [0, 0],
    [0.4, 42],
    [0.75, 42],
    [0.85, 0],
    [1.2, 0],
  ]),
]);

/** Ensaio 1: mãos nos bolsos, ombro para a frente. */
const POSE_DE_ENSAIO_1 = clip("POSE_DE_ENSAIO_1", 2.6, 1.2, [
  segura("LeftArm", "rz", 12, 2.6),
  segura("RightArm", "rz", -12, 2.6),
  segura("LeftForeArm", "rz", -30, 2.6),
  segura("RightForeArm", "rz", 30, 2.6),
  segura("Spine2", "ry", 12, 2.6),
  segura("Head", "ry", -10, 2.6),
]);

/** Ensaio 2: uma mão na nuca, cotovelo aberto. */
const POSE_DE_ENSAIO_2 = clip("POSE_DE_ENSAIO_2", 2.6, 1.2, [
  segura("RightArm", "rz", -150, 2.6, 0.5, 0.5),
  segura("RightForeArm", "rz", -115, 2.6, 0.5, 0.5),
  segura("Hips", "rz", 5, 2.6),
  segura("Head", "rz", -6, 2.6),
]);

/** Ensaio 3: braços abertos para baixo, peito aberto. */
const POSE_DE_ENSAIO_3 = clip("POSE_DE_ENSAIO_3", 2.6, 1.2, [
  segura("LeftArm", "rz", 34, 2.6),
  segura("RightArm", "rz", -34, 2.6),
  segura("Spine1", "rx", -6, 2.6),
  segura("Head", "rx", -8, 2.6),
]);

/** Ensaio 4: meio perfil, a mão de trás na cintura. */
const POSE_DE_ENSAIO_4 = clip("POSE_DE_ENSAIO_4", 3.0, 1.4, [
  segura("raiz", "ry", 55, 3.0, 0.6, 0.6),
  segura("Head", "ry", -40, 3.0, 0.7, 0.6),
  segura("LeftArm", "rz", 38, 3.0, 0.6, 0.6),
  segura("LeftForeArm", "rz", -95, 3.0, 0.6, 0.6),
]);

/** Ensaio 5: as duas mãos na cintura, queixo erguido. */
const POSE_DE_ENSAIO_5 = clip("POSE_DE_ENSAIO_5", 2.6, 1.2, [
  segura("LeftArm", "rz", 38, 2.6),
  segura("LeftForeArm", "rz", -95, 2.6),
  segura("RightArm", "rz", -38, 2.6),
  segura("RightForeArm", "rz", 95, 2.6),
  segura("Head", "rx", -7, 2.6),
]);

const VIRAR_O_ROSTO = clip("VIRAR_O_ROSTO", 2.4, 1.0, [
  segura("Neck", "ry", 16, 2.4, 0.6, 0.6),
  segura("Head", "ry", 34, 2.4, 0.6, 0.6),
  segura("Head", "rz", -4, 2.4, 0.6, 0.6),
]);

const OLHAR_PARA_A_CAMERA = clip("OLHAR_PARA_A_CAMERA", 2.0, 0.8, [
  segura("Head", "rx", 5, 2.0, 0.5, 0.6),
  segura("Neck", "rx", 3, 2.0, 0.5, 0.6),
  segura("Spine2", "rx", 3, 2.0, 0.5, 0.6),
]);

export const CLIPS_SET: Clip[] = [
  POSE_DE_CENA_1,
  POSE_DE_CENA_2,
  POSE_DE_CENA_3,
  ACAO,
  CORTA,
  M_CLAQUETE,
  POSE_DE_ENSAIO_1,
  POSE_DE_ENSAIO_2,
  POSE_DE_ENSAIO_3,
  POSE_DE_ENSAIO_4,
  POSE_DE_ENSAIO_5,
  VIRAR_O_ROSTO,
  OLHAR_PARA_A_CAMERA,
];

export const POSES_DE_CENA = ["POSE_DE_CENA_1", "POSE_DE_CENA_2", "POSE_DE_CENA_3"];
export const POSES_DE_ENSAIO = ["POSE_DE_ENSAIO_1", "POSE_DE_ENSAIO_2", "POSE_DE_ENSAIO_3", "POSE_DE_ENSAIO_4", "POSE_DE_ENSAIO_5"];
export const PROPRIAS_FILME = [...POSES_DE_CENA, "ACAO", "CORTA"];
export const PROPRIAS_ROAD_TO_GLORY = [...POSES_DE_ENSAIO, "VIRAR_O_ROSTO", "OLHAR_PARA_A_CAMERA"];

/**
 * Animações próprias dos jogos de palco: A Passarela (1), Dress the Star (3) e Batalha de Looks (15). As que andam
 * (caminhada, entrada) só mexem o corpo; quem leva o avatar de um ponto a outro é o passo da sequência.
 */
import { clip, onda, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Passo de passarela: quadril marcado, braços soltos, um pé na frente do outro. */
const CAMINHADA_DE_PASSARELA = clip(
  "CAMINHADA_DE_PASSARELA",
  1.2,
  0.3,
  [
    onda("LeftUpLeg", "rx", -26, 1.2, 1),
    onda("RightUpLeg", "rx", 26, 1.2, 1),
    onda("LeftUpLeg", "rz", -4, 1.2, 1),
    onda("RightUpLeg", "rz", -4, 1.2, 1),
    tr("LeftLeg", "rx", [
      [0, 0],
      [0.6, 0],
      [0.9, 30],
      [1.2, 0],
    ]),
    tr("RightLeg", "rx", [
      [0, 0],
      [0.3, 30],
      [0.6, 0],
      [1.2, 0],
    ]),
    onda("Hips", "rz", 5, 1.2, 1),
    onda("Hips", "ry", 8, 1.2, 1),
    onda("Spine2", "ry", -7, 1.2, 1),
    onda("LeftArm", "rx", 10, 1.2, 1),
    onda("RightArm", "rx", -10, 1.2, 1),
  ],
  true,
);

/** Parada na ponta: mão na cintura, quadril de lado, queixo erguido. */
const PARADA_NA_PONTA = clip("PARADA_NA_PONTA", 2.2, 1.0, [
  segura("LeftArm", "rz", 38, 2.2),
  segura("LeftForeArm", "rz", -95, 2.2),
  segura("Hips", "rz", -6, 2.2),
  segura("Spine", "rz", 4, 2.2),
  segura("Head", "rx", -6, 2.2),
  segura("Head", "ry", 14, 2.2),
]);

/** Meia-volta: o tronco puxa o giro e os braços abrem um pouco (o giro em si é do passo da sequência). */
const MEIA_VOLTA = clip("MEIA_VOLTA", 1.2, 0.6, [
  segura("Spine2", "ry", 16, 1.2, 0.4, 0.5),
  segura("Head", "ry", 24, 1.2, 0.3, 0.6),
  segura("LeftArm", "rz", 14, 1.2, 0.4, 0.5),
  segura("RightArm", "rz", -14, 1.2, 0.4, 0.5),
]);

/** Entrada no palco: caminhada larga, um braço erguido saudando a plateia. */
const ENTRADA_NO_PALCO = clip(
  "ENTRADA_NO_PALCO",
  1.2,
  0.3,
  [
    onda("LeftUpLeg", "rx", -22, 1.2, 1),
    onda("RightUpLeg", "rx", 22, 1.2, 1),
    onda("Hips", "ry", 6, 1.2, 1),
    segura("RightArm", "rz", -140, 1.2, 0.3, 0.3),
    onda("RightForeArm", "rz", 16, 1.2, 1),
  ],
  true,
);

/** Pose de estrela: um braço para o alto, o outro na cintura, o corpo em diagonal. */
const POSE_DE_ESTRELA = clip("POSE_DE_ESTRELA", 2.8, 1.2, [
  segura("RightArm", "rz", -165, 2.8, 0.5, 0.6),
  segura("LeftArm", "rz", 38, 2.8, 0.5, 0.6),
  segura("LeftForeArm", "rz", -95, 2.8, 0.5, 0.6),
  segura("Hips", "rz", -6, 2.8),
  segura("Spine2", "ry", -10, 2.8),
  segura("Head", "rx", -12, 2.8),
]);

/** Reverência: o tronco desce, os braços abrem para os lados. */
const REVERENCIA = clip("REVERENCIA", 2.6, 1.2, [
  segura("Spine", "rx", 28, 2.6, 0.7, 0.7),
  segura("Spine1", "rx", 18, 2.6, 0.7, 0.7),
  segura("Neck", "rx", 10, 2.6, 0.7, 0.7),
  segura("LeftArm", "rz", 28, 2.6, 0.6, 0.7),
  segura("RightArm", "rz", -28, 2.6, 0.6, 0.7),
]);

/** Pose lado a lado: o quadril e o olhar para o lado do adversário, a mão de fora na cintura. */
const POSE_LADO_A_LADO = clip("POSE_LADO_A_LADO", 2.6, 1.2, [
  segura("RightArm", "rz", -38, 2.6),
  segura("RightForeArm", "rz", 95, 2.6),
  segura("Hips", "rz", 5, 2.6),
  segura("Head", "ry", 20, 2.6),
  segura("Spine2", "ry", 8, 2.6),
]);

/** O vencedor levanta o braço (o de fora, longe do adversário). */
const VENCEDOR_LEVANTA_O_BRACO = clip("VENCEDOR_LEVANTA_O_BRACO", 3.0, 1.2, [
  segura("RightArm", "rz", -168, 3.0, 0.5, 0.7),
  segura("Head", "rx", -8, 3.0),
  onda("raiz", "py", 0.04, 3.0, 2, 0.6, 2.2),
]);

/** Figurante adversário: pose com a mão na cintura. */
const F_POSE = clip("F_POSE", 2.6, 1.2, [
  segura("bracoE", "rz", 42, 2.6),
  segura("raiz", "ry", -14, 2.6),
]);

/** Figurante adversário vencedor: o braço de fora para o alto. */
const F_LEVANTA_O_BRACO = clip("F_LEVANTA_O_BRACO", 3.0, 1.2, [
  segura("bracoE", "rz", 165, 3.0, 0.5, 0.7),
  onda("raiz", "py", 0.04, 3.0, 2, 0.6, 2.2),
]);

/** A silhueta da estrela se revela: sobe um pouco e abre os braços. */
const F_REVELA = clip("F_REVELA", 3.2, 1.6, [
  segura("raiz", "py", 0.12, 3.2, 0.9, 0.9),
  segura("bracoE", "rz", 120, 3.2, 0.9, 0.9),
  segura("bracoD", "rz", -120, 3.2, 0.9, 0.9),
]);

export const CLIPS_PALCO: Clip[] = [
  CAMINHADA_DE_PASSARELA,
  PARADA_NA_PONTA,
  MEIA_VOLTA,
  ENTRADA_NO_PALCO,
  POSE_DE_ESTRELA,
  REVERENCIA,
  POSE_LADO_A_LADO,
  VENCEDOR_LEVANTA_O_BRACO,
  F_POSE,
  F_LEVANTA_O_BRACO,
  F_REVELA,
];

export const PROPRIAS_PASSARELA = ["CAMINHADA_DE_PASSARELA", "PARADA_NA_PONTA", "MEIA_VOLTA"];
export const PROPRIAS_DRESS_THE_STAR = ["ENTRADA_NO_PALCO", "POSE_DE_ESTRELA", "REVERENCIA"];
export const PROPRIAS_BATALHA = ["ENTRADA_NO_PALCO", "POSE_LADO_A_LADO", "VENCEDOR_LEVANTA_O_BRACO"];

/**
 * Animações próprias do Fashion Sports (14): correr, passar, chutar, defender, comemorar e o passe errado por falta
 * de coesão, mais as dos colegas e adversários figurantes e o arco da bola. Impactos estilizados, sem ferimento.
 */
import { clip, onda, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Um ciclo de corrida (dois passos); os braços dobrados vêm de BRACOS_DE_CORRIDA. */
const CORRER = clip(
  "CORRER",
  0.7,
  0.18,
  [
    onda("LeftUpLeg", "rx", -42, 0.7, 1),
    onda("RightUpLeg", "rx", 42, 0.7, 1),
    tr("LeftLeg", "rx", [
      [0, 0],
      [0.35, 0],
      [0.52, 62],
      [0.7, 0],
    ]),
    tr("RightLeg", "rx", [
      [0, 0],
      [0.17, 62],
      [0.35, 0],
      [0.7, 0],
    ]),
    onda("LeftArm", "rx", 36, 0.7, 1),
    onda("RightArm", "rx", -36, 0.7, 1),
    onda("raiz", "py", 0.03, 0.7, 2),
  ],
  true,
);

/** Postura de corrida durante um trecho: tronco à frente e cotovelos dobrados. */
const BRACOS_DE_CORRIDA = clip("BRACOS_DE_CORRIDA", 2.8, 1.0, [
  segura("LeftForeArm", "rx", -80, 2.8, 0.25, 0.3),
  segura("RightForeArm", "rx", -80, 2.8, 0.25, 0.3),
  segura("Spine", "rx", 10, 2.8, 0.25, 0.3),
]);

/** Passe com a parte de dentro do pé. */
const PASSAR = clip("PASSAR", 1.0, 0.4, [
  tr("RightUpLeg", "rx", [
    [0, 0],
    [0.2, 18],
    [0.4, -34],
    [1.0, 0],
  ]),
  segura("RightUpLeg", "ry", 30, 1.0, 0.3, 0.5),
  segura("LeftArm", "rz", 24, 1.0, 0.3, 0.5),
  segura("Spine", "rx", 5, 1.0, 0.3, 0.5),
]);

/** Chute a gol: a perna vai atrás e solta. */
const CHUTAR = clip("CHUTAR", 1.4, 0.6, [
  tr("RightUpLeg", "rx", [
    [0, 0],
    [0.35, 34],
    [0.6, -78],
    [0.9, -40],
    [1.4, 0],
  ]),
  tr("RightLeg", "rx", [
    [0, 0],
    [0.35, 70],
    [0.6, 6],
    [1.4, 0],
  ]),
  segura("LeftArm", "rz", 46, 1.4, 0.4, 0.6),
  segura("RightArm", "rx", 26, 1.4, 0.4, 0.6),
  segura("Spine", "rx", -8, 1.4, 0.5, 0.6),
]);

/** Defesa: braços abertos e um passo para o lado. */
const DEFENDER = clip("DEFENDER", 1.6, 0.6, [
  segura("LeftArm", "rz", 80, 1.6, 0.35, 0.6),
  segura("RightArm", "rz", -80, 1.6, 0.35, 0.6),
  segura("raiz", "px", 0.45, 1.6, 0.4, 0.7),
  segura("Hips", "py", -0.1, 1.6, 0.35, 0.6),
  segura("LeftUpLeg", "rz", 14, 1.6, 0.35, 0.6),
  segura("RightUpLeg", "rz", -14, 1.6, 0.35, 0.6),
]);

/** Comemoração do gol: punho no ar e dois pulos. */
const COMEMORAR = clip("COMEMORAR", 2.6, 0.5, [
  segura("RightArm", "rz", -165, 2.6, 0.35, 0.5),
  segura("LeftArm", "rx", -30, 2.6, 0.35, 0.5),
  segura("LeftForeArm", "rx", -90, 2.6, 0.35, 0.5),
  onda("raiz", "py", 0.08, 2.6, 2, 0.3, 1.9),
  segura("Head", "rx", -10, 2.6),
]);

/** Passe errado: as mãos vão à cabeça e o corpo balança. */
const PASSE_ERRADO = clip("PASSE_ERRADO", 2.4, 1.0, [
  segura("LeftArm", "rz", 150, 2.4, 0.5, 0.6),
  segura("RightArm", "rz", -150, 2.4, 0.5, 0.6),
  segura("LeftForeArm", "rz", 110, 2.4, 0.5, 0.6),
  segura("RightForeArm", "rz", -110, 2.4, 0.5, 0.6),
  onda("Head", "ry", 12, 2.4, 2, 0.5, 1.9),
]);

/** Figurante correndo: o corpo sobe e desce e os braços alternam. */
const F_CORRER = clip(
  "F_CORRER",
  0.7,
  0.18,
  [
    onda("bracoE", "rx", 40, 0.7, 1),
    onda("bracoD", "rx", -40, 0.7, 1),
    onda("raiz", "py", 0.04, 0.7, 2),
    segura("raiz", "rx", 8, 0.7, 0.1, 0.1),
  ],
  true,
);

/** Figurante chutando: o corpo vai para trás e solta para a frente. */
const F_CHUTAR = clip("F_CHUTAR", 1.2, 0.5, [
  tr("raiz", "rx", [
    [0, 0],
    [0.3, -10],
    [0.5, 12],
    [1.2, 0],
  ]),
  segura("bracoE", "rz", 46, 1.2, 0.3, 0.5),
  segura("bracoD", "rx", 30, 1.2, 0.3, 0.5),
]);

/** Arco da bola no ar durante um chute ou passe alto. */
const M_BOLA_NO_AR = clip("M_BOLA_NO_AR", 1.0, 0.5, [
  tr("movel", "py", [
    [0, 0],
    [0.5, 0.9],
    [1.0, 0],
  ]),
]);

export const CLIPS_ESPORTE: Clip[] = [CORRER, BRACOS_DE_CORRIDA, PASSAR, CHUTAR, DEFENDER, COMEMORAR, PASSE_ERRADO, F_CORRER, F_CHUTAR, M_BOLA_NO_AR];

export const PROPRIAS_SPORTS = ["CORRER", "PASSAR", "CHUTAR", "DEFENDER", "COMEMORAR", "PASSE_ERRADO"];

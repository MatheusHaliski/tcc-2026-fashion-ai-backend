/**
 * Animações próprias do Dress Fighter (jogo 2): guarda, soco, chute, defesa, esquiva, golpe especial com rastro da
 * peça e queda, mais as do oponente figurante. Impactos estilizados: ninguém se fere; quem cai levanta no fim.
 */
import { clip, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

const GUARDA = clip("GUARDA", 1.6, 0.6, [
  segura("LeftArm", "rx", -50, 1.6, 0.3, 0.3),
  segura("LeftForeArm", "rx", -95, 1.6, 0.3, 0.3),
  segura("RightArm", "rx", -40, 1.6, 0.3, 0.3),
  segura("RightForeArm", "rx", -105, 1.6, 0.3, 0.3),
  segura("LeftUpLeg", "rx", -10, 1.6, 0.3, 0.3),
  segura("RightUpLeg", "rx", 8, 1.6, 0.3, 0.3),
  segura("Hips", "py", -0.04, 1.6, 0.3, 0.3),
]);

const SOCO = clip("SOCO", 1.0, 0.35, [
  segura("RightArm", "rx", -88, 1.0, 0.25, 0.45),
  segura("LeftArm", "rx", -50, 1.0, 0.2, 0.3),
  segura("LeftForeArm", "rx", -95, 1.0, 0.2, 0.3),
  segura("Spine2", "ry", 22, 1.0, 0.25, 0.45),
  segura("Hips", "ry", 10, 1.0, 0.25, 0.45),
  segura("raiz", "pz", 0.18, 1.0, 0.25, 0.45),
]);

const CHUTE = clip("CHUTE", 1.3, 0.5, [
  segura("RightUpLeg", "rx", -85, 1.3, 0.4, 0.5),
  tr("RightLeg", "rx", [
    [0, 0],
    [0.25, 60],
    [0.5, 4],
    [0.8, 30],
    [1.3, 0],
  ]),
  segura("Spine", "rx", -12, 1.3, 0.4, 0.5),
  segura("LeftArm", "rz", 32, 1.3, 0.3, 0.5),
  segura("RightArm", "rz", -32, 1.3, 0.3, 0.5),
]);

const DEFESA = clip("DEFESA", 1.2, 0.4, [
  segura("LeftArm", "rx", -70, 1.2, 0.25, 0.4),
  segura("LeftForeArm", "rx", -110, 1.2, 0.25, 0.4),
  segura("RightArm", "rx", -70, 1.2, 0.25, 0.4),
  segura("RightForeArm", "rx", -110, 1.2, 0.25, 0.4),
  segura("Spine", "rx", 8, 1.2, 0.25, 0.4),
  segura("raiz", "pz", -0.1, 1.2, 0.25, 0.4),
  segura("Hips", "py", -0.05, 1.2, 0.25, 0.4),
]);

const ESQUIVA = clip("ESQUIVA", 1.0, 0.4, [
  segura("raiz", "px", -0.35, 1.0, 0.3, 0.4),
  segura("Spine", "rz", 14, 1.0, 0.3, 0.4),
  segura("Hips", "py", -0.1, 1.0, 0.3, 0.4),
  segura("LeftUpLeg", "rx", -20, 1.0, 0.3, 0.4),
  segura("RightUpLeg", "rx", -20, 1.0, 0.3, 0.4),
  segura("LeftLeg", "rx", 40, 1.0, 0.3, 0.4),
  segura("RightLeg", "rx", 40, 1.0, 0.3, 0.4),
]);

/** Giro completo com um salto curto e o soco no fim; a luz do rastro acompanha (L_RASTRO). */
const GOLPE_ESPECIAL = clip("GOLPE_ESPECIAL", 2.2, 1.4, [
  tr("raiz", "ry", [
    [0, 0],
    [1.0, 360],
    [2.2, 360],
  ]),
  tr("raiz", "py", [
    [0, 0],
    [0.5, 0.12],
    [1.0, 0],
    [2.2, 0],
  ]),
  tr("RightArm", "rx", [
    [0, 0],
    [1.0, -30],
    [1.3, -95],
    [1.7, -95],
    [2.2, 0],
  ]),
  tr("raiz", "pz", [
    [0, 0],
    [1.0, 0],
    [1.3, 0.25],
    [1.7, 0.25],
    [2.2, 0],
  ]),
  segura("LeftArm", "rz", 40, 2.2, 0.4, 0.6),
]);

/** Cai de costas, fica no chão e levanta: o clipe sempre volta à pose parada. */
const QUEDA = clip("QUEDA", 3.6, 1.6, [
  segura("raiz", "rx", -82, 3.6, 0.7, 1.0),
  segura("raiz", "py", 0.12, 3.6, 0.7, 1.0),
  segura("raiz", "pz", -0.3, 3.6, 0.7, 1.0),
  segura("LeftArm", "rz", 50, 3.6, 0.6, 0.9),
  segura("RightArm", "rz", -50, 3.6, 0.6, 0.9),
]);

const F_GUARDA = clip("F_GUARDA", 1.6, 0.6, [
  segura("bracoE", "rx", -72, 1.6, 0.3, 0.3),
  segura("bracoD", "rx", -72, 1.6, 0.3, 0.3),
  segura("raiz", "py", -0.03, 1.6, 0.3, 0.3),
]);

const F_SOCO = clip("F_SOCO", 1.0, 0.35, [
  segura("bracoD", "rx", -95, 1.0, 0.25, 0.45),
  segura("bracoE", "rx", -60, 1.0, 0.2, 0.3),
  segura("raiz", "pz", 0.25, 1.0, 0.25, 0.45),
  segura("raiz", "rx", 6, 1.0, 0.25, 0.45),
]);

const F_DEFESA = clip("F_DEFESA", 1.2, 0.4, [
  segura("bracoE", "rx", -112, 1.2, 0.25, 0.4),
  segura("bracoD", "rx", -112, 1.2, 0.25, 0.4),
  segura("raiz", "pz", -0.12, 1.2, 0.25, 0.4),
]);

const F_RECUO = clip("F_RECUO", 1.2, 0.4, [
  segura("raiz", "pz", -0.3, 1.2, 0.25, 0.5),
  segura("raiz", "rx", -10, 1.2, 0.25, 0.5),
  segura("bracoE", "rz", 40, 1.2, 0.25, 0.5),
  segura("bracoD", "rz", -40, 1.2, 0.25, 0.5),
]);

const F_QUEDA = clip("F_QUEDA", 3.6, 1.6, [
  segura("raiz", "rx", -84, 3.6, 0.7, 1.0),
  segura("raiz", "py", 0.1, 3.6, 0.7, 1.0),
  segura("raiz", "pz", -0.3, 3.6, 0.7, 1.0),
  segura("bracoE", "rz", 50, 3.6, 0.6, 0.9),
  segura("bracoD", "rz", -50, 3.6, 0.6, 0.9),
]);

/** Luz do rastro da peça: acende no golpe e apaga, sem piscar. */
const L_RASTRO = clip("L_RASTRO", 2.0, 1.0, [segura("luz", "v", 1, 2.0, 0.5, 0.8)]);

export const CLIPS_LUTA: Clip[] = [GUARDA, SOCO, CHUTE, DEFESA, ESQUIVA, GOLPE_ESPECIAL, QUEDA, F_GUARDA, F_SOCO, F_DEFESA, F_RECUO, F_QUEDA, L_RASTRO];

export const PROPRIAS_LUTA = ["GUARDA", "SOCO", "CHUTE", "DEFESA", "ESQUIVA", "GOLPE_ESPECIAL", "QUEDA"];

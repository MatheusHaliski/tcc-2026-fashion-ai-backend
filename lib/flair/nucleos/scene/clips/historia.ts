/**
 * Animações próprias dos jogos de percurso: Fashion Detective (6), Boutique 3D (7), O Labirinto (10) e Around the
 * World (12) — mostrar o look, examinar a pista, entregar a peça, parar diante do espelho, olhar a vitrine, acenar —
 * e as dos figurantes e objetos dessas salas (porta, cliente, espelho, marcador do mapa).
 */
import { clip, onda, segura, tr, type Clip } from "@/lib/flair/nucleos/scene/clips";

/** Mostra o look: braços um pouco abertos e o corpo vira para um lado e para o outro. */
const MOSTRAR_O_LOOK = clip("MOSTRAR_O_LOOK", 3.0, 0.8, [
  segura("LeftArm", "rz", 30, 3.0, 0.5, 0.6),
  segura("RightArm", "rz", -30, 3.0, 0.5, 0.6),
  onda("raiz", "ry", 32, 3.0, 1, 0.5, 2.5),
  segura("Head", "rx", -5, 3.0),
]);

/** Examina a pista: inclina o tronco, a mão no queixo, olha para baixo. */
const EXAMINAR_A_PISTA = clip("EXAMINAR_A_PISTA", 3.2, 1.4, [
  segura("Spine", "rx", 24, 3.2, 0.7, 0.7),
  segura("Spine1", "rx", 12, 3.2, 0.7, 0.7),
  segura("Head", "rx", 14, 3.2, 0.7, 0.7),
  segura("RightArm", "rx", -20, 3.2, 0.7, 0.7),
  segura("RightForeArm", "rz", 140, 3.2, 0.7, 0.7),
  segura("Hips", "py", -0.06, 3.2, 0.7, 0.7),
]);

/** Entrega a peça: estende o braço para o lado da cliente e inclina o corpo. */
const ENTREGAR_A_PECA = clip("ENTREGAR_A_PECA", 2.4, 1.0, [
  segura("LeftArm", "rz", 78, 2.4, 0.6, 0.6),
  segura("LeftForeArm", "rx", -20, 2.4, 0.6, 0.6),
  segura("Spine", "rz", -8, 2.4, 0.6, 0.6),
  segura("Head", "ry", 30, 2.4, 0.6, 0.6),
]);

/** Para diante do espelho: ajeita a postura e inclina a cabeça. */
const PARAR_DIANTE_DO_ESPELHO = clip("PARAR_DIANTE_DO_ESPELHO", 2.2, 1.0, [
  segura("Spine1", "rx", -5, 2.2),
  segura("Head", "rz", 8, 2.2),
  segura("LeftArm", "rz", 10, 2.2),
  segura("RightArm", "rz", -10, 2.2),
]);

/** Apresenta o look ao espelho: abre os braços e gira meio corpo devagar. */
const APRESENTAR_O_LOOK = clip("APRESENTAR_O_LOOK", 3.4, 1.2, [
  segura("LeftArm", "rz", 42, 3.4, 0.6, 0.7),
  segura("RightArm", "rz", -42, 3.4, 0.6, 0.7),
  onda("raiz", "ry", 40, 3.4, 1, 0.6, 2.8),
  segura("Head", "rx", -6, 3.4),
]);

/** Atravessa a porta: um passo largo, o ombro na frente (quem leva o avatar é o passo da sequência). */
const ATRAVESSAR_A_PORTA = clip(
  "ATRAVESSAR_A_PORTA",
  1.2,
  0.3,
  [
    onda("LeftUpLeg", "rx", -28, 1.2, 1),
    onda("RightUpLeg", "rx", 28, 1.2, 1),
    segura("Spine2", "ry", 18, 1.2, 0.3, 0.3),
    segura("Head", "rx", 6, 1.2, 0.3, 0.3),
  ],
  true,
);

/** Caminhada de rua: passo solto, braços balançando mais. */
const CAMINHADA_DE_RUA = clip(
  "CAMINHADA_DE_RUA",
  1.2,
  0.3,
  [
    onda("LeftUpLeg", "rx", -22, 1.2, 1),
    onda("RightUpLeg", "rx", 22, 1.2, 1),
    tr("LeftLeg", "rx", [
      [0, 0],
      [0.6, 0],
      [0.9, 24],
      [1.2, 0],
    ]),
    tr("RightLeg", "rx", [
      [0, 0],
      [0.3, 24],
      [0.6, 0],
      [1.2, 0],
    ]),
    onda("LeftArm", "rx", 22, 1.2, 1),
    onda("RightArm", "rx", -22, 1.2, 1),
    onda("Head", "ry", 6, 1.2, 1),
  ],
  true,
);

/** Olha a vitrine: a cabeça e o tronco viram para o lado da loja. */
const OLHAR_A_VITRINE = clip("OLHAR_A_VITRINE", 2.8, 1.2, [
  segura("Neck", "ry", 22, 2.8, 0.6, 0.6),
  segura("Head", "ry", 40, 2.8, 0.6, 0.6),
  segura("Spine2", "ry", 18, 2.8, 0.6, 0.6),
  segura("Head", "rx", 4, 2.8, 0.6, 0.6),
]);

/** Acena para quem passa. */
const ACENAR = clip("ACENAR", 2.8, 1.0, [
  segura("RightArm", "rz", -150, 2.8, 0.45, 0.5),
  onda("RightForeArm", "rz", 24, 2.8, 3, 0.45, 2.3),
  segura("Head", "ry", -14, 2.8),
]);

/** A cliente prova a peça e dá uma volta completa. */
const F_PROVA_E_GIRA = clip("F_PROVA_E_GIRA", 3.6, 1.8, [
  tr("raiz", "ry", [
    [0, 0],
    [0.6, 0],
    [3.0, 360],
    [3.6, 360],
  ]),
  segura("bracoE", "rz", 30, 3.6, 0.6, 0.6),
  segura("bracoD", "rz", -30, 3.6, 0.6, 0.6),
]);

/** A cliente devolve: estende a peça de volta e nega com o corpo. */
const F_DEVOLVE = clip("F_DEVOLVE", 2.6, 1.0, [
  segura("bracoD", "rx", -70, 2.6, 0.5, 0.6),
  onda("raiz", "ry", 9, 2.6, 2, 0.5, 2.0),
]);

/** O segurança barra a passagem: o braço atravessado. */
const F_BARRA = clip("F_BARRA", 3.0, 1.2, [
  segura("bracoD", "rz", -88, 3.0, 0.5, 0.7),
  segura("raiz", "px", -0.3, 3.0, 0.5, 0.7),
]);

/** Folha de porta que abre para dentro (a sequência mantém aberta). */
const M_PORTA_ABRE = clip("M_PORTA_ABRE", 2.4, 1.6, [segura("movel", "ry", 96, 2.4, 1.4, 0.4)]);

/** A outra folha, que abre no sentido contrário. */
const M_PORTA_ABRE_D = clip("M_PORTA_ABRE_D", 2.4, 1.6, [segura("movel", "ry", -96, 2.4, 1.4, 0.4)]);

/** O cordão sai da frente (desliza para o lado). */
const M_CORDAO_ABRE = clip("M_CORDAO_ABRE", 2.0, 1.2, [segura("movel", "px", 2.4, 2.0, 1.0, 0.4)]);

/** O marcador do mapa anda até a próxima região. */
const M_MAPA_AVANCA = clip("M_MAPA_AVANCA", 2.4, 1.6, [
  segura("movel", "px", 0.28, 2.4, 1.4, 0.4),
  segura("movel", "py", 0.16, 2.4, 1.4, 0.4),
]);

/** O espelho ondula em vermelho: a luz vai e volta duas vezes e meia por segundo, no máximo. */
const L_ONDULA = clip("L_ONDULA", 2.0, 0.2, [
  tr("luz", "v", [
    [0, 0],
    [0.2, 1],
    [0.6, 0.2],
    [1.0, 1],
    [1.4, 0.2],
    [1.8, 0.8],
    [2.0, 0],
  ]),
]);

export const CLIPS_HISTORIA: Clip[] = [
  MOSTRAR_O_LOOK,
  EXAMINAR_A_PISTA,
  ENTREGAR_A_PECA,
  PARAR_DIANTE_DO_ESPELHO,
  APRESENTAR_O_LOOK,
  ATRAVESSAR_A_PORTA,
  CAMINHADA_DE_RUA,
  OLHAR_A_VITRINE,
  ACENAR,
  F_PROVA_E_GIRA,
  F_DEVOLVE,
  F_BARRA,
  M_PORTA_ABRE,
  M_PORTA_ABRE_D,
  M_CORDAO_ABRE,
  M_MAPA_AVANCA,
  L_ONDULA,
];

export const PROPRIAS_DETECTIVE = ["CAMINHAR", "MOSTRAR_O_LOOK", "EXAMINAR_A_PISTA"];
export const PROPRIAS_BOUTIQUE = ["ENTREGAR_A_PECA", "F_PROVA_E_GIRA", "F_COMEMORA", "F_DEVOLVE"];
export const PROPRIAS_LABIRINTO = ["CAMINHAR", "PARAR_DIANTE_DO_ESPELHO", "APRESENTAR_O_LOOK", "ATRAVESSAR_A_PORTA"];
export const PROPRIAS_AROUND_THE_WORLD = ["CAMINHADA_DE_RUA", "OLHAR_A_VITRINE", "ACENAR"];

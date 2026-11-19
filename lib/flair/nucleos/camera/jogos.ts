/**
 * O conjunto de câmeras de cada um dos 15 jogos (docs/flair/flair-3d/CAMERAS.md): a lista que o seletor do HUD mostra e
 * qual delas a câmera automática usa em cada momento da partida (preparo, ação, resultado). Nenhum jogo usa a câmera
 * frontal chapada do provador: o preparo é em três quartos, com o corpo inteiro e a profundidade do lugar, e a ação tem
 * a câmera que o gênero pede (lado do ringue, travelling da passarela, exploração por trás do ombro, transmissão).
 * As posições são relativas ao avatar (metros); a sala de cada jogo limita a câmera pelas paredes. Puro.
 */
import type { Camera } from "@/lib/flair/nucleos/camera/rigs";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/** "AUTO" = a câmera muda sozinha com o momento da partida; os outros são os ids das câmeras do jogo. */
export const CAMERA_AUTOMATICA = "AUTO";
export type MomentoDaCamera = "PREPARO" | "ACAO" | "RESULTADO";

export interface CamerasDoJogo {
  cameras: Camera[];
  /** a câmera da automática em cada momento (ids de `cameras`) */
  momento: Record<MomentoDaCamera, string>;
}

/** O preparo de todo jogo: três quartos, corpo inteiro, na altura do peito. */
const TRES_QUARTOS: Camera = { id: "TRES_QUARTOS", rig: "ORBITAL", dist: 4.2, altura: 1.35, angulo: 24 };
/** Nos duelos o par fica lado a lado (o adversário à direita): o preparo vem da esquerda, para os dois caberem inteiros. */
const TRES_QUARTOS_DO_PAR: Camera = { ...TRES_QUARTOS, angulo: -24 };
const ORBITAL_360: Camera = { id: "ORBITAL_360", rig: "ORBITAL", dist: 4, altura: 1.5, velocidade: 14 };
const CLOSE_ROUPA: Camera = { id: "CLOSE_ROUPA", rig: "CLOSE", dist: 2, altura: 1.25, angulo: 18, mira: 1.15 };
const CLOSE_ROSTO: Camera = { id: "CLOSE_ROSTO", rig: "CLOSE", dist: 1.05, altura: 1.6, angulo: 12, mira: 1.58, fov: 30 };
const grua = (dist = 5, de = 1.4, ate = 3.6, angulo = -20): Camera => ({ id: "GRUA", rig: "GRUA", dist, altura: de, ate, angulo, velocidade: 0.06 });
const travelling = (dist = 4.6, de = -38, ate = 38, altura = 1.3): Camera => ({ id: "TRAVELLING", rig: "TRILHO", dist, altura, angulo: de, ate, velocidade: 0.07 });
const lateral = (dist = 5, altura = 1.3, angulo = 0): Camera => ({ id: "LATERAL", rig: "LATERAL", dist, altura, angulo });
/** Nos duelos o adversário fica ao lado do avatar: a câmera vai para o lado oposto, em diagonal, e mostra os dois. */
const DUELO = -128;
const aerea = (altura = 7): Camera => ({ id: "AEREA", rig: "AEREA", dist: 0.6, altura, fov: 40 });
/**
 * A câmera de exploração (RPG em terceira pessoa): atrás e acima do ombro, alta o bastante para mostrar o piso à frente
 * (os cones de visão dos vigias, os esconderijos) e olhando para onde a pessoa anda.
 */
const EXPLORACAO: Camera = { id: "EXPLORACAO", rig: "SEGUE", dist: 3.6, altura: 3.4, mira: 0.7, angulo: 12, fov: 48 };
/**
 * A luta de arcade: de lado, as duas de perfil no mesmo plano, lente longa (quase sem perspectiva) e parada; e a de
 * terceira pessoa por trás do ombro da avatar, olhando para a oponente (auditoria dos jogos, pergunta 6).
 */
const ARCADE: Camera = { id: "ARCADE", rig: "LATERAL", dist: 6, altura: 1.15, angulo: -90, mira: 1.0, fov: 28 };
const OMBRO: Camera = { id: "OMBRO", rig: "SEGUE", dist: 2.2, altura: 1.75, angulo: 18, mira: 1.3, fov: 50 };
/** A câmera de RPG de cima: alta, em diagonal, parada. */
const ISOMETRICA: Camera = { id: "ISOMETRICA", rig: "ORBITAL", dist: 5.2, altura: 5.4, angulo: 35, mira: 0.6, fov: 38 };
/**
 * Do fosso dos fotógrafos, ou da plateia: de baixo para cima, de frente, presas ao lugar (rig orbital parado), para
 * recuarem na tela em pé e manterem o corpo inteiro no quadro.
 */
const FOSSO: Camera = { id: "FOSSO", rig: "ORBITAL", dist: 4.4, altura: 0.55, angulo: -8, mira: 1.0 };
const PLATEIA: Camera = { id: "PLATEIA", rig: "ORBITAL", dist: 5.2, altura: 1, angulo: 10, mira: 1.25 };
/** O ângulo de herói: bem de baixo, com o teto ou o céu atrás, ainda com os pés no quadro. */
const CONTRA_PLONGEE: Camera = { id: "CONTRA_PLONGEE", rig: "ORBITAL", dist: 3.6, altura: 0.4, angulo: 20, mira: 1.2, fov: 42 };

const jogo = (acao: string, resultado: string, ...cameras: Camera[]): CamerasDoJogo => ({ cameras: [TRES_QUARTOS, ...cameras], momento: { PREPARO: "TRES_QUARTOS", ACAO: acao, RESULTADO: resultado } });

const duelo = (acao: string, resultado: string, ...cameras: Camera[]): CamerasDoJogo => ({ ...jogo(acao, resultado), cameras: [TRES_QUARTOS_DO_PAR, ...cameras] });

export const CAMERAS: Record<NucleoCodigo, CamerasDoJogo> = {
  PASSARELA: jogo("TRAVELLING", "GRUA", travelling(), FOSSO, grua(), ORBITAL_360, CLOSE_ROUPA),
  DRESS_FIGHTER: duelo("ARCADE", "ORBITAL_360", ARCADE, OMBRO, lateral(5.6, 1.3, DUELO), ORBITAL_360, aerea(6.5), CLOSE_ROUPA),
  DRESS_THE_STAR: jogo("FOSSO", "ORBITAL_360", FOSSO, travelling(4.4, -30, 30), ORBITAL_360, grua(), CLOSE_ROUPA),
  PERSONAGEM_FILME: jogo("TRAVELLING", "GRUA", travelling(4.8, -45, 30, 1.2), grua(5.2, 1.2, 3.8, 25), lateral(4.6), CLOSE_ROUPA),
  ROAD_TO_GLORY: jogo("CLOSE_ROSTO", "ORBITAL_360", CLOSE_ROSTO, ORBITAL_360, lateral(3.2, 1.5), CLOSE_ROUPA),
  FASHION_DETECTIVE: jogo("EXPLORACAO", "CLOSE_ROUPA", EXPLORACAO, ISOMETRICA, aerea(8), CLOSE_ROUPA),
  // loja e rua têm móveis atrás da avatar (provador, vitrines): o resultado fica no travelling da frente, não no giro
  BOUTIQUE_3D: jogo("TRAVELLING", "TRAVELLING", travelling(4.4, -50, 20, 1.4), lateral(4.4), ORBITAL_360, aerea(6), CLOSE_ROUPA),
  CLUBE_CORACAO: jogo("ORBITAL_360", "GRUA", ORBITAL_360, grua(5.4, 1.6, 4), lateral(4.6), CLOSE_ROUPA),
  FAVORITE_SINGER: jogo("GRUA", "PLATEIA", grua(5.4, 1.2, 4, 30), PLATEIA, ORBITAL_360, lateral(4.8, 1.4), CLOSE_ROUPA),
  LABIRINTO: jogo("EXPLORACAO", "ORBITAL_360", EXPLORACAO, aerea(9), ISOMETRICA, ORBITAL_360, CLOSE_ROUPA),
  PILOTO_FAVORITO: jogo("ORBITAL_360", "GRUA", ORBITAL_360, lateral(4.8, 0.9), grua(5.2, 1.3, 3.4), aerea(7), CLOSE_ROUPA),
  AROUND_THE_WORLD: jogo("EXPLORACAO", "TRAVELLING", EXPLORACAO, travelling(4.8, -40, 40, 1.5), aerea(8), ORBITAL_360, CLOSE_ROUPA),
  SUPER_HEROI: jogo("CONTRA_PLONGEE", "GRUA", CONTRA_PLONGEE, grua(5, 1, 4.2, -30), ORBITAL_360, lateral(4.6), CLOSE_ROUPA),
  FASHION_SPORTS: jogo("ORBITAL_360", "GRUA", ORBITAL_360, grua(), lateral(4.6), CLOSE_ROUPA),
  BATALHA_LOOKS: duelo("LATERAL", "ORBITAL_360", lateral(5.6, 1.3, DUELO), PLATEIA, ORBITAL_360, grua(5.2, 1.4, 3.6, 20), CLOSE_ROUPA),
};

export function camerasDe(codigo: NucleoCodigo): CamerasDoJogo {
  return CAMERAS[codigo];
}

/** A câmera em uso: a escolhida no seletor ou, na automática (ou com escolha que o jogo não tem), a do momento. */
export function cameraEmUso(codigo: NucleoCodigo, escolha: string | null | undefined, momento: MomentoDaCamera): Camera {
  const { cameras, momento: porMomento } = CAMERAS[codigo];
  const id = escolha && escolha !== CAMERA_AUTOMATICA && cameras.some((c) => c.id === escolha) ? escolha : porMomento[momento];
  return cameras.find((c) => c.id === id) ?? cameras[0];
}

/** As opções do seletor, na ordem: a automática e as câmeras do jogo. */
export function opcoesDeCamera(codigo: NucleoCodigo): string[] {
  return [CAMERA_AUTOMATICA, ...CAMERAS[codigo].cameras.map((c) => c.id)];
}

/** A próxima opção do seletor (dá a volta). */
export function proximaCamera(opcoes: string[], atual: string | null | undefined): string {
  const i = opcoes.indexOf(atual ?? CAMERA_AUTOMATICA);
  return opcoes[(i + 1) % opcoes.length];
}

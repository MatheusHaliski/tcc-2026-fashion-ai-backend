/**
 * Câmeras dos jogos FLAIR 3D (pedido da dona de 15/11/2026: "estude câmeras convenientes; não adote a câmera frontal
 * simplificada"; docs/flair/flair-3d/CAMERAS.md). Uma biblioteca só, para todos os jogos: cada câmera é um "rig" com
 * poucos números, e esta função diz onde ela fica e para onde olha em cada instante. Os rigs: orbital (gira em volta do
 * assunto), segue (atrás de quem anda, a câmera de exploração), trilho (travelling entre dois pontos), grua (sobe e
 * desce em arco), transmissão (do alto da lateral, acompanhando), lateral (de lado, na altura do corpo), aérea (de
 * cima) e close (bem perto, na roupa ou no rosto). Tudo em metros; y para cima. Puro: o tempo vem de quem chama.
 */
import { foraDosCorpos, foraDosMoveis, porCimaDosMoveis } from "@/lib/flair/nucleos/camera/colisao";
import type { V3 } from "@/lib/flair/nucleos/types";

export type RigTipo = "ORBITAL" | "SEGUE" | "TRILHO" | "GRUA" | "TRANSMISSAO" | "LATERAL" | "AEREA" | "CLOSE";
export const RIGS: readonly RigTipo[] = ["ORBITAL", "SEGUE", "TRILHO", "GRUA", "TRANSMISSAO", "LATERAL", "AEREA", "CLOSE"];

export interface Camera {
  /** identificador da câmera dentro do jogo (chave do texto: flair3d.camera.<id>) */
  id: string;
  rig: RigTipo;
  /** distância horizontal até o assunto */
  dist: number;
  /** altura da lente acima do piso do assunto */
  altura: number;
  /** altura do ponto olhado acima do piso do assunto (padrão: o peito, 1,1 m) */
  mira?: number;
  /** ângulo em volta do assunto, em graus (0 = de frente para ele, 90 = do lado direito dele, 180 = por trás) */
  angulo?: number;
  /** orbital e trilho: graus (ou ciclos) por segundo; grua: ciclos por segundo */
  velocidade?: number;
  /** trilho: até que ângulo o travelling vai; grua: até que altura a lente sobe */
  ate?: number;
  /** quanto a câmera acompanha o assunto (transmissão: 0 = parada no centro, 1 = colada nele) */
  acompanha?: number;
  fov?: number;
}

/** O que a câmera filma: o ponto no piso onde o assunto está, para onde ele está virado e os limites do lugar. */
export interface Assunto {
  pos: V3;
  /** para onde o assunto olha, em graus (0 = para +z, como o avatar parado no provador) */
  giro?: number;
  /** o centro do lugar (a transmissão fica presa a ele) */
  centro?: V3;
  /** paredes: a câmera nunca sai desta caixa (x mínimo e máximo, z mínimo e máximo, teto) */
  limites?: { x: [number, number]; z: [number, number]; teto: number };
  /** as pessoas de cena (os pés e a altura de cada uma): a lente nunca fica dentro do corpo delas (colisao.ts) */
  evita?: { pos: V3; altura: number }[];
  /** os móveis do lugar, como caixas (mínimo e máximo em x, y e z): a lente nunca fica dentro de um */
  caixas?: Caixa[];
}

export interface Caixa {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

export interface Pose {
  pos: V3;
  alvo: V3;
  fov: number;
}

const RAD = Math.PI / 180;
export const FOV_PADRAO = 35;
/** A proporção de quadro para a qual as distâncias foram pensadas; em tela em pé a câmera recua. */
export const ASPECTO_DE_REFERENCIA = 1.5;

const vaivem = (t: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t);

/** Ponto a `dist` do assunto, no ângulo dado em volta dele (0 = à frente dele), na altura dada. */
function emVolta(s: Assunto, angulo: number, dist: number, altura: number): V3 {
  const a = ((s.giro ?? 0) + angulo) * RAD;
  return [s.pos[0] + Math.sin(a) * dist, s.pos[1] + altura, s.pos[2] + Math.cos(a) * dist];
}

function crua(c: Camera, s: Assunto, t: number): { pos: V3; alvo: V3 } {
  const mira: V3 = [s.pos[0], s.pos[1] + (c.mira ?? 1.1), s.pos[2]];
  const angulo = c.angulo ?? 0;
  switch (c.rig) {
    case "ORBITAL":
      return { pos: emVolta({ ...s, giro: 0 }, angulo + (c.velocidade ?? 0) * t, c.dist, c.altura), alvo: mira };
    case "SEGUE":
      // atrás do assunto, olhando por cima do ombro para onde ele vai
      return { pos: emVolta(s, 180 + angulo, c.dist, c.altura), alvo: emVolta(s, 0, 1.2, c.mira ?? 1.3) };
    case "TRILHO": {
      const k = vaivem(t * (c.velocidade ?? 0.05));
      return { pos: emVolta({ ...s, giro: 0 }, angulo + ((c.ate ?? angulo) - angulo) * k, c.dist, c.altura), alvo: mira };
    }
    case "GRUA": {
      const k = vaivem(t * (c.velocidade ?? 0.05));
      const altura = c.altura + ((c.ate ?? c.altura) - c.altura) * k;
      return { pos: emVolta({ ...s, giro: 0 }, angulo, c.dist * (1 - 0.25 * k), altura), alvo: mira };
    }
    case "TRANSMISSAO": {
      const centro = s.centro ?? s.pos;
      const quanto = c.acompanha ?? 0.7;
      const x = centro[0] + (s.pos[0] - centro[0]) * quanto;
      return { pos: [x, centro[1] + c.altura, centro[2] + c.dist], alvo: [x + (s.pos[0] - x) * 0.5, centro[1] + (c.mira ?? 0), centro[2] + (s.pos[2] - centro[2]) * 0.3] };
    }
    case "LATERAL":
      return { pos: emVolta({ ...s, giro: 0 }, 90 + angulo, c.dist, c.altura), alvo: mira };
    case "AEREA":
      // de cima: um pouco para trás, para o "para cima" da imagem ser o fundo do lugar
      return { pos: [s.pos[0], s.pos[1] + c.altura, s.pos[2] + Math.max(0.01, c.dist)], alvo: [s.pos[0], s.pos[1], s.pos[2]] };
    default:
      return { pos: emVolta(s, angulo, c.dist, c.altura), alvo: mira };
  }
}

/** Mantém a câmera dentro das paredes e abaixo do teto do lugar. */
export function dentroDoLugar(pos: V3, limites: Assunto["limites"]): V3 {
  if (!limites) return pos;
  const folga = 0.25;
  return [
    Math.max(limites.x[0] + folga, Math.min(limites.x[1] - folga, pos[0])),
    Math.max(0.3, Math.min(limites.teto - folga, pos[1])),
    Math.max(limites.z[0] + folga, Math.min(limites.z[1] - folga, pos[2])),
  ];
}

/** A menor distância da lente ao assunto (fora do close): mais perto que isso ela entra no corpo. */
export const DISTANCIA_MINIMA = 1.7;

/**
 * Quando a parede empurra a câmera para perto do assunto (canto da sala, calçada estreita, a queda no fim da luta), a
 * lente sobe até ficar a `minima` do peito, olhando de cima, em vez de entrar no corpo; nunca acima do teto.
 */
export function afastadaDoCorpo(pos: V3, s: Assunto, mira: number, minima = DISTANCIA_MINIMA): V3 {
  const dx = pos[0] - s.pos[0];
  const dz = pos[2] - s.pos[2];
  const horizontal = Math.hypot(dx, dz);
  if (horizontal >= minima) return pos;
  const peito = s.pos[1] + mira;
  const y = Math.max(pos[1], peito + Math.sqrt(minima * minima - horizontal * horizontal));
  const teto = s.limites ? s.limites.teto - 0.25 : Infinity;
  return [pos[0], Math.min(teto, y), pos[2]];
}

/** Em tela em pé o quadro é estreito: a câmera recua na mesma linha para caber a mesma largura (o close não recua). */
export function recuada(pos: V3, alvo: V3, aspecto: number): V3 {
  const quanto = Math.max(1, Math.min(2.2, ASPECTO_DE_REFERENCIA / Math.max(0.1, aspecto)));
  return quanto === 1 ? pos : [alvo[0] + (pos[0] - alvo[0]) * quanto, alvo[1] + (pos[1] - alvo[1]) * quanto, alvo[2] + (pos[2] - alvo[2]) * quanto];
}

/**
 * Onde a câmera fica e para onde olha no instante `t` (segundos). Com `parada` (reduzir movimento) as câmeras que
 * andam sozinhas (orbital com velocidade, trilho, grua) ficam no ponto de partida.
 */
export function poseDoRig(c: Camera, s: Assunto, t: number, aspecto = ASPECTO_DE_REFERENCIA, parada = false): Pose {
  const { pos, alvo } = crua(c, s, parada ? 0 : t);
  const longe = c.rig === "CLOSE" ? pos : recuada(pos, alvo, aspecto);
  const dentro = foraDosMoveis(dentroDoLugar(longe, s.limites), alvo, s);
  // só quando a parede trouxe a lente para perto: o close e o zoom pedidos de propósito continuam perto
  const pedida = Math.hypot(longe[0] - s.pos[0], longe[2] - s.pos[2]);
  const minima = Math.min(DISTANCIA_MINIMA, pedida);
  const livre = c.rig === "CLOSE" ? dentro : afastadaDoCorpo(dentro, s, c.mira ?? 1.1, minima);
  // a ordem importa: paredes, móveis, o corpo de quem é filmado, as pessoas de cena; o que subiu não volta a entrar em móvel
  return { pos: porCimaDosMoveis(foraDosCorpos(livre, s), s), alvo, fov: c.fov ?? FOV_PADRAO };
}

/** Aproxima a pose atual da pedida (a câmera segue suave; na troca de câmera, quem chama salta para a nova). */
export function aproximar(atual: Pose, pedida: Pose, quanto: number): Pose {
  const m = (a: number, b: number) => a + (b - a) * quanto;
  const v = (a: V3, b: V3): V3 => [m(a[0], b[0]), m(a[1], b[1]), m(a[2], b[2])];
  return { pos: v(atual.pos, pedida.pos), alvo: v(atual.alvo, pedida.alvo), fov: m(atual.fov, pedida.fov) };
}

/** A câmera anda sozinha (precisa de quadro a quadro mesmo com o assunto parado)? */
export function andaSozinha(c: Camera): boolean {
  return (c.rig === "ORBITAL" && !!c.velocidade) || c.rig === "TRILHO" || c.rig === "GRUA";
}

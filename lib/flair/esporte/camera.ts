/**
 * A câmera da transmissão do Fashion Sports (pedido da dona de 15/11/2026: "câmera tipo transmissão TV", não a frontal
 * do provador). Três planos: a transmissão (do alto da lateral, acompanhando a bola), o lance (mais perto, na
 * finalização, na defesa e no desarme) e o replay (bem perto do jogador que agiu com a carta: é onde a roupa aparece).
 * Com "reduzir movimento" a câmera não viaja: fica no plano geral, parada, e os lances aparecem em texto. Puro.
 */
import { noMundo, type Campo } from "@/lib/flair/esporte/campo";
import { CAMERA_AUTOMATICA } from "@/lib/flair/nucleos/camera/jogos";
import { poseDoRig, type Camera } from "@/lib/flair/nucleos/camera/rigs";
import { finalizacao } from "@/lib/flair/esporte/timeline";
import type { Jogada, Ponto } from "@/lib/flair/esporte/types";

export type Plano = "geral" | "transmissao" | "lance" | "replay";

export interface Pose {
  pos: [number, number, number];
  alvo: [number, number, number];
}

/** A partir de quanto do lance a câmera corta para perto, e para o replay da carta. */
export const CORTE_DO_LANCE = 0.45;
/** O replay vem depois de a bola chegar à rede (0,72): antes dele, o plano do lance mostra a rede balançando. */
export const CORTE_DO_REPLAY = 0.86;

const DE_PERTO = new Set(["DESARME", "DESARME_FALHO"]);
/** A proporção de quadro para a qual as distâncias foram medidas; abaixo dela a câmera recua. */
export const ASPECTO_DE_TV = 1.5;
/** Distância do replay até o jogador: com fov 32 o corpo inteiro (1,8 m) ocupa uns dois terços da altura do quadro. */
export const REPLAY_DIST = 5.2;

/** O plano da câmera no instante k do lance. */
export function planoDaCamera(lance: Jogada | null, k: number, reduzido: boolean): Plano {
  if (reduzido || !lance) return "geral";
  if (lance.carta && lance.ok && k >= CORTE_DO_REPLAY) return "replay";
  if ((finalizacao(lance.tipo) || DE_PERTO.has(lance.tipo)) && k >= CORTE_DO_LANCE) return "lance";
  return "transmissao";
}

/**
 * Onde a câmera fica e para onde olha, em metros. `bola` e `foco` (o jogador do replay) vêm nas coordenadas do
 * servidor. A câmera fica sempre do mesmo lado do campo (z positivo), como numa transmissão: nunca cruza o eixo.
 */
export function poseDaCamera(plano: Plano, campo: Campo, bola: Ponto, foco: Ponto | null, aspecto = 16 / 9): Pose {
  if (plano === "replay" && foco) {
    // o jogador inteiro, da cabeça ao calçado, um pouco de cima: quem está perto dele fica fora do eixo da lente
    const [fx, fz] = noMundo(campo, foco);
    return { pos: [fx + 1.2, 2.4, fz + REPLAY_DIST], alvo: [fx, 1.15, fz] };
  }
  return afastada(poseAberta(plano, campo, bola), aspecto);
}

/** Em tela em pé (celular) o quadro é estreito: a câmera recua na mesma linha para caber a mesma largura de campo. */
export function afastada(pose: Pose, aspecto: number): Pose {
  const quanto = Math.max(1, Math.min(2.2, ASPECTO_DE_TV / Math.max(0.1, aspecto)));
  if (quanto === 1) return pose;
  const longe = (i: 0 | 1 | 2) => pose.alvo[i] + (pose.pos[i] - pose.alvo[i]) * quanto;
  return { pos: [longe(0), longe(1), longe(2)], alvo: pose.alvo };
}

function poseAberta(plano: Plano, campo: Campo, bola: Ponto): Pose {
  const [bx, bz] = noMundo(campo, bola);
  const meia = campo.largura / 2;
  if (plano === "geral") {
    // o campo inteiro, as duas traves e a arquibancada do outro lado (fov 32: o comprimento cabe a 1,25 × de distância)
    const recuo = Math.max(campo.comprimento * 1.05, 16);
    return { pos: [0, recuo * 0.55, meia + recuo * 0.85], alvo: [0, 0, -meia * 0.15] };
  }
  // quadra pequena (basquete, vôlei, tênis): a transmissão mostra a quadra inteira, e o lance não cola no jogador
  const quadra = campo.comprimento < 30;
  if (plano === "lance") {
    const recuo = quadra ? meia + campo.comprimento * 0.45 : Math.max(bz + 9, meia + 3);
    return { pos: [bx * 0.9, quadra ? 3.6 + campo.largura * 0.15 : 4.2, recuo], alvo: [bx, 0.8, bz] };
  }
  if (quadra) {
    const cx = bx * 0.35;
    return { pos: [cx, 3 + campo.comprimento * 0.4, meia + campo.comprimento * 0.85], alvo: [cx + (bx - cx) * 0.4, 0, bz * 0.2] };
  }
  const limite = campo.comprimento / 2 - 4;
  const cx = Math.max(-limite, Math.min(limite, bx * 0.7));
  return { pos: [cx, 11 + campo.largura * 0.15, meia + 13], alvo: [cx + (bx - cx) * 0.5, 0, bz * 0.3] };
}

/**
 * As câmeras do campo que a pessoa pode escolher no seletor, além da automática (a transmissão com cortes): a lateral
 * baixa que corre com a bola, a aérea tática, a de trás do gol e a orbital do estádio. Usam os rigs comuns a todos os
 * jogos (lib/flair/nucleos/camera/rigs.ts).
 */
export const CAMERAS_DO_CAMPO: readonly string[] = [CAMERA_AUTOMATICA, "LATERAL", "AEREA", "ATRAS_DO_GOL", "ORBITAL_360"];

/** A pose da câmera escolhida no instante t (segundos), ou null na automática (ou em uma escolha que o campo não tem). */
export function poseEscolhida(id: string | null | undefined, campo: Campo, bola: Ponto, t: number, aspecto = 16 / 9, parada = false): Pose | null {
  const [bx, bz] = noMundo(campo, bola);
  const meio = campo.comprimento / 2;
  const meia = campo.largura / 2;
  const centro: [number, number, number] = [0, 0, 0];
  let camera: Camera;
  let pos: [number, number, number] = [bx, 0, bz];
  switch (id) {
    case "LATERAL":
      // alta o bastante para passar por cima do túnel e dos bancos na beira do campo
      camera = { id, rig: "TRANSMISSAO", dist: meia + 6, altura: 4.5, mira: 0.9, acompanha: 1 };
      break;
    case "AEREA":
      camera = { id, rig: "AEREA", dist: 0.5, altura: Math.max(campo.comprimento * 0.95, 16) };
      pos = centro;
      break;
    case "ATRAS_DO_GOL":
      // atrás do gol da pessoa, do alto, olhando o campo inteiro e a bola
      return { pos: [-meio - 5.5, 5.5, 0], alvo: [bx * 0.6, 0.6, bz * 0.6] };
    case "ORBITAL_360":
      camera = { id, rig: "ORBITAL", dist: campo.comprimento * 0.8, altura: 9, mira: 0, velocidade: 6, angulo: 0 };
      pos = centro;
      break;
    default:
      return null;
  }
  const pose = poseDoRig(camera, { pos, centro }, t, aspecto, parada);
  return { pos: pose.pos, alvo: pose.alvo };
}

/**
 * No replay a câmera fica a REPLAY_DIST do jogador, do lado da transmissão: quem está nesse corredor, entre a lente e
 * ele, taparia a roupa. Diz se o outro jogador está aí (a cena o esconde só enquanto dura o replay).
 */
export function tapaOReplay(campo: Campo, foco: Ponto, outro: Ponto): boolean {
  const [fx, fz] = noMundo(campo, foco);
  const [ox, oz] = noMundo(campo, outro);
  const frente = oz - fz;
  return frente > 0.4 && frente < REPLAY_DIST + 1.5 && Math.abs(ox - fx - (frente / REPLAY_DIST) * 1.2) < 1.4;
}

/** Aproxima a pose atual da pose pedida (a câmera segue suave; no corte, salta). */
export function seguir(atual: Pose, pedida: Pose, quanto: number): Pose {
  const m = (a: number, b: number) => a + (b - a) * quanto;
  return {
    pos: [m(atual.pos[0], pedida.pos[0]), m(atual.pos[1], pedida.pos[1]), m(atual.pos[2], pedida.pos[2])],
    alvo: [m(atual.alvo[0], pedida.alvo[0]), m(atual.alvo[1], pedida.alvo[1]), m(atual.alvo[2], pedida.alvo[2])],
  };
}

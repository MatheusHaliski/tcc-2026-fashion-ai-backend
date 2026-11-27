/**
 * ACERVO — planta de frente de um móvel, em centímetros, calculada só da configuração (medidas e compartimentos). É a
 * mesma planta para o mapa do closet (2D), para a reserva sem WebGL e para a cena 3D: gavetas embaixo, cabideiros à
 * esquerda e prateleiras à direita, como num guarda-roupa comum. A origem é o canto inferior esquerdo do móvel.
 */
import type { AcervoCompartimento, AcervoMovel, AcervoTipo } from "./types";

export interface Celula {
  id: string;
  tipo: AcervoTipo;
  nome: string;
  pecas: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Planta {
  largura: number;
  altura: number;
  profundidade: number;
  /** espessura das chapas */
  chapa: number;
  /** altura do rodapé (zero no Dream Space, onde o módulo fica suspenso) */
  rodape: number;
  celulas: Celula[];
}

export const CHAPA_CM = 3;
const RODAPE_CM = 8;
const GAVETA_CM = 22;
/** fração da altura útil que as gavetas podem ocupar quando há outros compartimentos */
const GAVETAS_MAX = 0.5;
/** fração da largura útil dos cabideiros quando dividem o vão com prateleiras */
const CABIDEIRO_LARGURA = 0.6;

const doTipo = (movel: AcervoMovel, tipo: AcervoTipo): AcervoCompartimento[] =>
  movel.compartimentos.filter((c) => c.tipo === tipo).sort((a, b) => a.ordem - b.ordem);

/** Empilha os compartimentos de cima para baixo dentro de um vão. */
function empilhar(lista: AcervoCompartimento[], x: number, base: number, w: number, h: number): Celula[] {
  if (lista.length === 0) return [];
  const cada = h / lista.length;
  return lista.map((c, i) => ({ id: c.id, tipo: c.tipo, nome: c.nome, pecas: c.pecas, x, y: base + h - (i + 1) * cada, w, h: cada }));
}

export function plantaDoMovel(movel: AcervoMovel): Planta {
  const chapa = CHAPA_CM;
  const rodape = movel.modo === "DREAM_SPACE" ? 0 : RODAPE_CM;
  const x0 = chapa;
  const y0 = rodape + chapa;
  const util = { w: movel.larguraCm - 2 * chapa, h: movel.alturaCm - rodape - 2 * chapa };
  const gavetas = doTipo(movel, "GAVETA");
  const cabideiros = doTipo(movel, "CABIDEIRO");
  const prateleiras = doTipo(movel, "PRATELEIRA");
  const haOutros = cabideiros.length + prateleiras.length > 0;
  const alturaGavetas = gavetas.length === 0 ? 0 : haOutros ? Math.min(gavetas.length * GAVETA_CM, util.h * GAVETAS_MAX) : util.h;
  const alturaVao = util.h - alturaGavetas;
  const baseVao = y0 + alturaGavetas;
  const larguraCabideiros = cabideiros.length === 0 ? 0 : prateleiras.length === 0 ? util.w : util.w * CABIDEIRO_LARGURA;
  const celulas = [
    ...empilhar(cabideiros, x0, baseVao, larguraCabideiros, alturaVao),
    ...empilhar(prateleiras, x0 + larguraCabideiros, baseVao, util.w - larguraCabideiros, alturaVao),
    ...empilhar(gavetas, x0, y0, util.w, alturaGavetas),
  ];
  return { largura: movel.larguraCm, altura: movel.alturaCm, profundidade: movel.profundidadeCm, chapa, rodape, celulas };
}

/** Posição x (cm) de cada móvel quando ficam lado a lado, com um respiro entre eles. */
export function ladoALado(moveis: AcervoMovel[], respiro = 4): { movel: AcervoMovel; x: number }[] {
  let x = 0;
  return moveis.map((movel) => {
    const item = { movel, x };
    x += movel.larguraCm + respiro;
    return item;
  });
}

export const larguraTotal = (moveis: AcervoMovel[], respiro = 4): number =>
  moveis.reduce((soma, m) => soma + m.larguraCm, 0) + Math.max(0, moveis.length - 1) * respiro;

export const alturaMaxima = (moveis: AcervoMovel[]): number => moveis.reduce((maior, m) => Math.max(maior, m.alturaCm), 0);

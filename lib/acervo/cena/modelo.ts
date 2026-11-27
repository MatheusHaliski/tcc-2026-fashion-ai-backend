/**
 * ACERVO — móvel procedural: a lista de partes (caixas e cilindros, em metros) que formam o armário a partir da
 * configuração — carcaça, divisórias, prateleiras, cabideiros, gavetas, portas, puxadores e luz embutida. A cena 3D só
 * desenha o que está descrito aqui. Origem: canto inferior esquerdo da frente do móvel; x para a direita, y para cima,
 * z para a frente.
 *
 * Os modelos GLB de marcenaria ainda não existem. Cada parte tem um papel; quando houver um GLB para um papel
 * (lib/acervo/cena/assets.ts), ele entra no lugar da parte procedural sem mudar este arquivo.
 */
import { plantaDoMovel, type Celula, type Planta } from "@/lib/acervo/planta";
import type { AcervoMovel } from "@/lib/acervo/types";

export type V3 = [number, number, number];
export type PapelDaParte = "carcaca" | "fundo" | "rodape" | "divisoria" | "prateleira" | "cabideiro" | "gaveta" | "porta" | "puxador" | "luz";
export type MaterialDaParte = "corpo" | "fundo" | "frente" | "porta" | "metal" | "puxador" | "luz";

export interface ParteDoMovel {
  id: string;
  papel: PapelDaParte;
  forma: "caixa" | "cilindro";
  /** caixa: largura, altura, profundidade; cilindro: raio, comprimento (ao longo de x), raio */
  tam: V3;
  /** centro da parte */
  pos: V3;
  mat: MaterialDaParte;
  /** compartimento a que a parte pertence (gaveta e o puxador dela se movem juntos) */
  compartimentoId?: string;
}

export interface ModeloDoMovel {
  planta: Planta;
  partes: ParteDoMovel[];
  /** altura do chão até a base do móvel: o Dream Space fica suspenso */
  elevacao: number;
}

const M = 0.01;
const ELEVACAO_DREAM = 0.28;
const FOLGA = 0.004;
const FRENTE = 0.02;
const RAIO_CABIDEIRO = 0.012;

const caixa = (id: string, papel: PapelDaParte, mat: MaterialDaParte, tam: V3, pos: V3, compartimentoId?: string): ParteDoMovel =>
  ({ id, papel, forma: "caixa", tam, pos, mat, compartimentoId });

function puxador(movel: AcervoMovel, id: string, centro: V3, largura: number, compartimentoId?: string): ParteDoMovel[] {
  if (movel.puxador === "SEM_PUXADOR") return [];
  const z = centro[2] + 0.018;
  if (movel.puxador === "BOTAO") return [caixa(id, "puxador", "puxador", [0.03, 0.03, 0.03], [centro[0], centro[1], z], compartimentoId)];
  if (movel.puxador === "CAVA") return [caixa(id, "puxador", "puxador", [Math.min(0.3, largura * 0.5), 0.012, 0.008], [centro[0], centro[1], z - 0.012], compartimentoId)];
  return [caixa(id, "puxador", "puxador", [Math.min(0.42, largura * 0.45), 0.014, 0.022], [centro[0], centro[1], z], compartimentoId)];
}

function carcaca(movel: AcervoMovel, p: Planta): ParteDoMovel[] {
  const [w, h, d, t] = [p.largura * M, p.altura * M, p.profundidade * M, p.chapa * M];
  const base = p.rodape * M;
  const partes = [
    caixa("lado-esq", "carcaca", "corpo", [t, h - base, d], [t / 2, base + (h - base) / 2, -d / 2]),
    caixa("lado-dir", "carcaca", "corpo", [t, h - base, d], [w - t / 2, base + (h - base) / 2, -d / 2]),
    caixa("tampo", "carcaca", "corpo", [w - 2 * t, t, d], [w / 2, h - t / 2, -d / 2]),
    caixa("base", "carcaca", "corpo", [w - 2 * t, t, d], [w / 2, base + t / 2, -d / 2]),
    caixa("fundo", "fundo", "fundo", [w - 2 * t, h - base - 2 * t, 0.006], [w / 2, base + (h - base) / 2, -d + 0.003]),
    caixa("luz-tampo", "luz", "luz", [w - 2 * t - 0.04, 0.006, 0.02], [w / 2, h - t - 0.004, -0.06]),
  ];
  if (base > 0) partes.push(caixa("rodape", "rodape", "corpo", [w - 2 * t, base, t], [w / 2, base / 2, -0.04]));
  return partes;
}

function celula(movel: AcervoMovel, p: Planta, c: Celula): ParteDoMovel[] {
  const d = p.profundidade * M;
  const [x, y, w, h] = [c.x * M, c.y * M, c.w * M, c.h * M];
  const cx = x + w / 2;
  if (c.tipo === "GAVETA") {
    const frente: V3 = [cx, y + h / 2, -FRENTE / 2];
    return [
      caixa(`gaveta-${c.id}`, "gaveta", "frente", [w - 2 * FOLGA, h - 2 * FOLGA, FRENTE], frente, c.id),
      caixa(`caixa-${c.id}`, "gaveta", "fundo", [w - 0.03, 0.01, d - 0.06], [cx, y + 0.012, -d / 2], c.id),
      ...puxador(movel, `puxador-${c.id}`, frente, w, c.id),
    ];
  }
  const tabua = caixa(`tabua-${c.id}`, "prateleira", "corpo", [w, p.chapa * M * 0.7, d - 0.02], [cx, y, -d / 2 - 0.01], c.id);
  const partes = y > (p.rodape + p.chapa) * M + 0.001 ? [tabua] : [];
  if (c.tipo === "CABIDEIRO") {
    partes.push({ id: `cabideiro-${c.id}`, papel: "cabideiro", forma: "cilindro", tam: [RAIO_CABIDEIRO, w - 0.01, RAIO_CABIDEIRO],
      pos: [cx, y + h - 0.07, -d / 2], mat: "metal", compartimentoId: c.id });
  }
  if (movel.modo === "DREAM_SPACE") partes.push(caixa(`luz-${c.id}`, "luz", "luz", [w - 0.04, 0.005, 0.016], [cx, y + h - 0.012, -0.05], c.id));
  return partes;
}

/** Divisória vertical entre a coluna dos cabideiros e a das prateleiras, quando o móvel tem as duas. */
function divisoria(p: Planta): ParteDoMovel[] {
  const cabideiro = p.celulas.find((c) => c.tipo === "CABIDEIRO");
  const prateleiras = p.celulas.filter((c) => c.tipo === "PRATELEIRA");
  if (!cabideiro || prateleiras.length === 0) return [];
  const base = Math.min(...prateleiras.map((c) => c.y)) * M;
  const topo = Math.max(...prateleiras.map((c) => c.y + c.h)) * M;
  const x = (cabideiro.x + cabideiro.w) * M;
  const d = p.profundidade * M;
  return [caixa("divisoria", "divisoria", "corpo", [p.chapa * M * 0.7, topo - base, d - 0.02], [x, (base + topo) / 2, -d / 2 - 0.01])];
}

/** Portas na frente do vão de cima (as gavetas ficam sempre à mostra). */
function portas(movel: AcervoMovel, p: Planta): ParteDoMovel[] {
  const altas = p.celulas.filter((c) => c.tipo !== "GAVETA");
  if (movel.porta === "SEM_PORTA" || altas.length === 0) return [];
  const base = Math.min(...altas.map((c) => c.y)) * M;
  const topo = Math.max(...altas.map((c) => c.y + c.h)) * M;
  const largura = p.largura * M - 2 * FOLGA;
  const folhas = largura > 0.7 ? 2 : 1;
  const cada = largura / folhas;
  const partes: ParteDoMovel[] = [];
  for (let i = 0; i < folhas; i++) {
    const cx = FOLGA + cada * (i + 0.5);
    const z = movel.porta === "CORRER" ? 0.012 + i * 0.022 : 0.012;
    partes.push(caixa(`porta-${i}`, "porta", "porta", [cada - FOLGA, topo - base - 2 * FOLGA, 0.02], [cx, (base + topo) / 2, z]));
    const lado = folhas === 1 || i === 0 ? cx + cada / 2 - 0.06 : cx - cada / 2 + 0.06;
    partes.push(...puxador({ ...movel, puxador: movel.puxador === "BARRA" ? "BOTAO" : movel.puxador }, `puxador-porta-${i}`, [lado, (base + topo) / 2, z], 0.2));
  }
  return partes;
}

export function modeloDoMovel(movel: AcervoMovel): ModeloDoMovel {
  const planta = plantaDoMovel(movel);
  const partes = [...carcaca(movel, planta), ...planta.celulas.flatMap((c) => celula(movel, planta, c)), ...divisoria(planta), ...portas(movel, planta)];
  return { planta, partes, elevacao: movel.modo === "DREAM_SPACE" ? ELEVACAO_DREAM : 0 };
}

/** Caixa (em metros) que ocupa o vão de um compartimento: o alvo de clique e de soltar peças na cena. */
export function volumeDaCelula(p: Planta, c: Celula): { tam: V3; pos: V3 } {
  const d = p.profundidade * M;
  return { tam: [c.w * M, c.h * M, d - 0.02], pos: [(c.x + c.w / 2) * M, (c.y + c.h / 2) * M, -d / 2] };
}

/** Quanto a gaveta sai do móvel quando aberta (em metros). */
export const cursoDaGaveta = (p: Planta): number => Math.min(0.42, p.profundidade * M * 0.7);

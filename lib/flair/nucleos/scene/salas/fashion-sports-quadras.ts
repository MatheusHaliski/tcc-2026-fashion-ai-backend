/**
 * Fashion Sports: a quadra de cada modalidade (docs/flair/flair-3d/CORES_E_ACOES.md, 1.3). Todas dividem o ginásio do
 * futebol de 5 (arquibancada, banco de reservas, placar, luzes e zonas). Cada uma tem o próprio piso, as próprias
 * linhas, o equipamento que a identifica (tabela, rede, raias, pista de skate), a bola ou o objeto do esporte e o
 * número de colegas e adversários da modalidade (3 contra 3 no basquete, dupla no vôlei, um contra um no tênis).
 */
import type { NucleoPersonagem } from "@/lib/flair/nucleos/types";
import { borracha, concreto, madeira, tinta } from "@/lib/flair/nucleos/scene/materials";
import {
  bastao,
  bolaDe,
  linhaAoComprido,
  linhaAtravessada,
  linhasDaModalidade,
  pistaDeSkate,
  raias,
  redeDeJogo,
  skate,
  tabelaDeBasquete,
} from "@/lib/flair/nucleos/scene/moveis/quadras";
import { QUADRA_GOL_Z, QUADRA_MEIA_LARGURA, SALA_FASHION_SPORTS as FUTEBOL } from "@/lib/flair/nucleos/scene/salas/fashion-sports";
import type { MaterialDesc, Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** O ginásio sem o que é só do futebol: traves, linhas com o círculo central e a bola de futsal. */
const GINASIO = FUTEBOL.moveis.filter((m) => !["trave", "linhasDaQuadra", "bola"].includes(m.tipo));
const LARGURA = 2 * QUADRA_MEIA_LARGURA;
const COMPRIMENTO = 13;
/** Onde a rede atravessa a quadra: entre o time da pessoa e o adversário. */
const REDE_Z = -3.4;
const CENTRO = { pos: [0, 0, 0] as [number, number, number], zona: "avatar" as const };
const OBJETO = { pos: [0.55, 0, 0.5] as [number, number, number], zona: "avatar" as const, id: "bola" };

const colega = (x: number, z: number): NucleoPersonagem => ({ papel: "COLEGA", tipo: "manequim", pos: [x, 0, z], cor: "#1F7A76", escala: 0.9, giro: 180 });
const adversario = (x: number, z: number): NucleoPersonagem => ({ papel: "ADVERSARIO", tipo: "manequim", pos: [x, 0, z], cor: "#C6275E", escala: 0.9 });

function quadra(piso: MaterialDesc, materiais: Record<string, MaterialDesc>, moveis: Movel[], personagens: NucleoPersonagem[]): Sala {
  return { ...FUTEBOL, materiais: { ...FUTEBOL.materiais, borracha: piso, ...materiais }, moveis: [...GINASIO, ...moveis], personagens };
}

const BASQUETE = quadra(madeira("#C98E4A", "#8E5E2A", 0.3), { bola: tinta("#E0762B") }, [
  linhasDaModalidade(CENTRO, "tinta", LARGURA, COMPRIMENTO, [
    linhaAtravessada("tinta", 3.6, QUADRA_GOL_Z + 4.6),
    linhaAoComprido("tinta", 4.6, -1.8, QUADRA_GOL_Z + 2.3),
    linhaAoComprido("tinta", 4.6, 1.8, QUADRA_GOL_Z + 2.3),
  ]),
  tabelaDeBasquete({ pos: [0, 0, 0], zona: "avatar" }, "estrutura", "tinta", "assento", "rede"),
  bolaDe(OBJETO, "bola", 0.12),
], [colega(-1.6, -1.2), colega(1.6, -1.2), adversario(-1.6, -4.6), adversario(0, -5.2), adversario(1.6, -4.6)]);

const VOLEI = quadra(concreto("#E2C98F", 0.95), { bola: tinta("#F2D13A") }, [
  linhasDaModalidade(CENTRO, "tinta", LARGURA, COMPRIMENTO, [linhaAtravessada("tinta", LARGURA, REDE_Z)]),
  redeDeJogo(CENTRO, "estrutura", "rede", "tinta", LARGURA + 0.6, 2.43, 1),
  bolaDe(OBJETO, "bola", 0.105),
], [colega(1.7, -1.4), adversario(-1.5, -5), adversario(1.5, -5.4)]);

const TENIS = quadra(borracha("#2E7D5B"), { bola: tinta("#D7F03A") }, [
  linhasDaModalidade(CENTRO, "tinta", LARGURA, COMPRIMENTO, [
    linhaAoComprido("tinta", COMPRIMENTO, -3, 0),
    linhaAoComprido("tinta", COMPRIMENTO, 3, 0),
    linhaAtravessada("tinta", 6, REDE_Z + 2.2),
    linhaAtravessada("tinta", 6, REDE_Z - 2.2),
    linhaAoComprido("tinta", 4.4, 0, REDE_Z),
  ]),
  redeDeJogo(CENTRO, "estrutura", "rede", "tinta", LARGURA + 0.6, 1.07, 1.07),
  bolaDe(OBJETO, "bola", 0.045),
], [adversario(1.2, -5.6)]);

const CORRIDA = quadra(borracha("#B5452F"), {}, [
  raias(CENTRO, "tinta", "estrutura", LARGURA, COMPRIMENTO, 5),
  bastao(OBJETO, "traves"),
], [colega(0, -2.6), colega(0, -4.4), colega(0, -6.1), adversario(-3.2, -1.6), adversario(-1.6, -1.6), adversario(1.6, -1.6), adversario(3.2, -1.6)]);

const SKATE = quadra(concreto("#9A9CA2", 0.6), { shape: madeira("#2B2D42", "#1B1C2B", 0.5) }, [
  pistaDeSkate(CENTRO, "concreto", "traves"),
  skate(OBJETO, "shape", "estrutura", "tinta"),
], [adversario(-3.2, -1.6), adversario(3.4, -4.6)]);

/** Posiciona os móveis com o próprio lugar na quadra (rede no meio, tabela na linha de fundo). */
function noLugarDaQuadra(sala: Sala, tipo: string, z: number): Sala {
  return { ...sala, moveis: sala.moveis.map((m) => (m.tipo === tipo ? { ...m, partes: m.partes.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1], p.pos[2] + z] as [number, number, number] })) } : m)) };
}

export const QUADRAS: Record<string, Sala> = {
  FUTEBOL,
  BASQUETE: noLugarDaQuadra(BASQUETE, "tabelaDeBasquete", QUADRA_GOL_Z + 0.3),
  VOLEI: noLugarDaQuadra(VOLEI, "redeDeJogo", REDE_Z),
  TENIS: noLugarDaQuadra(TENIS, "redeDeJogo", REDE_Z),
  CORRIDA,
  SKATE,
};

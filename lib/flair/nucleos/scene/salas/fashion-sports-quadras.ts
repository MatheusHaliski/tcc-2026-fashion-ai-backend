/**
 * Fashion Sports: a quadra de cada modalidade (docs/flair/flair-3d/CORES_E_ACOES.md, 1.3). Todas dividem o ginásio do
 * futebol de 5 (arquibancada, banco de reservas, placar, luzes e zonas) e mudam o piso e o que fica na linha de fundo:
 * tabela no basquete, rede no vôlei e no tênis, pista na corrida e corrimão no skate.
 */
import { borracha, concreto, madeira } from "@/lib/flair/nucleos/scene/materials";
import { painelLed } from "@/lib/flair/nucleos/scene/moveis/palco";
import { parapeito, redeProtecao } from "@/lib/flair/nucleos/scene/moveis/urbano";
import { QUADRA_GOL_Z, SALA_FASHION_SPORTS as FUTEBOL } from "@/lib/flair/nucleos/scene/salas/fashion-sports";
import type { MaterialDesc, Movel, Sala } from "@/lib/flair/nucleos/scene/types";

/** O ginásio sem as traves do futebol. */
const GINASIO = FUTEBOL.moveis.filter((m) => m.tipo !== "trave");

function quadra(piso: MaterialDesc, fundo: Movel[]): Sala {
  return { ...FUTEBOL, materiais: { ...FUTEBOL.materiais, borracha: piso }, moveis: [...GINASIO, ...fundo] };
}

/** Rede atravessada na linha de fundo, na altura da modalidade. */
const redeDeJogo = (altura: number): Movel => redeProtecao({ pos: [0, 0, QUADRA_GOL_Z] }, "traves", "rede", 8, altura);

export const QUADRAS: Record<string, Sala> = {
  FUTEBOL,
  BASQUETE: quadra(madeira("#C98E4A", "#8E5E2A", 0.3), [painelLed({ pos: [0, 2.7, QUADRA_GOL_Z] }, "led", "estrutura", 1.8, 1.05, 0)]),
  VOLEI: quadra(concreto("#E2C98F", 0.95), [redeDeJogo(2.4)]),
  TENIS: quadra(borracha("#2E7D5B"), [redeDeJogo(1.07)]),
  CORRIDA: quadra(borracha("#B5452F"), [redeDeJogo(0.9)]),
  SKATE: quadra(concreto("#9A9CA2", 0.6), [parapeito({ pos: [0, 0, QUADRA_GOL_Z - 0.3] }, "concreto", "traves", 8)]),
};

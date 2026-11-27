/**
 * Batalha de Looks: o que o servidor mandou da comparação com o adversário da casa, lido dos eventos da rodada
 * (RODADA_DA_BATALHA, na batalha de 3 rodadas) ou do treino (LOOK_DO_ADVERSARIO + CONTA_DA_BATALHA). A tela não calcula
 * nada: mostra a conta de cada lado (regra, look, foco), veste o adversário com o look da casa e põe a soma no painel.
 * Puro.
 */
import type { Look3dPiece } from "@/components/three/common";
import { defaultGarmentColor } from "@/lib/catalog/default-garment";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

/** As três parcelas da nota de um lado na rodada. */
export interface ContaDaBatalha {
  regra: number;
  look: number;
  recurso: number;
}

export interface PecaDaCasa {
  subcategoria: string;
  familia: string;
  cor?: string;
}

export interface RodadaDaBatalha {
  rodada: number;
  /** o desafio da rodada (MONO_AZUL, CLIMA_FRIO...); servidor antigo não manda */
  desafio?: string;
  voce: number;
  adversario: number;
  conta?: { voce: ContaDaBatalha; adversario: ContaDaBatalha };
  /** vagas da pessoa que não contaram: a peça foi gasta como recurso na mesma rodada */
  cansadas: string[];
  familia?: string;
  look?: Record<string, PecaDaCasa>;
}

type Valor = Record<string, unknown>;

const objeto = (v: unknown): Valor | null => (v && typeof v === "object" ? (v as Valor) : null);

const SLOT: Record<string, [slot: string, category: string]> = { SUP: ["upper", "UPPER"], INF: ["lower", "LOWER"], CAL: ["shoes", "SHOES"] };

function daRodada(v: Valor): RodadaDaBatalha {
  return {
    rodada: Number(v.rodada ?? 1),
    desafio: typeof v.desafio === "string" ? v.desafio : undefined,
    voce: Number(v.voce ?? 0),
    adversario: Number(v.adversario ?? 0),
    conta: objeto(v.conta) as RodadaDaBatalha["conta"],
    cansadas: Array.isArray(v.cansadas) ? v.cansadas.map(String) : [],
    familia: typeof v.familia === "string" ? v.familia : undefined,
    look: (objeto(v.look) as RodadaDaBatalha["look"]) ?? undefined,
  };
}

/** O treino de uma rodada só: os mesmos dados, espalhados em três eventos. */
function doTreino(r: NucleoResultado): RodadaDaBatalha | null {
  const casa = objeto(r.eventos.find((e) => e.codigo === "LOOK_DO_ADVERSARIO")?.valor);
  if (!casa) return null;
  const conta = objeto(r.eventos.find((e) => e.codigo === "CONTA_DA_BATALHA")?.valor);
  const desafio = r.eventos.find((e) => e.codigo === "DESAFIO")?.valor;
  // a nota da rodada sem a execução: a do fecho (a nota final segue o desfecho e pode não ser a da rodada)
  const voce = fechoDaBatalha(r)?.rodadas ?? r.pontos;
  return daRodada({ rodada: 1, desafio, voce, adversario: casa.nota, conta, cansadas: conta?.cansadas, familia: casa.familia, look: casa.look });
}

/** O fecho da partida (rodada 8g): a soma da pessoa já com a execução do desfile final, a da casa e as duas parcelas. */
export interface FechoDaBatalha {
  voce: number;
  adversario: number;
  rodadas: number;
  execucao: number;
}

/** O fecho que o servidor mandou no resultado final (SOMA_DA_BATALHA com a execução); nulo antes do fim. */
export function fechoDaBatalha(r: NucleoResultado | null | undefined): FechoDaBatalha | null {
  const v = objeto(r?.eventos.find((e) => e.codigo === "SOMA_DA_BATALHA")?.valor);
  if (!v || v.execucao == null) return null;
  return { voce: Number(v.voce ?? 0), adversario: Number(v.adversario ?? 0), rodadas: Number(v.rodadas ?? 0), execucao: Number(v.execucao) };
}

/**
 * As rodadas já comparadas, na ordem: as do resultado (a entrega de agora, ou as três no fim) ou, na preparação da
 * rodada seguinte, a da última entrega (`anterior`).
 */
export function rodadasDaBatalha(resultado: NucleoResultado | null | undefined, anterior?: NucleoResultado | null): RodadaDaBatalha[] {
  for (const r of [resultado, anterior]) {
    if (!r) continue;
    const lista = r.eventos.filter((e) => e.codigo === "RODADA_DA_BATALHA").map((e) => objeto(e.valor)).filter((v): v is Valor => !!v).map(daRodada);
    if (lista.length) return lista;
    const treino = doTreino(r);
    if (treino) return [treino];
  }
  return [];
}

/** A soma das rodadas comparadas até agora, para o painel de LED ("160 × 135"); nula antes da primeira entrega. */
export function somaDaBatalha(rodadas: RodadaDaBatalha[]): { voce: number; adversario: number } | null {
  if (rodadas.length === 0) return null;
  return { voce: rodadas.reduce((n, r) => n + r.voce, 0), adversario: rodadas.reduce((n, r) => n + r.adversario, 0) };
}

/**
 * O look da casa da última rodada comparada como peças do corpo 3D (acessório não tem molde), na cor da etiqueta de
 * cada peça. Nulo enquanto o servidor não revelou nenhum look: o adversário fica com a roupa do papel.
 */
export function pecasDoAdversario(rodadas: RodadaDaBatalha[]): Look3dPiece[] | null {
  const look = rodadas[rodadas.length - 1]?.look;
  if (!look) return null;
  const pecas = Object.entries(look).flatMap(([vaga, p]): Look3dPiece[] => {
    const molde = SLOT[vaga];
    if (!molde || !p?.subcategoria) return [];
    return [{ id: `casa-${vaga}-${p.subcategoria}`, name: `casa-${vaga}`, slot: molde[0], category: molde[1], subcategory: p.subcategoria, colorHex: defaultGarmentColor(null, p.cor ?? null), imageUrl: null }];
  });
  return pecas.length ? pecas : null;
}

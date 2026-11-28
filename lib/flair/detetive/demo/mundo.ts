/**
 * A sala da demonstração: o salão da gala na frente e, atrás de uma parede com porta trancada, o arquivo. Paredes e
 * móveis são caixas no chão (colisão e linha de visão); a porta é uma caixa a mais enquanto está fechada. A chave está
 * na gaveta da cômoda; o armário do arquivo tem munição; no chão há kits de costura (vida) e carretéis (alfinetes); o
 * dossiê da coleção Maré fecha a demonstração. Puro.
 */
import type { Caixa, EstadoDaDemo, Interativo, Ponto, Vigia } from "@/lib/flair/detetive/demo/tipos";

/** O chão andável inteiro: x de -6 a 6, z de -7 (fundo do arquivo) a 5 (frente do salão). */
export const LIMITES: Caixa = { x0: -6, x1: 6, z0: -7, z1: 5 };
/** A parede entre o salão e o arquivo e a porta no meio dela. */
export const PAREDE_Z = -2.5;
export const PORTA: Caixa = { x0: -0.9, x1: 0.9, z0: -2.65, z1: -2.35 };

/** Paredes internas e móveis (com nome, para a cena desenhar cada um). */
export const MOVEIS: { id: string; tipo: "PAREDE" | "MESA" | "ARARA" | "COMODA" | "ARMARIO" | "ESTANTE" | "COLUNA"; caixa: Caixa }[] = [
  { id: "parede-esq", tipo: "PAREDE", caixa: { x0: -6, x1: -0.9, z0: -2.65, z1: -2.35 } },
  { id: "parede-dir", tipo: "PAREDE", caixa: { x0: 0.9, x1: 6, z0: -2.65, z1: -2.35 } },
  { id: "mesa", tipo: "MESA", caixa: { x0: -1.4, x1: 1.4, z0: 0.6, z1: 1.5 } },
  { id: "arara", tipo: "ARARA", caixa: { x0: -5.2, x1: -3.4, z0: -1.1, z1: -0.6 } },
  { id: "comoda", tipo: "COMODA", caixa: { x0: 3.6, x1: 5.6, z0: -2.35, z1: -1.75 } },
  { id: "coluna", tipo: "COLUNA", caixa: { x0: 2.6, x1: 3.2, z0: 2.4, z1: 3 } },
  { id: "armario", tipo: "ARMARIO", caixa: { x0: -5.7, x1: -4.3, z0: -7, z1: -6.4 } },
  { id: "estante", tipo: "ESTANTE", caixa: { x0: 1.8, x1: 4.2, z0: -7, z1: -6.5 } },
];

/** Onde se fica para usar cada coisa (o ponto de interação, na frente dela). */
export const LUGAR: Record<string, Ponto> = {
  PORTA: { x: 0, z: -1.9 },
  GAVETA: { x: 4.6, z: -1.25 },
  ARMARIO: { x: -5, z: -5.8 },
  "KIT-1": { x: -4.3, z: 3.4 },
  "KIT-2": { x: 4.6, z: -4.6 },
  "CARRETEL-1": { x: 4.6, z: 3.8 },
  "CARRETEL-2": { x: -3, z: -4.4 },
  DOSSIE: { x: 3, z: -5.9 },
};

/** A que distância (m) do lugar a pessoa pode interagir. */
export const RAIO_DE_USO = 1.15;

/** Vida, velocidade e números do jogo. */
export const VIDA_MAXIMA = 100;
export const VIDA_DO_VIGIA = 100;
export const ANDAR = 2.4;
export const CORRER = 4.4;
export const RAIO_DO_CORPO = 0.3;

function interativosIniciais(): Interativo[] {
  return [
    { id: "PORTA", tipo: "PORTA", aberta: false },
    { id: "GAVETA", tipo: "GAVETA", aberta: false },
    { id: "ARMARIO", tipo: "ARMARIO", aberta: false },
    { id: "KIT-1", tipo: "ITEM", item: "KIT", coletado: false },
    { id: "KIT-2", tipo: "ITEM", item: "KIT", coletado: false },
    { id: "CARRETEL-1", tipo: "ITEM", item: "CARRETEL", coletado: false },
    { id: "CARRETEL-2", tipo: "ITEM", item: "CARRETEL", coletado: false },
    { id: "DOSSIE", tipo: "ITEM", item: "DOSSIE", coletado: false },
  ];
}

const vigia = (id: string, rota: Ponto[]): Vigia => ({
  id, x: rota[0].x, z: rota[0].z, giro: 0, vida: 100, modo: "PATRULHA", noModo: 0, rota, alvoDaRota: 1, visto: null, recarga: 0, golpeou: false, sumiu: false,
});

export function estadoInicial(): EstadoDaDemo {
  return {
    t: 0,
    jogador: {
      x: 0, z: 4.3, giro: Math.PI, vida: VIDA_MAXIMA, arma: "PISTOLA", municao: { pente: 12, reserva: 12, laque: 3, kits: 1 }, chave: false,
      recarga: 0, recarregando: 0, gesto: null, folga: 0, andando: false, correndo: false,
    },
    vigias: [
      vigia("V1", [{ x: -4.6, z: 2.4 }, { x: -4.6, z: 0.1 }]),
      vigia("V2", [{ x: 4.8, z: -0.8 }, { x: 4.8, z: 1.8 }, { x: 1.9, z: -0.8 }]),
      vigia("V3", [{ x: -3.2, z: -4.2 }, { x: 3.4, z: -4 }]),
    ],
    interativos: interativosIniciais(),
    projeteis: [],
    efeitos: [],
    proximoId: 1,
    fim: null,
  };
}

/** As caixas que barram o corpo e a visão agora (a porta conta enquanto está fechada). */
export function caixasDe(e: EstadoDaDemo): Caixa[] {
  const porta = e.interativos.find((i) => i.id === "PORTA");
  const fechada = !porta || (porta.tipo === "PORTA" && !porta.aberta);
  return fechada ? [...MOVEIS.map((m) => m.caixa), PORTA] : MOVEIS.map((m) => m.caixa);
}

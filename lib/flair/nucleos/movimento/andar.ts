/**
 * Andar livre pela sala (etapa 15 do plano): o analógico esquerdo ou WASD levam a personagem pelo lugar dela — a
 * passarela, o palco, o tablado ou o piso da loja —, sem atravessar os móveis nem sair da sala. A velocidade vem da
 * agilidade do look (regra peça-recurso): tênis corre, salto anda devagar. Puro.
 */
import type { Vetor } from "@/lib/flair/entrada/acoes";
import type { Caixa } from "@/lib/flair/nucleos/camera/rigs";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

export interface Posicao {
  x: number;
  z: number;
  /** graus, 0 = de frente para a câmera (+z) */
  giro: number;
}

export interface Area {
  x: [number, number];
  z: [number, number];
  /** os móveis que barram o caminho (já com a folga do corpo) */
  caixas: Caixa[];
}

/** Metade da largura do corpo: a personagem não encosta o centro na parede. */
export const RAIO_DO_CORPO = 0.28;
const MIN_VEL = 1.2;
const MAX_VEL = 3.2;

/** Metros por segundo pela agilidade do look (0 a 100; 50 = neutro dá 2,2 m/s). */
export function velocidadeDaAgilidade(agilidade = 50): number {
  const a = Math.max(0, Math.min(100, agilidade));
  return MIN_VEL + ((MAX_VEL - MIN_VEL) * a) / 100;
}

/**
 * Onde dá para andar: no palco, na passarela e no tablado, só em cima deles (a zona do avatar); no piso, a sala inteira
 * menos uma folga das paredes. Os móveis no chão, da altura do joelho para cima, barram; o que pende do teto, não.
 */
export function areaDeAndar(sala: Sala, caixas: Caixa[]): Area {
  const z = sala.zonas.avatar;
  // passarela, tablado, qualquer marca em cima de um palco ou o círculo da luta: só dentro dele
  const elevado = z.marca === "passarela" || z.marca === "tablado" || z.altura > 0.1 || !!z.cercada;
  const meia = sala.dim.largura / 2 - 0.4;
  const pe = z.altura;
  const barra = caixas.filter((c) => c.y[0] < pe + 1.6 && c.y[1] > pe + 0.35);
  if (elevado) return { x: z.x, z: z.z, caixas: barra };
  return { x: [-meia, meia], z: [-sala.dim.fundo + 0.4, Math.min(sala.dim.frente - 0.4, 3)], caixas: barra };
}

const dentro = (v: number, [a, b]: [number, number]) => v >= a && v <= b;

function livre(x: number, z: number, area: Area): boolean {
  if (!dentro(x, area.x) || !dentro(z, area.z)) return false;
  return !area.caixas.some((c) => x > c.x[0] - RAIO_DO_CORPO && x < c.x[1] + RAIO_DO_CORPO && z > c.z[0] - RAIO_DO_CORPO && z < c.z[1] + RAIO_DO_CORPO);
}

/**
 * Um passo: `mover.y` positivo vai para o fundo da sala (longe da câmera), `mover.x` para a direita. Bate e escorrega:
 * se o passo inteiro bate, tenta só no eixo x e só no z. A personagem vira para onde anda.
 */
export function passo(atual: Posicao, mover: Vetor, dt: number, velocidade: number, area: Area): Posicao {
  const n = Math.hypot(mover.x, mover.y);
  if (n < 1e-3 || dt <= 0) return atual;
  const d = Math.min(dt, 0.1) * velocidade;
  const dx = mover.x * d;
  const dz = -mover.y * d;
  const giro = (Math.atan2(dx, dz) * 180) / Math.PI;
  if (livre(atual.x + dx, atual.z + dz, area)) return { x: atual.x + dx, z: atual.z + dz, giro };
  if (livre(atual.x + dx, atual.z, area)) return { x: atual.x + dx, z: atual.z, giro };
  if (livre(atual.x, atual.z + dz, area)) return { x: atual.x, z: atual.z + dz, giro };
  return { ...atual, giro };
}

/** Velocidade da volta à marca quando o andar livre acaba (o lance da luta começa, o desfile encerra), em m/s. */
export const VOLTA_A_MARCA = 3;

/** Um passo de volta à marca (0, 0): a personagem caminha de volta em vez de sumir e reaparecer. */
export function voltarAMarca(atual: Posicao, dt: number): Posicao {
  const dist = Math.hypot(atual.x, atual.z);
  const d = Math.min(dt, 0.1) * VOLTA_A_MARCA;
  if (dist <= d || dist < 1e-3) return { x: 0, z: 0, giro: 0 };
  const giro = (Math.atan2(-atual.x, -atual.z) * 180) / Math.PI;
  return { x: atual.x - (atual.x / dist) * d, z: atual.z - (atual.z / dist) * d, giro };
}

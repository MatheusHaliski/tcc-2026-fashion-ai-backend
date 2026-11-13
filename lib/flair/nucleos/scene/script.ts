/**
 * Roteiro: monta uma sequência passo a passo, sem contas de tempo espalhadas. `depois` põe o passo e avança o
 * relógio até ele acabar; `junto` põe o passo no mesmo instante, sem avançar (quem reage enquanto o avatar age).
 */
import { duracaoDoPasso, type Passo, type Sequencia } from "@/lib/flair/nucleos/scene/director";

export const AVATAR = "avatar";
export const fig = (papel: string, indice: number | "*" = "*") => `fig:${papel}:${indice}`;
export const movelId = (id: string) => `movel:${id}`;
export const luzId = (id: string) => `luz:${id}`;

type Extra = Omit<Passo, "ator" | "clip" | "inicio">;

export class Roteiro {
  private passos: Passo[] = [];
  private t = 0;

  constructor(private readonly id: string) {}

  junto(ator: string, clip: string, extra: Extra = {}, atraso = 0): this {
    this.passos.push({ ator, clip, inicio: this.t + atraso, ...extra });
    return this;
  }

  depois(ator: string, clip: string, extra: Extra = {}): this {
    const passo: Passo = { ator, clip, inicio: this.t, ...extra };
    this.passos.push(passo);
    this.t += duracaoDoPasso(passo);
    return this;
  }

  espera(segundos: number): this {
    this.t += segundos;
    return this;
  }

  /** Instante atual do roteiro (fim do último `depois`). */
  agora(): number {
    return this.t;
  }

  fim(): Sequencia {
    return { id: this.id, passos: this.passos };
  }
}

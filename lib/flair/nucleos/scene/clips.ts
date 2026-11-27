/**
 * Animações procedurais (seção 2): cada clipe é uma tabela de quadros-chave por alvo (osso do avatar, raiz, braço de
 * figurante, móvel, luz) e canal. Todo clipe dura até 4 segundos e volta à pose parada: as trilhas começam e acabam
 * em zero. Com "reduzir movimento", a amostra é a pose do auge, sem transição.
 *
 * Canais: rx, ry, rz = rotação em graus nos eixos do avatar (x = esquerda dele, y = para cima, z = frente);
 * px, py, pz = deslocamento em metros; v = valor livre de 0 a 1 (luz que acende, material que brilha).
 */
export type Canal = "rx" | "ry" | "rz" | "px" | "py" | "pz" | "v";

export interface Trilha {
  alvo: string;
  canal: Canal;
  /** [tempo em segundos, valor] em ordem de tempo */
  chaves: [number, number][];
}

export interface Clip {
  id: string;
  duracao: number;
  /** instante da pose principal (a que fica com "reduzir movimento") */
  auge: number;
  trilhas: Trilha[];
  /** passo de caminhada ou corrida: pode repetir em sequência */
  ciclo: boolean;
}

/** Valores somados à pose parada, por "alvo.canal". */
export type Amostra = Record<string, number>;

export const tr = (alvo: string, canal: Canal, chaves: [number, number][]): Trilha => ({ alvo, canal, chaves });

/** Entra na pose, segura e volta. */
export function segura(alvo: string, canal: Canal, valor: number, duracao: number, entra = 0.4, sai = 0.4): Trilha {
  return tr(alvo, canal, [
    [0, 0],
    [entra, valor],
    [duracao - sai, valor],
    [duracao, 0],
  ]);
}

/** Vai e volta `ciclos` vezes entre +amplitude e −amplitude, de `de` até `ate`. */
export function onda(alvo: string, canal: Canal, amplitude: number, duracao: number, ciclos: number, de = 0, ate = duracao): Trilha {
  const chaves: [number, number][] = de > 0 ? [[0, 0]] : [];
  const quartos = 4 * ciclos;
  for (let i = 0; i <= quartos; i++) {
    const valor = [0, amplitude, 0, -amplitude][i % 4];
    chaves.push([de + ((ate - de) * i) / quartos, valor]);
  }
  if (ate < duracao) chaves.push([duracao, 0]);
  return tr(alvo, canal, chaves);
}

export function clip(id: string, duracao: number, auge: number, trilhas: Trilha[], ciclo = false): Clip {
  return { id, duracao, auge, trilhas, ciclo };
}

const suave = (k: number) => k * k * (3 - 2 * k);

/** Valor da trilha no instante t (interpolação suave entre as chaves). */
export function valorDaTrilha(t: Trilha, tempo: number): number {
  const c = t.chaves;
  if (c.length === 0) return 0;
  if (tempo <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (tempo <= c[i][0]) {
      const [t0, v0] = c[i - 1];
      const [t1, v1] = c[i];
      const k = t1 > t0 ? (tempo - t0) / (t1 - t0) : 1;
      return v0 + (v1 - v0) * suave(k);
    }
  }
  return c[c.length - 1][1];
}

/**
 * Amostra do clipe no instante t. Fora do clipe (antes de 0 ou depois da duração) não soma nada. Com `reduzido`, a
 * pose é a do auge durante todo o clipe: troca de pose sem transição.
 */
export function amostrar(c: Clip, t: number, reduzido = false): Amostra {
  const fora = t < 0 || t > c.duracao;
  if (fora) return {};
  const tempo = reduzido ? c.auge : t;
  const out: Amostra = {};
  for (const trilha of c.trilhas) {
    const chave = `${trilha.alvo}.${trilha.canal}`;
    out[chave] = (out[chave] ?? 0) + valorDaTrilha(trilha, tempo);
  }
  return out;
}

/** O clipe volta à pose parada? (toda trilha começa e acaba em zero; um giro completo conta como zero) */
export function voltaAoParado(c: Clip): boolean {
  return c.trilhas.every((t) => {
    const primeiro = t.chaves[0];
    const ultimo = t.chaves[t.chaves.length - 1];
    const fim = t.canal === "ry" ? ultimo[1] % 360 : ultimo[1];
    return primeiro[1] === 0 && fim === 0 && ultimo[0] <= c.duracao;
  });
}

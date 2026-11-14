/**
 * Diretor de cena: toca sequências (listas de passos com um clipe, um ator e um início) e responde, a cada quadro,
 * a amostra somada de cada ator e onde ele está. Puro: o tempo vem de quem chama. Com "reduzir movimento", a
 * sequência vira um quadro parado — os atores já no lugar final, na pose do último clipe, sem transição.
 */
import { amostrar, valorDaTrilha, type Amostra } from "@/lib/flair/nucleos/scene/clips";
import { clipDe } from "@/lib/flair/nucleos/scene/clips/index";

export interface Lugar {
  x: number;
  z: number;
  /** rotação em y, em graus */
  giro: number;
}

export interface Passo {
  /** "avatar", "fig:<PAPEL>:<índice ou *>", "movel:<id>" ou "luz:<id>" */
  ator: string;
  clip: string;
  inicio: number;
  /** repetições do clipe (passos de caminhada) */
  repete?: number;
  /** leva o ator até este lugar durante o passo (e ele fica lá) */
  mover?: Partial<Lugar>;
  /** de onde o ator parte neste passo, quando não é de onde ele está (a entrada em cena) */
  de?: Partial<Lugar>;
  /** segura o auge do clipe depois que ele acaba (porta aberta, luz acesa) */
  mantem?: boolean;
}

export interface Sequencia {
  id: string;
  passos: Passo[];
}

export const duracaoDoPasso = (p: Passo): number => clipDe(p.clip).duracao * (p.repete ?? 1);

export function duracaoDaSequencia(s: Sequencia): number {
  return s.passos.reduce((fim, p) => Math.max(fim, p.inicio + duracaoDoPasso(p)), 0);
}

/** O passo vale para o ator? ("fig:PLATEIA:*" vale para toda a plateia) */
export function passoDoAtor(p: Passo, ator: string): boolean {
  if (p.ator === ator) return true;
  return p.ator.endsWith(":*") && ator.startsWith(p.ator.slice(0, -1));
}

/** Quadro parado de uma sequência: só o último clipe de pose de cada ator, já no início. */
export function quadroParado(s: Sequencia): Sequencia {
  const ultimo = new Map<string, Passo>();
  for (const p of [...s.passos].sort((a, b) => a.inicio - b.inicio)) {
    if (!clipDe(p.clip).ciclo) ultimo.set(p.ator, { ator: p.ator, clip: p.clip, inicio: 0, mantem: p.mantem });
  }
  return { id: s.id, passos: [...ultimo.values()] };
}

interface Tocando {
  seq: Sequencia;
  inicio: number;
  reduzido: boolean;
}

const somar = (a: Amostra, b: Amostra) => {
  for (const k of Object.keys(b)) a[k] = (a[k] ?? 0) + b[k];
};

const suave = (k: number) => k * k * (3 - 2 * k);

export class Diretor {
  private fila: Tocando[] = [];
  /** onde cada ator ficou depois das sequências que acabaram (só o que mudou) */
  private lugares = new Map<string, Partial<Lugar>>();

  /** Toca a sequência a partir de `agora`; com `reduzido`, vai direto ao quadro parado. */
  tocar(seq: Sequencia, agora: number, reduzido = false): void {
    this.assentar(agora);
    if (reduzido) {
      this.guardarLugares(seq);
      this.fila.push({ seq: quadroParado(seq), inicio: agora, reduzido: true });
      return;
    }
    this.fila.push({ seq, inicio: agora, reduzido: false });
  }

  /** Esquece tudo: atores de volta ao lugar de origem, na pose parada. */
  limpar(): void {
    this.fila = [];
    this.lugares.clear();
  }

  /** Há sequência tocando? (passos mantidos depois do fim não contam) */
  ativo(agora: number): boolean {
    return this.fila.some((t) => agora < t.inicio + duracaoDaSequencia(t.seq));
  }

  /** Amostra somada do ator neste instante. */
  amostra(ator: string, agora: number): Amostra {
    const out: Amostra = {};
    for (const t of this.fila) {
      for (const p of t.seq.passos) {
        if (!passoDoAtor(p, ator)) continue;
        const c = clipDe(p.clip);
        const local = agora - t.inicio - p.inicio;
        const total = duracaoDoPasso(p);
        if (local < 0) continue;
        if (local > total) {
          if (p.mantem) for (const trilha of c.trilhas) somar(out, { [`${trilha.alvo}.${trilha.canal}`]: valorDaTrilha(trilha, c.auge) });
          continue;
        }
        const noClipe = c.ciclo ? local % c.duracao : local;
        somar(out, amostrar(c, p.mantem && noClipe > c.auge ? c.auge : noClipe, t.reduzido));
      }
    }
    return out;
  }

  /** Onde o ator está agora, partindo de `origem` (o lugar dele na sala). */
  lugar(ator: string, agora: number, origem: Lugar): Lugar {
    let atual: Lugar = { ...origem, ...this.lugares.get(ator) };
    for (const t of this.fila) {
      const passos = t.seq.passos.filter((p) => p.mover && passoDoAtor(p, ator)).sort((a, b) => a.inicio - b.inicio);
      for (const p of passos) {
        const local = agora - t.inicio - p.inicio;
        if (local <= 0) continue;
        if (p.de) atual = { ...atual, ...p.de };
        const alvo: Lugar = { ...atual, ...p.mover };
        const k = Math.min(1, local / duracaoDoPasso(p));
        const kGiro = suave(k);
        atual = { x: atual.x + (alvo.x - atual.x) * k, z: atual.z + (alvo.z - atual.z) * k, giro: atual.giro + (alvo.giro - atual.giro) * kGiro };
      }
    }
    return atual;
  }

  /** Guarda o lugar final de cada ator que a sequência move. */
  private guardarLugares(seq: Sequencia): void {
    for (const p of [...seq.passos].sort((x, y) => x.inicio - y.inicio)) {
      if (p.mover) this.lugares.set(p.ator, { ...this.lugares.get(p.ator), ...p.mover });
    }
  }

  /** Sequências que acabaram deixam os atores onde chegaram; as que só têm passos mantidos continuam valendo. */
  private assentar(agora: number): void {
    const restam: Tocando[] = [];
    for (const t of this.fila) {
      const acabou = agora >= t.inicio + duracaoDaSequencia(t.seq);
      if (!acabou) {
        restam.push(t);
        continue;
      }
      if (!t.reduzido) this.guardarLugares(t.seq);
      const mantidos = t.seq.passos.filter((p) => p.mantem);
      if (mantidos.length > 0) restam.push({ ...t, seq: { id: t.seq.id, passos: mantidos } });
    }
    this.fila = restam;
  }
}

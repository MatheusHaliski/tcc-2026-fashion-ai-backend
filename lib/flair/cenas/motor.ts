/**
 * Motor das cenas, puro: dado o instante t (s), diz onde está cada viajante (posição no trilho, giro, nível e
 * opacidade), cada pulso de luz e cada elemento que gira. Nada aqui desenha; quem desenha é pintura.ts.
 */
import { amostrar, cruzamentos, direcaoEm, pontoEm, type Amostra } from "@/lib/flair/cenas/caminho";
import type { Cena, Trilho, Viajante } from "@/lib/flair/cenas/tipos";

export interface CenaPronta {
  cena: Cena;
  amostras: Map<string, Amostra>;
  trilhos: Map<string, Trilho>;
  /** quantos níveis de profundidade a cena usa (pontes contam) */
  niveis: number;
}

/** Fração (0 a 1) da ponta de um trilho aberto em que o viajante surge ou some. */
export const FADE = 0.05;

const frac = (v: number) => v - Math.floor(v);

/** Nível do trilho na fração u: o dele, mais um nos trechos de ponte. */
export function nivelEm(trilho: Trilho, u: number): number {
  const base = trilho.z ?? 0;
  return trilho.pontes?.some(([de, ate]) => u >= de && u <= ate) ? base + 1 : base;
}

/** Pontes do trilho: as declaradas mais uma em cada cruzamento com os trilhos de `sobre`, juntando as que se tocam. */
function pontesDe(t: Trilho, amostras: Map<string, Amostra>): [number, number][] {
  const a = amostras.get(t.id);
  if (!a || !t.sobre?.length) return t.pontes ?? [];
  const meia = ((t.tubo?.largura ?? 4) * 1.25) / a.total;
  const cruza = t.sobre.flatMap((id) => {
    const b = amostras.get(id);
    return b ? cruzamentos(a, b) : [];
  });
  const todas = [...(t.pontes ?? []), ...cruza.map((u): [number, number] => [Math.max(0, u - meia), Math.min(1, u + meia)])];
  todas.sort((x, y) => x[0] - y[0]);
  const sai: [number, number][] = [];
  for (const ponte of todas) {
    const ultima = sai[sai.length - 1];
    if (ultima && ponte[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], ponte[1]);
    else sai.push([ponte[0], ponte[1]]);
  }
  return sai;
}

export function preparar(cena: Cena): CenaPronta {
  const amostras = new Map(cena.trilhos.map((t) => [t.id, amostrar(t.d)]));
  const prontos = cena.trilhos.map((t) => ({ ...t, pontes: pontesDe(t, amostras) }));
  const trilhos = new Map(prontos.map((t) => [t.id, t]));
  cena = { ...cena, trilhos: prontos };
  const topo = cena.trilhos.reduce((m, t) => Math.max(m, (t.z ?? 0) + (t.pontes?.length ? 1 : 0)), 0);
  const topoGiros = (cena.giros ?? []).reduce((m, g) => Math.max(m, g.z ?? 0), 0);
  return { cena, amostras, trilhos, niveis: Math.max(topo, topoGiros) + 1 };
}

/** Opacidade na fração u: inteira no meio; em trilho aberto, sobe do zero numa ponta e volta a zero na outra. */
export function alfaEm(a: Amostra, u: number): number {
  if (a.fechado) return 1;
  const borda = Math.min(u, 1 - u) / FADE;
  const k = Math.min(1, Math.max(0, borda));
  return k * k * (3 - 2 * k);
}

/** Todos os viajantes no instante t, na ordem dos grupos. */
export function viajantesEm(p: CenaPronta, t: number): Viajante[] {
  const sai: Viajante[] = [];
  for (const g of p.cena.elenco) {
    const a = p.amostras.get(g.trilho);
    const trilho = p.trilhos.get(g.trilho);
    if (!a || !trilho) continue;
    const sentido = g.sentido ?? 1;
    for (let i = 0; i < g.n; i++) {
      const u = frac(sentido * (t / g.periodo) + (g.fase ?? 0) + i / g.n);
      const ponto = pontoEm(a, u);
      const direcao = direcaoEm(a, u) + (sentido < 0 ? Math.PI : 0);
      const orienta = g.orienta ?? "reto";
      let giro = 0;
      let espelho = false;
      if (orienta === "tangente") giro = direcao + Math.PI / 2;
      else if (orienta === "rola") giro = (sentido * u * a.total) / g.escala;
      else if (orienta === "reto") giro = (((g.balanco ?? 0) * Math.PI) / 180) * Math.sin(2 * Math.PI * (t / 1.9 + i * 0.37));
      else {
        espelho = Math.cos(direcao) < 0;
        giro = espelho ? direcao - Math.PI : direcao;
      }
      const desvio = (g.pendura ?? 0) * g.escala;
      sai.push({
        x: ponto.x,
        y: ponto.y + desvio,
        desvio,
        giro,
        espelho,
        forma: g.formas[i % g.formas.length],
        cor: g.cores[i % g.cores.length],
        escala: g.escala,
        z: nivelEm(trilho, u),
        alfa: alfaEm(a, u),
        trilho: g.trilho,
        u,
      });
    }
  }
  return sai;
}

export interface PulsoEm {
  trilho: string;
  de: number;
  ate: number;
  cor: string;
  z: number;
}

/** Pulsos de luz no instante t: trechos curtos [de, até] de cada trilho (um pulso que cruza a emenda vira dois). */
export function pulsosEm(p: CenaPronta, t: number): PulsoEm[] {
  const sai: PulsoEm[] = [];
  for (const trilho of p.cena.trilhos) {
    const pulso = trilho.pulsos;
    const a = p.amostras.get(trilho.id);
    if (!pulso || !a || a.total <= 0) continue;
    const tamanho = Math.min(0.5, pulso.comprimento / a.total);
    for (let i = 0; i < pulso.n; i++) {
      const cabeca = frac((pulso.sentido ?? 1) * (t / pulso.periodo) + (pulso.fase ?? 0) + i / pulso.n);
      const de = cabeca - tamanho;
      const z = nivelEm(trilho, cabeca);
      if (de >= 0) sai.push({ trilho: trilho.id, de, ate: cabeca, cor: pulso.cor, z });
      else {
        if (a.fechado) sai.push({ trilho: trilho.id, de: de + 1, ate: 1, cor: pulso.cor, z });
        sai.push({ trilho: trilho.id, de: 0, ate: cabeca, cor: pulso.cor, z });
      }
    }
  }
  return sai;
}

/** Ângulo (radianos) de cada elemento que gira no lugar, no instante t. */
export function girosEm(p: CenaPronta, t: number): number[] {
  return (p.cena.giros ?? []).map((g) => (g.sentido ?? 1) * 2 * Math.PI * frac(t / g.periodo));
}

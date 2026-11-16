/**
 * Mundos exploráveis (docs/flair/flair-3d/MUNDOS.md): um lugar é um grafo de pontos por onde o avatar anda (como as
 * salas do Fashion Detective), em camadas de altura ligadas por escadas, com marcos que se veem de longe, uma luz ou cor
 * que guia, caminhos que fecham em laço e recompensas fora do caminho principal. Este arquivo tem o modelo e a
 * conferência dos princípios de desenho de nível; os mundos estão em mundos.ts. Puro.
 */
export interface PontoDoMundo {
  id: string;
  x: number;
  z: number;
  /** camada de altura (0 = rua; 1 = mirante, mezanino, passarela alta) */
  camada: number;
  /** o que há no ponto: um marco, a recompensa, o objetivo da etapa, a escada entre camadas */
  tipo?: "marco" | "recompensa" | "objetivo" | "escada";
  /** a cor da luz que guia até o próximo trecho do caminho principal */
  guia?: string;
}

export interface Mundo {
  id: string;
  pontos: PontoDoMundo[];
  /** ligações de mão dupla entre pontos */
  ligacoes: [string, string][];
  /** o caminho principal, do começo ao objetivo final */
  principal: string[];
}

export const vizinhosNoMundo = (m: Mundo, id: string): string[] =>
  m.ligacoes.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));

/**
 * Há um laço? (algum ponto alcança a si mesmo sem voltar pela ligação de onde veio). Num grafo conexo, ter tantas
 * ligações quanto pontos basta: uma árvore tem exatamente pontos − 1.
 */
export function temLaco(m: Mundo): boolean {
  return m.ligacoes.length >= m.pontos.length;
}

/** Quantos passos do ponto ao caminho principal (0 = está nele). */
export function distanciaDoPrincipal(m: Mundo, id: string): number {
  const fila: [string, number][] = [[id, 0]];
  const visto = new Set([id]);
  while (fila.length) {
    const [p, d] = fila.shift()!;
    if (m.principal.includes(p)) return d;
    for (const v of vizinhosNoMundo(m, p)) {
      if (!visto.has(v)) {
        visto.add(v);
        fila.push([v, d + 1]);
      }
    }
  }
  return Infinity;
}

/** Os problemas de desenho do mundo (vazio = ele segue os princípios de MUNDOS.md). */
export function conferirMundo(m: Mundo): string[] {
  const erros: string[] = [];
  const ids = new Set(m.pontos.map((p) => p.id));
  for (const [a, b] of m.ligacoes) if (!ids.has(a) || !ids.has(b)) erros.push(`ligação solta ${a}-${b}`);
  for (let i = 1; i < m.principal.length; i++) {
    if (!vizinhosNoMundo(m, m.principal[i - 1]).includes(m.principal[i])) erros.push(`caminho principal quebrado em ${m.principal[i]}`);
  }
  if (!temLaco(m)) erros.push("sem laço: todo caminho é ida e volta");
  const recompensas = m.pontos.filter((p) => p.tipo === "recompensa");
  if (recompensas.length === 0) erros.push("sem recompensa fora do caminho");
  for (const r of recompensas) if (distanciaDoPrincipal(m, r.id) < 1) erros.push(`recompensa no caminho principal: ${r.id}`);
  if (!m.pontos.some((p) => p.tipo === "marco")) erros.push("sem marco");
  const camadas = new Set(m.pontos.map((p) => p.camada));
  if (camadas.size < 2) erros.push("uma camada só");
  for (const [a, b] of m.ligacoes) {
    const pa = m.pontos.find((p) => p.id === a);
    const pb = m.pontos.find((p) => p.id === b);
    if (pa && pb && pa.camada !== pb.camada && pa.tipo !== "escada" && pb.tipo !== "escada") erros.push(`camadas sem escada: ${a}-${b}`);
  }
  for (const id of m.principal.slice(0, -1)) {
    const p = m.pontos.find((x) => x.id === id);
    if (p && !p.guia) erros.push(`sem luz guia: ${id}`);
  }
  return erros;
}

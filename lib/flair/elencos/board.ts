/**
 * Tabuleiro e quebra-cabeça do elenco, puros: posição de cada vaga no desenho, link de cada linha, estado de cada peça
 * do quebra-cabeça e a navegação entre vagas pelo controle.
 */
import type { ElencoConferencia, ElencoLink, ElencoLinha, ElencoVaga, LinkNivel } from "@/lib/flair/elencos/types";

export const COLUNAS = 5;

/** Centro da vaga em % do tabuleiro (colunas 0–4; fileiras 0..max). */
export function posicaoDaVaga(v: ElencoVaga, fileiras: number): { x: number; y: number } {
  return { x: ((v.coluna + 0.5) / COLUNAS) * 100, y: ((v.linha + 0.5) / Math.max(1, fileiras)) * 100 };
}

export function fileirasDe(vagas: ElencoVaga[]): number {
  return vagas.reduce((m, v) => Math.max(m, v.linha + 1), 1);
}

const NIVEIS: Record<string, LinkNivel> = { RED: "RED", VERMELHO: "RED", ORANGE: "ORANGE", LARANJA: "ORANGE", GREEN: "GREEN", VERDE: "GREEN" };

export function nivelDe(nivel: string | null | undefined): LinkNivel | null {
  return nivel ? NIVEIS[nivel.toUpperCase()] ?? null : null;
}

export function linkDaLinha(linha: ElencoLinha, conf: ElencoConferencia | null): ElencoLink | null {
  return conf?.links.find((l) => (l.a === linha.a && l.b === linha.b) || (l.a === linha.b && l.b === linha.a)) ?? null;
}

export type PecaEstado = "verde" | "laranja" | "vermelha" | "coberta";

/** Peça i = linha i: verde em cor, laranja em traço, vermelha escura; sem link (vaga vazia) fica coberta. */
export function estadoDasPecas(linhas: ElencoLinha[], cartas: Record<string, string>, conf: ElencoConferencia | null): PecaEstado[] {
  return linhas.map((linha) => {
    if (!cartas[linha.a] || !cartas[linha.b]) return "coberta";
    const nivel = nivelDe(linkDaLinha(linha, conf)?.nivel);
    if (nivel === "GREEN") return "verde";
    if (nivel === "ORANGE") return "laranja";
    if (nivel === "RED") return "vermelha";
    return "coberta";
  });
}

/** Grade do quebra-cabeça para n peças: colunas ≈ √(n·1,6) (imagem 16:10), fileiras para caber todas. */
export function gradeDoQuebraCabeca(n: number): { colunas: number; fileiras: number } {
  const colunas = Math.max(1, Math.round(Math.sqrt(n * 1.6)));
  return { colunas, fileiras: Math.max(1, Math.ceil(n / colunas)) };
}

/** Vagas em ordem de leitura (fileira, coluna). */
export function ordemDeLeitura(vagas: ElencoVaga[]): ElencoVaga[] {
  return [...vagas].sort((a, b) => a.linha - b.linha || a.coluna - b.coluna);
}

/** Próxima vaga: esquerda/direita na ordem de leitura; cima/baixo para a fileira vizinha, na coluna mais próxima. */
export function vagaVizinha(vagas: ElencoVaga[], atual: string, dir: number, eixo: "x" | "y"): string {
  const ordem = ordemDeLeitura(vagas);
  const i = ordem.findIndex((v) => v.chave === atual);
  if (i < 0) return ordem[0]?.chave ?? atual;
  if (eixo === "x") return ordem[Math.min(ordem.length - 1, Math.max(0, i + dir))].chave;
  const aqui = ordem[i];
  const alvo = ordem.filter((v) => v.linha === aqui.linha + dir);
  if (!alvo.length) return atual;
  return alvo.reduce((m, v) => (Math.abs(v.coluna - aqui.coluna) < Math.abs(m.coluna - aqui.coluna) ? v : m)).chave;
}

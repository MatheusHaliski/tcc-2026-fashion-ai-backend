/**
 * ACERVO — leitura da árvore (ambiente → móvel → compartimento) sem tocar na rede: achar um compartimento, listar as
 * peças de um lugar, filtrar, ordenar e refazer as contagens depois de mover peças.
 */
import type { AcervoArvore, AcervoCompartimento, AcervoModo, AcervoMovel, AcervoPeca } from "./types";

/** Seleção do diretório: um compartimento, as peças sem lugar ou todas as peças. */
export type AcervoLocal = { tipo: "COMPARTIMENTO"; id: string } | { tipo: "SEM_LUGAR" } | { tipo: "TODAS" };
export type AcervoFiltro = "TODAS" | "FAVORITAS" | "EM_USO";
export type AcervoOrdem = "RECENTES" | "NOME" | "PRECO";

export const moveisDe = (arvore: AcervoArvore, modo?: AcervoModo): AcervoMovel[] =>
  arvore.ambientes.flatMap((a) => a.moveis).filter((m) => !modo || m.modo === modo);

export const compartimentosDe = (arvore: AcervoArvore): AcervoCompartimento[] => moveisDe(arvore).flatMap((m) => m.compartimentos);

export function acharCompartimento(arvore: AcervoArvore, id: string | null | undefined) {
  if (!id) return null;
  for (const ambiente of arvore.ambientes) {
    for (const movel of ambiente.moveis) {
      const compartimento = movel.compartimentos.find((c) => c.id === id);
      if (compartimento) return { ambiente, movel, compartimento };
    }
  }
  return null;
}

/** "Closet / Armário 01 / Gaveta 1", ou nulo quando o compartimento não existe. */
export function caminhoDe(arvore: AcervoArvore, id: string | null | undefined): string | null {
  const achado = acharCompartimento(arvore, id);
  return achado ? `${achado.ambiente.nome} / ${achado.movel.nome} / ${achado.compartimento.nome}` : null;
}

export function pecasDoLocal(arvore: AcervoArvore, local: AcervoLocal): AcervoPeca[] {
  if (local.tipo === "TODAS") return arvore.pecas;
  if (local.tipo === "SEM_LUGAR") return arvore.pecas.filter((p) => !p.compartimentoId);
  return arvore.pecas.filter((p) => p.compartimentoId === local.id);
}

export const pecasDoCompartimento = (arvore: AcervoArvore, id: string): AcervoPeca[] => arvore.pecas.filter((p) => p.compartimentoId === id);

export function filtrar(pecas: AcervoPeca[], filtro: AcervoFiltro): AcervoPeca[] {
  if (filtro === "FAVORITAS") return pecas.filter((p) => p.favorite);
  if (filtro === "EM_USO") return pecas.filter((p) => p.emUso);
  return pecas;
}

/** "RECENTES" mantém a ordem do servidor (últimas adicionadas primeiro). */
export function ordenar(pecas: AcervoPeca[], ordem: AcervoOrdem, idioma: string): AcervoPeca[] {
  if (ordem === "NOME") return [...pecas].sort((a, b) => a.name.localeCompare(b.name, idioma));
  if (ordem === "PRECO") return [...pecas].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  return pecas;
}

/** Destinos do menu "Mover para…": todos os compartimentos, com o caminho completo. */
export function destinos(arvore: AcervoArvore): { id: string; caminho: string }[] {
  return arvore.ambientes.flatMap((a) =>
    a.moveis.flatMap((m) => m.compartimentos.map((c) => ({ id: c.id, caminho: `${a.nome} / ${m.nome} / ${c.nome}` }))));
}

/** Árvore com as peças no novo lugar e as contagens refeitas (o que a tela mostra enquanto o servidor responde). */
export function comPecasMovidas(arvore: AcervoArvore, pieceIds: string[], compartimentoId: string | null): AcervoArvore {
  const movidas = new Set(pieceIds);
  const caminho = caminhoDe(arvore, compartimentoId);
  const pecas = arvore.pecas.map((p) => (movidas.has(p.id) ? { ...p, compartimentoId, caminho } : p));
  return recontar({ ...arvore, pecas });
}

export function recontar(arvore: AcervoArvore): AcervoArvore {
  const porCompartimento = new Map<string, number>();
  for (const p of arvore.pecas) {
    if (p.compartimentoId) porCompartimento.set(p.compartimentoId, (porCompartimento.get(p.compartimentoId) ?? 0) + 1);
  }
  const ambientes = arvore.ambientes.map((a) => {
    const moveis = a.moveis.map((m) => {
      const compartimentos = m.compartimentos.map((c) => ({ ...c, pecas: porCompartimento.get(c.id) ?? 0 }));
      return { ...m, compartimentos, pecas: compartimentos.reduce((soma, c) => soma + c.pecas, 0) };
    });
    return { ...a, moveis, pecas: moveis.reduce((soma, m) => soma + m.pecas, 0) };
  });
  const semLugar = arvore.pecas.filter((p) => !p.compartimentoId || !porCompartimentoTem(ambientes, p.compartimentoId)).length;
  return { ...arvore, ambientes, semLugar, total: arvore.pecas.length };
}

function porCompartimentoTem(ambientes: AcervoArvore["ambientes"], id: string): boolean {
  return ambientes.some((a) => a.moveis.some((m) => m.compartimentos.some((c) => c.id === id)));
}

/** Número do marcador de cada peça selecionada (1, 2, 3…), na ordem em que foram marcadas. */
export function marcadores(selecao: string[]): Map<string, number> {
  return new Map(selecao.map((id, i) => [id, i + 1]));
}

/** Marcadores que caem em cada compartimento (para desenhar no móvel). */
export function marcadoresPorCompartimento(arvore: AcervoArvore, selecao: string[]): Map<string, number[]> {
  const numeros = marcadores(selecao);
  const out = new Map<string, number[]>();
  for (const p of arvore.pecas) {
    const n = numeros.get(p.id);
    if (n && p.compartimentoId) out.set(p.compartimentoId, [...(out.get(p.compartimentoId) ?? []), n].sort((a, b) => a - b));
  }
  return out;
}

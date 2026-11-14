/**
 * A fileira do deck (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 1): abas de recurso logo acima (as vagas de roupa
 * viram uma aba só, "Roupas"; zonas do editor, maquiagem e resposta continuam uma aba cada) e uma fileira de itens.
 * A vaga escolhida na régua filtra a fileira: a carta que não cabe continua na fileira (para dizer o motivo), mas vai
 * para o fim e não pode ser vestida. Puro.
 */
import type { ResourceItem, ResourceTab } from "@/lib/flair/nucleos/selection";

export const GRUPO_ROUPAS = "ROUPAS";

export interface AbaVisivel {
  /** id da aba ou GRUPO_ROUPAS */
  id: string;
  tipo: ResourceTab["tipo"] | "roupas";
  /** índices das abas (na lista inteira) que esta aba mostra */
  indices: number[];
}

/**
 * Abas que aparecem acima da fileira. Com `agrupar`, todas as vagas de carta viram a aba "Roupas" (a régua de vagas
 * escolhe a vaga); sem, cada aba aparece sozinha (janela de recursos do MAKE UP).
 */
export function abasVisiveis(tabs: ResourceTab[], agrupar: boolean, mostrar?: (tab: ResourceTab) => boolean): AbaVisivel[] {
  const out: AbaVisivel[] = [];
  tabs.forEach((tab, i) => {
    if (mostrar && !mostrar(tab)) return;
    const roupas = agrupar && tab.tipo === "vaga" ? out.find((a) => a.tipo === "roupas") : undefined;
    if (roupas) {
      roupas.indices.push(i);
    } else if (agrupar && tab.tipo === "vaga") {
      out.push({ id: GRUPO_ROUPAS, tipo: "roupas", indices: [i] });
    } else {
      out.push({ id: tab.id, tipo: tab.tipo, indices: [i] });
    }
  });
  return out;
}

/** A aba visível que contém a aba atual do tabuleiro. */
export function abaVisivelAtual(visiveis: AbaVisivel[], aba: number): AbaVisivel | null {
  return visiveis.find((a) => a.indices.includes(aba)) ?? null;
}

export interface ItemDaFileira {
  aba: number;
  item: number;
  tab: ResourceTab;
  it: ResourceItem;
  /** false = a carta não é da vaga escolhida na régua */
  cabe: boolean;
}

/**
 * Itens da fileira da aba visível. `vaga` é a vaga escolhida na régua (null = sem filtro): as cartas da vaga vêm
 * primeiro e as demais ficam marcadas como "não cabe".
 */
export function itensDaFileira(tabs: ResourceTab[], visivel: AbaVisivel | null, vaga: string | null): ItemDaFileira[] {
  if (!visivel) return [];
  const todos: ItemDaFileira[] = [];
  for (const aba of visivel.indices) {
    const tab = tabs[aba];
    const cabe = visivel.tipo !== "roupas" || vaga == null || tab.id === vaga;
    tab.items.forEach((it, item) => todos.push({ aba, item, tab, it, cabe }));
  }
  return [...todos.filter((x) => x.cabe), ...todos.filter((x) => !x.cabe)];
}

/** Abas de vaga (as casas da régua), com o índice de cada uma na lista inteira. */
export function vagasDaRegua(tabs: ResourceTab[]): { aba: number; tab: ResourceTab }[] {
  const out: { aba: number; tab: ResourceTab }[] = [];
  tabs.forEach((tab, aba) => {
    if (tab.tipo === "vaga") out.push({ aba, tab });
  });
  return out;
}

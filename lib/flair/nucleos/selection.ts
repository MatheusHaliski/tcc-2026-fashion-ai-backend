/**
 * Janela de recursos: abas (vagas de cartas, zonas do editor, áreas de maquiagem, resposta) com os itens de cada uma,
 * e o que a pessoa já escolheu. Funções puras: a tela só guarda o estado e chama estas transformações.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { PALETA_INICIAL, tomDe, type Paleta } from "@/lib/flair/make-up/palette";
import { ACABAMENTOS_ZONA, CORES_ZONA } from "@/lib/flair/nucleos/palette";
import type { AbaIcone, NucleoEntrega, NucleoRecurso, MaquiagemEscolha, ZonaEscolha } from "@/lib/flair/nucleos/types";

export type ResourceItem =
  | { kind: "carta"; key: string; card: FlairCollectionCard }
  | { kind: "cor"; key: string; codigo: string; hex: string }
  | { kind: "acabamento"; key: string; codigo: string }
  | { kind: "familia"; key: string; codigo: string; hex: string }
  | { kind: "maqAcabamento"; key: string; codigo: string }
  | { kind: "opcao"; key: string; codigo: string };

export interface ResourceTab {
  id: string;
  tipo: "vaga" | "zona" | "area" | "resposta";
  icone: AbaIcone;
  items: ResourceItem[];
  /** chave do nome da aba quando o jogo dá um nome próprio a ela (a aba de resposta do FASHION_SPORTS é "Modalidade") */
  rotulo?: string;
}

export interface Selecao {
  cartas: Record<string, string>;
  zonas: Record<string, ZonaEscolha>;
  maquiagem: Record<string, MaquiagemEscolha>;
  resposta: string | null;
}

export const SELECAO_VAZIA: Selecao = { cartas: {}, zonas: {}, maquiagem: {}, resposta: null };

export interface TabsInput {
  recursos: NucleoRecurso[];
  vagas: string[];
  zonas: string[];
  areas: string[];
  opcoes: string[];
  paleta?: Paleta | null;
  codigo?: string;
}

const ICONE_VAGA: Record<string, AbaIcone> = { SUP: "sup", INF: "inf", CAL: "cal", ACE: "ace", VES: "ves" };
const ICONE_AREA: Record<string, AbaIcone> = { LABIOS: "labios", OLHOS: "olhos", BOCHECHAS: "bochechas" };

/** Cartas de uma vaga: as da posição da vaga (ordem da coleção). */
export function cartasDaVaga(cards: FlairCollectionCard[], vaga: string): FlairCollectionCard[] {
  return cards.filter((c) => c.position === vaga);
}

export function buildTabs(input: TabsInput, cards: FlairCollectionCard[]): ResourceTab[] {
  const tabs: ResourceTab[] = [];
  if (input.recursos.includes("CARTAS")) {
    for (const vaga of input.vagas) {
      const items = cartasDaVaga(cards, vaga).map((card): ResourceItem => ({ kind: "carta", key: card.id, card }));
      tabs.push({ id: vaga, tipo: "vaga", icone: ICONE_VAGA[vaga] ?? "ace", items });
    }
  }
  if (input.recursos.includes("ZONAS")) {
    for (const zona of input.zonas) {
      const cores = CORES_ZONA.map((c): ResourceItem => ({ kind: "cor", key: `cor-${c.codigo}`, codigo: c.codigo, hex: c.hex }));
      const acab = ACABAMENTOS_ZONA.map((a): ResourceItem => ({ kind: "acabamento", key: `acab-${a}`, codigo: a }));
      tabs.push({ id: zona, tipo: "zona", icone: "zona", items: [...cores, ...acab] });
    }
  }
  if (input.recursos.includes("MAQUIAGEM")) {
    const paleta = input.paleta ?? PALETA_INICIAL;
    for (const area of input.areas) {
      const p = paleta[area] ?? PALETA_INICIAL[area] ?? { familias: [], acabamentos: [] };
      const fam = p.familias.map((f): ResourceItem => ({ kind: "familia", key: `fam-${f}`, codigo: f, hex: tomDe(area, f) }));
      const acab = p.acabamentos.map((a): ResourceItem => ({ kind: "maqAcabamento", key: `maq-${a}`, codigo: a }));
      tabs.push({ id: area, tipo: "area", icone: ICONE_AREA[area] ?? "labios", items: [...fam, ...acab] });
    }
  }
  if (input.recursos.includes("RESPOSTA") && input.opcoes.length) {
    const items = input.opcoes.map((o): ResourceItem => ({ kind: "opcao", key: `op-${o}`, codigo: o }));
    tabs.push({ id: "RESPOSTA", tipo: "resposta", icone: "resposta", items, rotulo: input.codigo && `flair3d.nucleo.${input.codigo}.tab.RESPOSTA` });
  }
  return tabs;
}

export function applyItem(sel: Selecao, tab: ResourceTab, item: ResourceItem): Selecao {
  switch (item.kind) {
    case "carta":
      return { ...sel, cartas: { ...sel.cartas, [tab.id]: item.card.id } };
    case "cor":
      return { ...sel, zonas: { ...sel.zonas, [tab.id]: { ...sel.zonas[tab.id], cor: item.hex } } };
    case "acabamento":
      return { ...sel, zonas: { ...sel.zonas, [tab.id]: { ...sel.zonas[tab.id], acabamento: item.codigo } } };
    case "familia":
      return { ...sel, maquiagem: { ...sel.maquiagem, [tab.id]: { ...sel.maquiagem[tab.id], familia: item.codigo } } };
    case "maqAcabamento":
      return { ...sel, maquiagem: { ...sel.maquiagem, [tab.id]: { ...sel.maquiagem[tab.id], acabamento: item.codigo } } };
    case "opcao":
      return { ...sel, resposta: item.codigo };
  }
}

/** Tira o que está na aba (peça da vaga, cor/acabamento da zona, maquiagem da área ou a resposta). */
export function removeAt(sel: Selecao, tab: ResourceTab): Selecao {
  const sem = <T,>(rec: Record<string, T>) => {
    const copy = { ...rec };
    delete copy[tab.id];
    return copy;
  };
  if (tab.tipo === "vaga") return { ...sel, cartas: sem(sel.cartas) };
  if (tab.tipo === "zona") return { ...sel, zonas: sem(sel.zonas) };
  if (tab.tipo === "area") return { ...sel, maquiagem: sem(sel.maquiagem) };
  return { ...sel, resposta: null };
}

export function isApplied(sel: Selecao, tab: ResourceTab, item: ResourceItem): boolean {
  switch (item.kind) {
    case "carta":
      return sel.cartas[tab.id] === item.card.id;
    case "cor":
      return sel.zonas[tab.id]?.cor === item.hex;
    case "acabamento":
      return sel.zonas[tab.id]?.acabamento === item.codigo;
    case "familia":
      return sel.maquiagem[tab.id]?.familia === item.codigo;
    case "maqAcabamento":
      return sel.maquiagem[tab.id]?.acabamento === item.codigo;
    case "opcao":
      return sel.resposta === item.codigo;
  }
}

export function toEntrega(sel: Selecao): NucleoEntrega {
  return { cartas: sel.cartas, zonas: sel.zonas, maquiagem: sel.maquiagem, resposta: sel.resposta };
}

/** Algo para entregar? (uma escolha qualquer) */
export function temEscolha(sel: Selecao): boolean {
  const n = Object.keys(sel.cartas).length + Object.keys(sel.zonas).length + Object.keys(sel.maquiagem).length;
  return n > 0 || !!sel.resposta;
}

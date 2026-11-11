/**
 * Estado da tela de jogo (aba, item em foco, escolhas, avatar e painel do objetivo) e a redução de cada comando do
 * controle. Puro: a tela usa com useReducer; "entregar" fica com a tela (chama a API).
 */
import type { Comando } from "@/lib/flair/nucleos/controls";
import { applyItem, removeAt, SELECAO_VAZIA, type ResourceTab, type Selecao } from "@/lib/flair/nucleos/selection";

export interface AvatarEstado {
  /** giro do avatar em graus (passos de 30°) */
  giro: number;
  /** nível do zoom: 0 = corpo inteiro; positivo aproxima */
  zoom: number;
  /** contador de poses: cada "posar" incrementa e a cena anima uma pose */
  poses: number;
  /** desfilando (vai até o fim da passarela e volta ao parar) */
  desfilando: boolean;
}

export interface BoardEstado {
  aba: number;
  item: number;
  sel: Selecao;
  avatar: AvatarEstado;
  objetivo: boolean;
  zoomMin: number;
  zoomMax: number;
}

export const GIRO_PASSO = 30;
/** itens por linha da grade de recursos (cima/baixo anda uma linha) */
export const COLUNAS = 4;

export function boardInicial(zoomMax = 3, zoomMin = -2): BoardEstado {
  return {
    aba: 0,
    item: 0,
    sel: SELECAO_VAZIA,
    avatar: { giro: 0, zoom: 0, poses: 0, desfilando: false },
    objetivo: false,
    zoomMin,
    zoomMax,
  };
}

export type BoardAcao =
  | { type: "comando"; comando: Comando; tabs: ResourceTab[] }
  | { type: "aba"; index: number }
  | { type: "foco"; aba: number; item: number }
  | { type: "aplicar"; aba: number; item: number; tabs: ResourceTab[] }
  | { type: "selecao"; sel: Selecao };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const ciclo = (v: number, n: number) => (n <= 0 ? 0 : ((v % n) + n) % n);

function aplicar(s: BoardEstado, tabs: ResourceTab[], aba: number, item: number): BoardEstado {
  const tab = tabs[aba];
  const it = tab?.items[item];
  if (!tab || !it) return s;
  return { ...s, aba, item, sel: applyItem(s.sel, tab, it) };
}

function comando(s: BoardEstado, c: Comando, tabs: ResourceTab[]): BoardEstado {
  const dir = c.dir ?? 1;
  const n = tabs[s.aba]?.items.length ?? 0;
  switch (c.acao) {
    case "NAVEGAR": {
      const passo = c.eixo === "y" ? dir * COLUNAS : dir;
      return { ...s, item: n ? clamp(s.item + passo, 0, n - 1) : 0 };
    }
    case "TROCAR_ABA":
      return { ...s, aba: ciclo(s.aba + dir, tabs.length), item: 0 };
    case "APLICAR":
      return aplicar(s, tabs, s.aba, s.item);
    case "TIRAR":
      return tabs[s.aba] ? { ...s, sel: removeAt(s.sel, tabs[s.aba]) } : s;
    case "GIRAR":
      return { ...s, avatar: { ...s.avatar, giro: ciclo(s.avatar.giro + dir * GIRO_PASSO, 360) } };
    case "ZOOM":
      return { ...s, avatar: { ...s.avatar, zoom: clamp(s.avatar.zoom + dir, s.zoomMin, s.zoomMax) } };
    case "POSAR":
      return { ...s, avatar: { ...s.avatar, poses: s.avatar.poses + 1 } };
    case "DESFILAR":
      return { ...s, avatar: { ...s.avatar, desfilando: !s.avatar.desfilando } };
    case "OBJETIVO":
      return { ...s, objetivo: !s.objetivo };
    default:
      return s;
  }
}

export function boardReducer(s: BoardEstado, a: BoardAcao): BoardEstado {
  switch (a.type) {
    case "comando":
      return comando(s, a.comando, a.tabs);
    case "aba":
      return { ...s, aba: a.index, item: 0 };
    case "foco":
      return { ...s, aba: a.aba, item: a.item };
    case "aplicar":
      return aplicar(s, a.tabs, a.aba, a.item);
    case "selecao":
      return { ...s, sel: a.sel };
  }
}

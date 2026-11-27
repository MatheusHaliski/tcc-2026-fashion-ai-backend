/**
 * ACERVO — opções da configuração do móvel (as mesmas que o servidor aceita em AcervoRegras.java), com a cor de cada
 * acabamento para a amostra do painel e para os materiais da cena.
 */
import type { AcervoAcabamento, AcervoCor, AcervoMaterial, AcervoModo, AcervoMovelForm, AcervoPorta, AcervoPuxador, AcervoTipo } from "./types";

export const MATERIAIS: AcervoMaterial[] = ["MADEIRA", "LACA", "VIDRO", "METAL"];
export const CORES: AcervoCor[] = ["NOGUEIRA", "CARVALHO", "FREIJO", "EBANO", "MARFIM", "AREIA", "GRAFITE", "BRANCO"];
export const PORTAS: AcervoPorta[] = ["SEM_PORTA", "ABRIR", "CORRER", "VIDRO"];
export const PUXADORES: AcervoPuxador[] = ["BARRA", "BOTAO", "CAVA", "SEM_PUXADOR"];
export const ACABAMENTOS: AcervoAcabamento[] = ["LATAO", "GRAFITE", "CROMADO", "PRETO"];
export const TIPOS: AcervoTipo[] = ["CABIDEIRO", "PRATELEIRA", "GAVETA"];

/** Cor base e cor do veio de cada tom. */
export const COR_HEX: Record<AcervoCor, { base: string; veio: string }> = {
  NOGUEIRA: { base: "#7A5236", veio: "#5A3A24" },
  CARVALHO: { base: "#C19A6B", veio: "#A07C50" },
  FREIJO: { base: "#A9773F", veio: "#86592B" },
  EBANO: { base: "#3A2C25", veio: "#261C17" },
  MARFIM: { base: "#EFE8DA", veio: "#DDD3C0" },
  AREIA: { base: "#D9C7A8", veio: "#C2AE8C" },
  GRAFITE: { base: "#3C3F42", veio: "#2C2E30" },
  BRANCO: { base: "#F6F5F1", veio: "#E4E2DA" },
};

export const ACABAMENTO_HEX: Record<AcervoAcabamento, string> = {
  LATAO: "#B8914A",
  GRAFITE: "#4A4D50",
  CROMADO: "#C9CED3",
  PRETO: "#1C1C1C",
};

/** Limites em centímetros (iguais aos do servidor). */
export const LIMITES = {
  larguraCm: [40, 400],
  alturaCm: [40, 300],
  profundidadeCm: [20, 100],
  porTipo: 8,
} as const;

/** Configuração inicial de um móvel novo em cada modo. */
export function movelPadrao(modo: AcervoModo, nome: string): AcervoMovelForm {
  if (modo === "DREAM_SPACE") {
    return { nome, modo, larguraCm: 160, alturaCm: 210, profundidadeCm: 55, material: "VIDRO", cor: "MARFIM", porta: "VIDRO", puxador: "CAVA", puxadorAcabamento: "CROMADO", cabideiros: 1, prateleiras: 3, gavetas: 2 };
  }
  return { nome, modo, larguraCm: 120, alturaCm: 220, profundidadeCm: 60, material: "MADEIRA", cor: "NOGUEIRA", porta: "SEM_PORTA", puxador: "BARRA", puxadorAcabamento: "LATAO", cabideiros: 1, prateleiras: 3, gavetas: 3 };
}

const chave = (grupo: string, valor: string) => `acervo.opcao.${grupo}.${valor.toLowerCase()}`;
export const chaveMaterial = (v: AcervoMaterial) => chave("material", v);
export const chaveCor = (v: AcervoCor) => chave("cor", v);
export const chavePorta = (v: AcervoPorta) => chave("porta", v);
export const chavePuxador = (v: AcervoPuxador) => chave("puxador", v);
export const chaveAcabamento = (v: AcervoAcabamento) => chave("acabamento", v);
export const chaveTipo = (v: AcervoTipo) => chave("tipo", v);

/** Dados de teste do ACERVO: um closet com dois armários, três peças guardadas e uma sem lugar. */
import type { AcervoArvore, AcervoCompartimento, AcervoDesejo, AcervoFinanceiro, AcervoMovel, AcervoPeca, AcervoTipo } from "@/lib/acervo/types";

export const compartimento = (id: string, movelId: string, tipo: AcervoTipo, nome: string, ordem: number, pecas = 0): AcervoCompartimento =>
  ({ id, movelId, tipo, nome, ordem, pecas });

export const movel = (id: string, nome: string, compartimentos: AcervoCompartimento[], extra: Partial<AcervoMovel> = {}): AcervoMovel => ({
  id,
  ambienteId: "a1",
  nome,
  ordem: 0,
  modo: "MEU_ESPACO",
  larguraCm: 120,
  alturaCm: 220,
  profundidadeCm: 60,
  material: "MADEIRA",
  cor: "NOGUEIRA",
  porta: "SEM_PORTA",
  puxador: "BARRA",
  puxadorAcabamento: "LATAO",
  compartimentos,
  pecas: compartimentos.reduce((soma, c) => soma + c.pecas, 0),
  ...extra,
});

export const peca = (id: string, name: string, extra: Partial<AcervoPeca> = {}): AcervoPeca => ({
  id,
  name,
  category: "upper_piece",
  subcategory: "shirt",
  color: "white",
  size: "M",
  brand: null,
  price: null,
  currency: "BRL",
  condition: "GOOD",
  conservacao: null,
  thumbnailUrl: null,
  favorite: false,
  wearCount: 0,
  lastWornDate: null,
  emUso: false,
  compartimentoId: null,
  caminho: null,
  medidas: { larguraCm: null, comprimentoCm: null, nota: null },
  ...extra,
});

export const ARMARIO_1 = movel("m1", "Armário 01", [
  compartimento("c-cab", "m1", "CABIDEIRO", "Cabideiro", 0, 1),
  compartimento("c-pra", "m1", "PRATELEIRA", "Prateleira 1", 1, 0),
  compartimento("c-gav1", "m1", "GAVETA", "Gaveta 01", 2, 2),
  compartimento("c-gav2", "m1", "GAVETA", "Gaveta 02", 3, 0),
]);

export const ARMARIO_2 = movel("m2", "Armário 02", [compartimento("c2-cab", "m2", "CABIDEIRO", "Cabideiro", 0, 0)], { ordem: 1, porta: "ABRIR" });

export const PECAS: AcervoPeca[] = [
  peca("p1", "Jaqueta de couro", { subcategory: "jacket", color: "black", price: 890, favorite: true, compartimentoId: "c-cab", caminho: "Closet principal / Armário 01 / Cabideiro", brand: "Marca X", emUso: true, lastWornDate: "2026-11-10", wearCount: 5 }),
  peca("p2", "Camiseta básica", { subcategory: "t_shirt", price: 159, compartimentoId: "c-gav1", caminho: "Closet principal / Armário 01 / Gaveta 01" }),
  peca("p3", "Camiseta oversized", { subcategory: "t_shirt", color: "black", price: 190, compartimentoId: "c-gav1", caminho: "Closet principal / Armário 01 / Gaveta 01" }),
  peca("p4", "Camisa branca", { size: "M" }),
];

export const ARVORE: AcervoArvore = {
  ambientes: [{ id: "a1", nome: "Closet principal", ordem: 0, moveis: [ARMARIO_1, ARMARIO_2], pecas: 3 }],
  pecas: PECAS,
  total: 4,
  semLugar: 1,
};

export const DESEJO: AcervoDesejo = {
  id: "d1",
  nome: "Bota de couro",
  categoria: "shoes_piece",
  cor: "marrom",
  tamanho: "38",
  marca: null,
  precoEstimado: 480,
  moeda: "BRL",
  estimado: true,
  compartimentoId: "c-pra",
  caminho: "Closet principal / Armário 01 / Prateleira 1",
};

export const FINANCEIRO: AcervoFinanceiro = {
  moeda: "BRL",
  valor: 1239,
  pecasComPreco: 3,
  pecasSemPreco: 1,
  pecasOutraMoeda: 0,
  totalPecas: 4,
  grupos: [
    { grupo: "ROUPAS", pecas: 4, valor: 1239 },
    { grupo: "CALCADOS", pecas: 0, valor: 0 },
    { grupo: "ACESSORIOS", pecas: 0, valor: 0 },
    { grupo: "OUTROS", pecas: 0, valor: 0 },
  ],
  selecao: { valor: 0, pecasComPreco: 0, pecasSemPreco: 0, pecasOutraMoeda: 0, totalPecas: 0 },
  desejos: { valor: 480, itens: 1, semPreco: 0, outraMoeda: 0, estimado: true },
  custoPorUso: { valor: 178, pecas: 1, usos: 5 },
};

/** Rotas simuladas da API do ACERVO para os testes de tela. */
export function rotasDoAcervo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "GET /api/me/acervo": ARVORE,
    "GET /api/me/acervo/desejos": [DESEJO],
    "GET /api/me/acervo/financeiro": FINANCEIRO,
    "GET /api/taxonomy": { colors: { white: "#FFFFFF", black: "#111111" }, subcategories: {}, materials: [], sizes: [], sexes: [] },
    ...extra,
  };
}

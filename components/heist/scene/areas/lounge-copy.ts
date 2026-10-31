/*
 * MET Gala Heist v2 — textos DIEGÉTICOS do lounge e bar (Z05), desenhados nas texturas da área nos três idiomas do
 * cenário: rótulos das garrafas (os nomes das marcas inventadas não mudam; a descrição e o teor mudam), o cardápio de
 * coquetéis do Bar Lumière, o título da partitura no piano e as capas dos livros de arte das mesas baixas. Tudo é ficção:
 * nenhuma marca real.
 */
import { COPY, type InteriorCopy, type SceneLocale } from "../interior-copy";

export interface LoungeCopy {
  /** descrição de cada rótulo (na ordem de LABELS em lounge-tex.ts) e o rodapé "teor · volume" ({abv} vira o número) */
  labelSubs: string[]; labelFoot: string;
  /** cardápio: título, subtítulo, os seis coquetéis e a linha de ingredientes */
  menuTitle: string; menuSub: string; cocktails: string[]; ingredients: string;
  /** partitura aberta na estante do piano */
  score: string;
  /** capas dos quatro livros de arte */
  books: [string, string, string, string];
}

export const LOUNGE_COPY: Record<SceneLocale, LoungeCopy> = {
  "pt-BR": {
    labelSubs: ["Conhaque XO", "London Dry Gin", "Rum envelhecido", "Amaro", "Single malt", "Vermute de gala", "Absinto", "Mezcal jovem", "Cachaça de alambique", "Licor de pétalas", "Vintage", "Xerez seco", "Champagne brut", "Crème de violette", "Licor cítrico", "Bourbon de pequeno lote"],
    labelFoot: "{abv}% vol · 700 ml",
    menuTitle: "Bar Lumière", menuSub: "coquetéis da casa",
    cocktails: ["Vesper Lumière", "Rosa de Gala", "Noite no Museu", "Sombra & Mel", "Diamante Negro", "Aurora Tropical"],
    ingredients: "gim · vermute · casca de laranja",
    score: "Noturno em mi bemol",
    books: ["MODA E RUÍNA", "ATELIÊS DE PARIS", "LUMIÈRE · 1957", "O CORTE PERFEITO"],
  },
  en: {
    labelSubs: ["Cognac XO", "London Dry Gin", "Aged rum", "Amaro", "Single malt", "Gala vermouth", "Absinthe", "Mezcal joven", "Pot-still cachaça", "Petal liqueur", "Vintage", "Dry sherry", "Champagne brut", "Crème de violette", "Citrus liqueur", "Small-batch bourbon"],
    labelFoot: "{abv}% ABV · 700 ml",
    menuTitle: "Bar Lumière", menuSub: "house cocktails",
    cocktails: ["Vesper Lumière", "Gala Rose", "Night at the Museum", "Shadow & Honey", "Black Diamond", "Tropical Aurora"],
    ingredients: "gin · vermouth · orange peel",
    score: "Nocturne in E-flat",
    books: ["FASHION AND RUIN", "ATELIERS OF PARIS", "LUMIÈRE · 1957", "THE PERFECT CUT"],
  },
  es: {
    labelSubs: ["Coñac XO", "London Dry Gin", "Ron añejo", "Amaro", "Single malt", "Vermut de gala", "Absenta", "Mezcal joven", "Cachaça de alambique", "Licor de pétalos", "Vintage", "Jerez seco", "Champagne brut", "Crème de violette", "Licor cítrico", "Bourbon de pequeño lote"],
    labelFoot: "{abv}% vol · 700 ml",
    menuTitle: "Bar Lumière", menuSub: "cócteles de la casa",
    cocktails: ["Vesper Lumière", "Rosa de Gala", "Noche en el Museo", "Sombra & Miel", "Diamante Negro", "Aurora Tropical"],
    ingredients: "ginebra · vermut · piel de naranja",
    score: "Nocturno en mi bemol",
    books: ["MODA Y RUINA", "TALLERES DE PARÍS", "LUMIÈRE · 1957", "EL CORTE PERFECTO"],
  },
};

/** Idioma do cenário a partir do texto comum do interior (c.copy): o mesmo critério das outras áreas. */
export const loungeLocale = (copy: InteriorCopy): SceneLocale => (copy === COPY.en ? "en" : copy === COPY.es ? "es" : "pt-BR");
export const loungeCopy = (copy: InteriorCopy): LoungeCopy => LOUNGE_COPY[loungeLocale(copy)];

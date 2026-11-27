/**
 * Cards de peça e de look: o que vira ícone nas células de informação. A ocasião usa a família OCC dos ícones FAI
 * (a mesma do Vista-me); as marcações de ocasião são livres (pt/en), então só as conhecidas ganham ícone e o resto
 * continua em texto. O nome por extenso vai sempre no rótulo acessível de quem desenha o ícone.
 */
const OCC: Record<string, string[]> = {
  "OCC-01": ["work", "trabalho", "office", "escritorio", "business", "negocios"],
  "OCC-02": ["college", "faculdade", "school", "escola", "study", "estudo"],
  "OCC-03": ["dinner", "jantar", "restaurant", "restaurante"],
  "OCC-04": ["date", "encontro", "romantic", "romantico"],
  "OCC-05": ["party", "festa", "night", "noite", "balada", "club"],
  "OCC-06": ["gym", "academia", "sport", "esporte", "workout", "treino"],
  "OCC-07": ["beach", "praia", "pool", "piscina"],
  "OCC-08": ["trip", "travel", "viagem"],
  "OCC-09": ["home", "casa", "lounge"],
  "OCC-10": ["walk", "passeio", "casual", "everyday", "dia_a_dia", "outdoor"],
};
const POR_MARCACAO = new Map(Object.entries(OCC).flatMap(([id, nomes]) => nomes.map((n) => [n, id] as const)));

const chave = (valor: string) => valor.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");

/** ID do ícone FAI da ocasião, ou null quando a marcação não tem ícone (fica em texto). */
export function occasionIconId(valor: string): string | null {
  return POR_MARCACAO.get(chave(valor)) ?? null;
}

export type SeasonCode = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export function isSeason(valor?: string | null): valor is SeasonCode {
  return valor === "SPRING" || valor === "SUMMER" || valor === "AUTUMN" || valor === "WINTER";
}

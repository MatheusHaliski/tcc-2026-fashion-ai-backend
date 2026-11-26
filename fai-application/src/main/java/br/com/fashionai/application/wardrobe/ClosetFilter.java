package br.com.fashionai.application.wardrobe;

/**
 * Filtros do closet. {@code hypeLevel} é FILTRO (faixa mínima: NICHE, RELEVANT, HOT, TRENDING, VIRAL), não aba.
 * Ordenações: recent, name, price, worn (mais usada), least_worn, idle (mais tempo sem uso) e, do HypeScore v2,
 * hype/hype_desc, hype_asc, growth (maior crescimento) e rarity (mais rara). {@code seal} (RF53) também é FILTRO:
 * {@code hype} (peças com selo de Hype FashionAI), {@code brand} (com selo de marca/celebridade aprovado na peça) ou
 * {@code any} (qualquer um dos dois).
 */
public record ClosetFilter(String category, String color, String season, String occasion, String style, String state,
                           String q, String sort, int page, int size, String hypeLevel, String seal) {
}

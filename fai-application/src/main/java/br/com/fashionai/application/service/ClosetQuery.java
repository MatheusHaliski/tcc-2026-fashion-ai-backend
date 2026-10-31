package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

/**
 * Política pura do RF6 (Closet Digital): filtros de atributo, normalização de ordenação/selo, escolha do comparador
 * (Strategy sobre {@link Comparator}: uma estratégia de ordem por chave) e janela de paginação.
 *
 * <p>Não conhece Spring, repositórios, {@code Guard} nem quem vê: arquivamento, visibilidade e moderação, a consulta do
 * Hype (privacidade dono × terceiros) e o vínculo de selo de marca continuam em {@link WardrobeService#closet}.
 */
final class ClosetQuery {

    static final Set<String> HYPE_SORTS = Set.of("hype", "hype_desc", "hype_asc", "growth", "rarity");
    /** nomes em português que telas antigas enviavam (antes caíam no padrão e a ordenação era ignorada) */
    static final Map<String, String> SORT_ALIASES = Map.of("recentes", "recent", "mais_usadas", "worn", "menos_usadas", "least_worn",
            "nome", "name", "preco", "price", "mais_tempo_sem_uso", "idle");

    private ClosetQuery() {
    }

    /** Janela da página: tamanho 1..60 (padrão 30), página ≥ 0, recorte [from, to) sobre {@code total}. */
    record Window(int page, int size, int from, int to) {
        boolean hasMore(int total) {
            return to < total;
        }
    }

    static Window window(int page, int size, int total) {
        int s = Math.max(1, Math.min(60, size <= 0 ? 30 : size));
        int p = Math.max(0, page);
        int from = Math.min(total, p * s);
        return new Window(p, s, from, Math.min(total, from + s));
    }

    /**
     * Filtros de atributo escolhidos na tela (categoria, cor/família, estação, ocasião, estilo, estado e busca).
     * Não decide arquivamento, visibilidade nem moderação.
     */
    static boolean matches(WardrobeItem w, WardrobeService.ClosetFilter f) {
        return (blank(f.category()) || f.category().equals(w.getCategory()))
                && (blank(f.color()) || f.color().equals(w.getColor()) || f.color().equalsIgnoreCase(Taxonomy.COLOR_FAMILY.get(w.getColor())))
                && (blank(f.season()) || (w.getMarket() != null && w.getMarket().startsWith(f.season().toLowerCase(Locale.ROOT))))
                && (blank(f.occasion()) || Json.csv(w.getOccasionTags()).contains(f.occasion()))
                && (blank(f.style()) || Json.csv(w.getStyleTags()).contains(f.style()))
                && stateMatches(w, f.state())
                && (blank(f.q()) || contains(w.getName(), f.q()) || contains(w.getBrandName(), f.q()) || contains(w.getSubcategory(), f.q()));
    }

    static boolean stateMatches(WardrobeItem w, String state) {
        if (blank(state) || "todos".equalsIgnoreCase(state)) {
            return true;
        }
        return switch (state.toLowerCase(Locale.ROOT)) {
            case "favoritos", "favorites" -> w.isFavorite();
            case "disponivel", "disponiveis", "available" -> w.isDisponivel();
            case "indisponivel", "indisponiveis", "unavailable" -> !w.isDisponivel();
            case "venda", "a_venda", "for_sale", "forsale" -> w.isForSale();
            case "doar", "para_doar", "doacao", "for_donation", "donation" -> w.isForDonation();
            default -> true;
        };
    }

    /** RF53 — valor do filtro "com selo": hype, brand ou any (nulo = sem filtro; valor desconhecido é ignorado). */
    static String sealFilter(String raw) {
        if (blank(raw)) {
            return null;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "hype" -> "hype";
            case "brand", "marca", "celebrity", "celebridade" -> "brand";
            case "any", "qualquer", "all" -> "any";
            default -> null;
        };
    }

    /** Chave de ordenação: nulo vira "recent"; apelido em português (sensível a maiúsculas) vira a chave em inglês. */
    static String sortKey(String raw) {
        String sort = raw == null ? "recent" : raw;
        return SORT_ALIASES.getOrDefault(sort, sort);
    }

    /** O Hype só é consultado quando a ordem, a faixa mínima ou o selo (hype/any) dependem dele. */
    static boolean needsHype(String sort, String hypeLevel, String seal) {
        return HYPE_SORTS.contains(sort) || !blank(hypeLevel) || (seal != null && !"brand".equals(seal));
    }

    /** Faixa mínima sobre o número EXIBIDO (arredondado): 59,6 aparece como 60 e já é "Em alta"; sem score fica fora. */
    static boolean belowMinimum(HypeScoreCurrent h, int min) {
        return h == null || h.getScore() == null || h.getScore().doubleValue() < min - 0.5;
    }

    /** RF53 — a peça fica no filtro de selo? hype: só com selo de Hype; brand: só com selo de marca; any: qualquer um. */
    static boolean keepForSeal(String seal, boolean hasHype, boolean hasBrand) {
        return switch (seal) {
            case "hype" -> hasHype;
            case "brand" -> hasBrand;
            default -> hasHype || hasBrand;
        };
    }

    /** Estratégia de ordenação por chave (já normalizada por {@link #sortKey}); desconhecida = mais recentes primeiro. */
    static Comparator<WardrobeItem> order(String sort, Map<UUID, HypeScoreCurrent> hype, LocalDate today) {
        Function<WardrobeItem, HypeScoreCurrent> h = w -> hype.get(w.getId());
        Function<WardrobeItem, BigDecimal> score = w -> h.apply(w) == null ? null : h.apply(w).getScore();
        return switch (sort) {
            case "hype", "hype_desc" -> nullsLast(score, true);
            case "hype_asc" -> nullsLast(score, false);
            case "growth" -> nullsLast(w -> h.apply(w) == null ? null : h.apply(w).getDeltaPoints(), true)
                    .thenComparing(nullsLast(w -> h.apply(w) == null ? null : h.apply(w).getDimensions().getTrend(), true));
            case "rarity" -> nullsLast(w -> h.apply(w) == null ? null : h.apply(w).getDimensions().getRarity(), true);
            case "least_worn" -> Comparator.comparingInt(WardrobeItem::getWearCount).thenComparing(WardrobeItem::getCreatedAt);
            case "idle" -> Comparator.comparingLong((WardrobeItem w) -> HypeQueryService.idleDays(w, today)).reversed();
            case "worn" -> Comparator.comparingInt(WardrobeItem::getWearCount).reversed();
            case "name" -> Comparator.comparing(w -> w.getName().toLowerCase(Locale.ROOT));
            case "price" -> Comparator.comparing((WardrobeItem w) -> w.getPrice() == null ? BigDecimal.ZERO : w.getPrice()).reversed();
            default -> Comparator.comparing(WardrobeItem::getCreatedAt).reversed();
        };
    }

    private static Comparator<WardrobeItem> nullsLast(Function<WardrobeItem, BigDecimal> key, boolean desc) {
        Comparator<BigDecimal> cmp = desc ? Comparator.<BigDecimal>reverseOrder() : Comparator.<BigDecimal>naturalOrder();
        return Comparator.comparing(key, Comparator.nullsLast(cmp));
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static boolean contains(String hay, String needle) {
        return hay != null && needle != null && hay.toLowerCase(Locale.ROOT).contains(needle.toLowerCase(Locale.ROOT));
    }
}

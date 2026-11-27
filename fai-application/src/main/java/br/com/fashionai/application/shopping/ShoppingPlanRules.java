package br.com.fashionai.application.shopping;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.WardrobeItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Regras puras do RF-PESQ-09: lacunas por ocasião (cima, baixo, calçado; peça inteira cobre cima e baixo), peças
 * existentes que um candidato complementa e preço confirmado (valor, moeda pedida e data da consulta) para entrar no
 * somatório garantido. Só o guarda-roupa da própria pessoa entra como evidência.
 */
public final class ShoppingPlanRules {
    private ShoppingPlanRules() {
    }

    public static final List<String> SLOTS = List.of("upper_piece", "lower_piece", "shoes_piece");

    public record Gap(String occasion, String slot) { }
    public record Coverage(Map<String, Set<String>> coveredBy, List<Gap> gaps) { }
    public record Price(BigDecimal amount, String currency, String source, Instant checkedAt, boolean confirmed) { }

    static Set<String> occasionsOf(WardrobeItem w) {
        Set<String> out = new LinkedHashSet<>();
        for (String tag : Json.csv(w.getOccasionTags())) out.add(tag.trim().toLowerCase(Locale.ROOT));
        return out;
    }

    /** Para cada ocasião, quais slots já têm peça própria disponível e etiquetada com a ocasião. */
    public static Coverage coverage(List<WardrobeItem> wardrobe, List<String> occasions, Set<String> excludedCategories) {
        Map<String, Set<String>> covered = new LinkedHashMap<>();
        List<Gap> gaps = new ArrayList<>();
        for (String occasion : occasions) {
            Set<String> slots = new LinkedHashSet<>();
            for (WardrobeItem w : wardrobe) {
                if (!occasionsOf(w).contains(occasion)) continue;
                if ("full_body_piece".equals(w.getCategory())) { slots.add("upper_piece"); slots.add("lower_piece"); }
                else if (SLOTS.contains(w.getCategory())) slots.add(w.getCategory());
            }
            covered.put(occasion, slots);
            for (String slot : SLOTS) if (!slots.contains(slot) && !excludedCategories.contains(slot)) gaps.add(new Gap(occasion, slot));
        }
        return new Coverage(covered, List.copyOf(gaps));
    }

    /** Peças próprias, em outros slots, etiquetadas com as ocasiões cobertas pelo candidato (CA1). */
    public static List<WardrobeItem> complements(List<WardrobeItem> wardrobe, String slot, Set<String> occasions) {
        List<WardrobeItem> out = new ArrayList<>();
        for (WardrobeItem w : wardrobe) {
            if (slot.equals(w.getCategory())) continue;
            Set<String> tags = occasionsOf(w);
            if (occasions.stream().anyMatch(tags::contains)) out.add(w);
        }
        return out;
    }

    /** Preço confirmado: valor de lista (ou mínimo), moeda igual à pedida e data da consulta registrada (CA2). */
    public static Price priceOf(CatalogProduct p, String currency) {
        BigDecimal amount = p.getListPrice() != null ? p.getListPrice() : p.getPriceMin();
        boolean confirmed = amount != null && amount.signum() > 0 && currency.equalsIgnoreCase(p.getPriceCurrency() == null ? "" : p.getPriceCurrency()) && p.getPriceCheckedAt() != null;
        String source = p.getPriceSource() != null ? p.getPriceSource() : p.getSourceDomain();
        return new Price(amount, p.getPriceCurrency(), source, p.getPriceCheckedAt(), confirmed);
    }

    /** Ocasiões em lacuna que uma categoria de produto cobre. */
    public static Set<String> coveredOccasions(List<Gap> gaps, String category) {
        Set<String> out = new LinkedHashSet<>();
        for (Gap g : gaps) if (g.slot().equals(category)) out.add(g.occasion());
        return out;
    }

    public static boolean dismissed(Map<UUID, String> dismissals, UUID productId) {
        return dismissals.containsKey(productId);
    }
}

package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Context;
import br.com.fashionai.application.flair.CbcRules.RequirementResult;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.REDISCOVERY_DAYS;
import static br.com.fashionai.application.flair.CbcRules.colorsMatch;
import static br.com.fashionai.application.flair.CbcRules.idleDays;
import static br.com.fashionai.application.flair.CbcRules.intOf;
import static br.com.fashionai.application.flair.CbcRules.intersects;
import static br.com.fashionai.application.flair.CbcRules.norm;
import static br.com.fashionai.application.flair.CbcRules.strings;
import static br.com.fashionai.application.flair.CbcRules.themeAny;

/**
 * Requisitos que olham as tags da carta: marca, tag, tags distintas, tema, Hype (nota e faixa), origem, "sem compras" e
 * redescoberta. {@code n} = vagas não opcionais. Devolve {@code null} quando o tipo não é deste grupo.
 */
final class CbcRequirementsTags {
    private CbcRequirementsTags() {
    }

    static RequirementResult evaluate(String type, Map<String, Object> r, List<Card> cards, Context ctx, int n, Map<String, Object> args) {
        switch (type) {
            case "brand" -> {
                // marca específica ("3 cartas da Norte"): quando o desafio é de uma marca, o nome vem do perfil dela
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.brand() != null && wanted.contains(c.brand().trim().toLowerCase(Locale.ROOT))).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "sameBrand" -> {
                int need = intOf(r.get("count"), 2);
                Map<String, Integer> byBrand = new HashMap<>();
                cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .forEach(b -> byBrand.merge(b.trim().toLowerCase(Locale.ROOT), 1, Integer::sum));
                int have = byBrand.values().stream().max(Integer::compare).orElse(0);
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "distinctBrands" -> {
                int need = intOf(r.get("count"), 2);
                int have = (int) cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .map(b -> b.trim().toLowerCase(Locale.ROOT)).distinct().count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "tag" -> {
                String field = String.valueOf(r.getOrDefault("field", "style"));
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> tagMatch(c, field, wanted)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "distinctTags" -> {
                String field = String.valueOf(r.getOrDefault("field", "style"));
                int need = intOf(r.get("count"), 2);
                int have = (int) cards.stream().flatMap(c -> distinctValues(c, field).stream()).distinct().count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "theme" -> {
                // P1: qualquer interpretação do Momento (ou as tags do desafio) vale — nunca só a escolhida
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> themeAny(c, ctx)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "hype" -> {
                String dim = String.valueOf(r.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT);
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.hype().get(dim) != null && c.hype().get(dim) >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "hypeBand" -> {
                return hypeBand(type, r, cards, args);
            }
            case "origin" -> {
                String only = String.valueOf(r.getOrDefault("only", "PIECE")).toUpperCase(Locale.ROOT);
                int have = (int) cards.stream().filter(c -> only.equals(c.originType())).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "noBuy" -> {
                // C2: a peça já estava no guarda-roupa antes do início (sem início, basta a peça existir)
                int have = (int) cards.stream().filter(c -> c.pieceAddedAt() != null
                        && (ctx.startAt() == null || c.pieceAddedAt().isBefore(ctx.startAt()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "rediscovery" -> {
                int days = intOf(r.get("idleDays"), REDISCOVERY_DAYS);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> idleDays(c, ctx.today()) >= days).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            default -> {
                return null;
            }
        }
    }

    /**
     * Faixa de Hype: sem {@code scope}, pelo menos {@code count} cartas (padrão 1) com faixa ≥ {@code min}; {@code scope=all},
     * todas as colocadas (mesa vazia reprova); {@code scope=positions}, só as cartas nas posições listadas, {@code count}
     * padrão = nº de posições.
     */
    private static RequirementResult hypeBand(String type, Map<String, Object> r, List<Card> cards, Map<String, Object> args) {
        GlassHype.Band min = GlassHype.parse(r.get("min"), GlassHype.Band.LOW_SIGNAL);
        String scope = r.get("scope") == null ? null : String.valueOf(r.get("scope")).toLowerCase(Locale.ROOT);
        List<Card> subset = cards;
        int need = intOf(r.get("count"), 1);
        if ("positions".equals(scope)) {
            Set<String> positions = Set.copyOf(strings(r.get("positions")).stream().map(p -> p.toUpperCase(Locale.ROOT)).toList());
            subset = cards.stream().filter(c -> positions.contains(c.position())).toList();
            need = intOf(r.get("count"), positions.size());
        }
        int have = (int) subset.stream().filter(c -> GlassHype.bandOf(c).compareTo(min) >= 0).count();
        if ("all".equals(scope)) {
            return new RequirementResult(type, !cards.isEmpty() && have == cards.size(), have, cards.size(), args);
        }
        return new RequirementResult(type, have >= need, have, need, args);
    }

    static boolean tagMatch(Card c, String field, Set<String> wanted) {
        return switch (field) {
            case "color" -> colorsMatch(c.colors(), wanted);
            case "occasion" -> intersects(c.occasions(), wanted);
            case "material" -> intersects(c.materials(), wanted);
            default -> intersects(c.styles(), wanted);
        };
    }

    /** Valores da tag para contar "distintos": cores viram a família da taxonomia (carmim e vermelho = uma só). */
    static Set<String> distinctValues(Card c, String field) {
        return switch (field) {
            case "color" -> Set.copyOf(c.colors().stream().map(CbcRequirementsTags::colorFamily).toList());
            case "occasion" -> c.occasions();
            case "material" -> c.materials();
            default -> c.styles();
        };
    }

    /** Família da cor na taxonomia; sem família ou "Especiais" (estampa, multicolor) a própria cor conta como um valor. */
    static String colorFamily(String color) {
        String family = Taxonomy.COLOR_FAMILY.get(color);
        return family == null || "Especiais".equals(family) ? color : family;
    }
}

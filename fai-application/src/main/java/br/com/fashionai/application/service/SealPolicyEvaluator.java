package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.application.service.SealPolicies.HypeCriteria;
import br.com.fashionai.application.service.SealPolicies.HypeFact;
import br.com.fashionai.application.service.SealPolicies.HypeLookup;
import br.com.fashionai.application.service.SealPolicies.Policy;
import br.com.fashionai.application.service.SealPolicies.Rule;
import br.com.fashionai.application.service.SealPolicies.Verdict;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.SealPolicyText.describe;
import static br.com.fashionai.application.service.SealPolicyText.describeHype;
import static br.com.fashionai.application.service.SealPolicyText.describeTags;
import static br.com.fashionai.application.service.SealPolicyText.why;

/**
 * RF25/RF53 — avaliação da política contra as peças de um look (tier LOOK) ou uma peça (tier PECA): modelo de
 * referência, selos conquistados, critério de Hype, regras com quantificador e tags. Extraído de {@link SealPolicies} (R80).
 */
final class SealPolicyEvaluator {
    private SealPolicyEvaluator() {
    }

    static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles,
                                   HypeLookup hype, Map<String, Object> background) {
        HypeLookup h = hype == null ? HypeLookup.NONE : hype;
        if (p == null || pieces.isEmpty()) {
            return new Verdict(false, List.of(), null);
        }
        if (!overlaps(p.occasions(), occasions) || !overlaps(p.styles(), styles)) {
            return new Verdict(false, List.of(), null);
        }
        Verdict reference = null;
        if (p.referenceModel() != null) {
            // Novas políticas são estritas: tags ausentes não podem aprovar um modelo que as exige.
            if ((!p.occasions().isEmpty() && (occasions == null || occasions.isEmpty()))
                    || (!p.styles().isEmpty() && (styles == null || styles.isEmpty()))) return new Verdict(false, List.of(), null);
            reference = SealReferenceModels.evaluate(p.referenceModel(), tier, pieces, background);
            if (!reference.matched()) return reference;
        }
        if (p.referenceModel() != null && p.referenceModel().get("earnedSeals") instanceof Map<?, ?> earned) {
            List<UUID> ids = pieces.stream().map(WardrobeItem::getId).filter(Objects::nonNull).toList();
            List<?> rules = (List<?>) earned.get("rules");
            long hits = rules.stream().filter(item -> {
                Map<?, ?> r = (Map<?, ?>) item;
                return h.earnedSealCount(UUID.fromString((String) r.get("sealId")), (String) r.get("scope"), ids)
                        >= ((Number) r.get("minCount")).longValue();
            }).count();
            if ("ANY".equals(earned.get("match")) ? hits == 0 : hits != rules.size()) return new Verdict(false, List.of(), null);
        }
        String hypeWhy = null;
        if (p.hype() != null) {
            HypeFact fact = null;
            if (tier == SealTier.PECA) {
                for (WardrobeItem w : pieces) {                // cada peça é a entidade avaliada
                    HypeFact f = h.piece(w.getId());
                    if (!meets(p.hype(), f)) {
                        return new Verdict(false, List.of(), null);
                    }
                    fact = fact == null || f.score() < fact.score() ? f : fact;   // o "porquê" mostra o menor Hype
                }
            } else {
                fact = h.look();
                if (!meets(p.hype(), fact)) {
                    return new Verdict(false, List.of(), null);
                }
            }
            hypeWhy = describeHype(p.hype(), tier) + " " + Msg.t("sealPolicy.hype.atual", Math.round(fact.score()));
        }
        if (p.rules().isEmpty()) {
            return new Verdict(true, reference == null ? pieces.stream().map(WardrobeItem::getId).toList() : reference.pieceIds(),
                    why(p.referenceModel() == null ? null : String.valueOf(p.referenceModel().get("description")), hypeWhy, describeTags(p)));
        }
        Set<UUID> support = new LinkedHashSet<>();
        List<String> hits = new ArrayList<>();
        int ok = 0;
        for (Rule r : p.rules()) {
            List<WardrobeItem> pass = pieces.stream().filter(w -> passes(r, w, h)).toList();
            boolean holds;
            if (tier == SealTier.PECA) {
                holds = "NONE".equals(r.quantifier()) ? pass.isEmpty() : pass.size() == pieces.size();
            } else {
                holds = switch (r.quantifier()) {
                    case "ALL" -> pass.size() == pieces.size();
                    case "NONE" -> pass.isEmpty();
                    default -> pass.size() >= r.count();
                };
            }
            if (holds) {
                ok++;
                pass.forEach(w -> support.add(w.getId()));
                hits.add(describe(r, tier));
            }
        }
        boolean matched = p.any() ? ok > 0 : ok == p.rules().size();
        if (!matched) {
            return new Verdict(false, List.of(), null);
        }
        List<UUID> ids = support.isEmpty() ? pieces.stream().map(WardrobeItem::getId).toList() : List.copyOf(support);
        return new Verdict(true, ids, why(String.join("; ", hits), hypeWhy, null));
    }

    /**
     * RF53 — o fato de Hype atende ao critério? Sem Hype disponível (não calculado, dados insuficientes) → não.
     * Nível compara a faixa; score compara o número exibido (arredondado), como a faixa.
     */
    static boolean meets(HypeCriteria c, HypeFact f) {
        if (c == null) {
            return true;
        }
        if (f == null || !f.available() || f.score() == null) {
            return false;
        }
        if (c.minLevel() != null && (f.level() == null || f.level().ordinal() < c.minLevel().ordinal())) {
            return false;
        }
        if (c.minScore() != null && Math.round(f.score()) < c.minScore()) {
            return false;
        }
        if (c.dimensionMins() != null && c.dimensionMins().entrySet().stream().anyMatch(entry ->
                f.dimensions() == null || f.dimensions().get(entry.getKey()) == null || f.dimensions().get(entry.getKey()) < entry.getValue())) return false;
        return c.momentum() == null || c.momentum().isEmpty() || (f.momentum() != null && c.momentum().contains(f.momentum()));
    }

    static boolean passes(Rule r, WardrobeItem w) {
        return passes(r, w, HypeLookup.NONE);
    }

    static boolean passes(Rule r, WardrobeItem w, HypeLookup hype) {
        if (r.hypeMin() != null) {
            HypeFact f = hype == null ? null : hype.piece(w.getId());
            if (f == null || !f.available() || f.level() == null || f.level().ordinal() < r.hypeMin().ordinal()) {
                return false;
            }
        }
        if (r.color() != null && !colorMatches(r.color(), w.getColor())) {
            return false;
        }
        if (r.category() != null && !r.category().equalsIgnoreCase(String.valueOf(w.getCategory()))) {
            return false;
        }
        if (r.subcategory() != null && !r.subcategory().equalsIgnoreCase(String.valueOf(w.getSubcategory()))) {
            return false;
        }
        if (r.brand() != null) {
            String brand = w.getBrandName() != null ? w.getBrandName()
                    : w.getBrand() != null ? w.getBrand().getName()
                    : w.getBrandProfile() != null ? w.getBrandProfile().getBrandName() : null;
            if (brand == null || LocalAdvisors.jaroWinkler(LocalAdvisors.normalize(r.brand()), LocalAdvisors.normalize(brand)) < 0.92) {
                return false;
            }
        }
        return true;
    }

    /** "Azul" casa com navy/denim/cobalt…; "navy" só com navy. */
    static boolean colorMatches(String wanted, String color) {
        if (color == null) {
            return false;
        }
        String c = color.toLowerCase(Locale.ROOT).trim();
        if (wanted.equalsIgnoreCase(c)) {
            return true;
        }
        String family = Taxonomy.COLOR_FAMILY.get(c);
        return family != null && family.equalsIgnoreCase(wanted);
    }

    static boolean overlaps(List<String> wanted, Collection<String> have) {
        if (wanted.isEmpty() || have == null || have.isEmpty()) {
            return true;
        }
        for (String h : have) {
            if (wanted.contains(h.toLowerCase(Locale.ROOT).trim())) {
                return true;
            }
        }
        return false;
    }
}

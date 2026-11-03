package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF34 §3–§4 — regras puras do cálculo: peça viva/disponível, entropia, sobreposição de intervalos, cosseno, família de
 * cor, chave de par e de combinação (DET-G01), distribuição, porcentagem, último uso e dias sem uso.
 */
final class InventoryScoreRules {
    private InventoryScoreRules() {
    }

    static boolean alive(WardrobeItem w) {
        return w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED;
    }

    static boolean available(WardrobeItem w) {
        return w.isDisponivel() && w.getAvailabilityStatus() == AvailabilityStatus.AVAILABLE;
    }

    static double entropy(Collection<String> values, int m) {
        if (values.isEmpty() || m <= 1) {
            return 0;
        }
        Map<String, Long> counts = values.stream().collect(Collectors.groupingBy(v -> v, Collectors.counting()));
        double n = values.size();
        double h = 0;
        for (long c : counts.values()) {
            double f = c / n;
            h -= f * Math.log(f);
        }
        return Math.max(0, Math.min(1, h / Math.log(m)));
    }

    static long overlap(Instant a, Instant b, Instant start, Instant end) {
        Instant s = a.isAfter(start) ? a : start;
        Instant e = b.isBefore(end) ? b : end;
        return e.isAfter(s) ? Duration.between(s, e).getSeconds() : 0;
    }

    static double cosine(Map<String, Double> a, Map<String, Double> b) {
        double dot = 0, na = 0, nb = 0;
        for (Map.Entry<String, Double> e : a.entrySet()) {
            dot += e.getValue() * b.getOrDefault(e.getKey(), 0.0);
            na += e.getValue() * e.getValue();
        }
        for (double v : b.values()) {
            nb += v * v;
        }
        return na == 0 || nb == 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    static String family(String color) {
        if (color == null) {
            return null;
        }
        String f = Taxonomy.COLOR_FAMILY.get(color);
        if (f != null) {
            return f;
        }
        if (color.startsWith("#")) {
            try {
                return Taxonomy.COLOR_FAMILY.get(ColorMath.nearestTaxonomyColor(ColorMath.parseHex(color)));
            } catch (RuntimeException ex) {
                return null;
            }
        }
        return null;
    }

    static String pairKey(UUID a, UUID b) {
        return a.compareTo(b) < 0 ? a + "|" + b : b + "|" + a;
    }

    /** Chave da combinação (upper+lower+shoes ou dress+shoes) formada pelas peças de um esquema — DET-G01. */
    static String comboKeyOf(List<UUID> ids, Map<UUID, WardrobeItem> byId) {
        UUID upper = null, lower = null, shoes = null, dress = null;
        for (UUID id : ids) {
            WardrobeItem w = byId.get(id);
            if (w == null) {
                continue;
            }
            switch (String.valueOf(w.getCategory())) {
                case "upper_piece" -> upper = upper == null ? id : upper;
                case "lower_piece" -> lower = lower == null ? id : lower;
                case "shoes_piece" -> shoes = shoes == null ? id : shoes;
                case "full_body_piece" -> dress = dress == null ? id : dress;
                default -> {
                }
            }
        }
        if (shoes == null) {
            return null;
        }
        if (dress != null) {
            return SchemeService.combinationKey(List.of(dress, shoes));
        }
        return upper != null && lower != null ? SchemeService.combinationKey(List.of(upper, lower, shoes)) : null;
    }

    static Map<String, Double> distribution(List<String> values) {
        Map<String, Double> out = new HashMap<>();
        if (values.isEmpty()) {
            return out;
        }
        values.forEach(v -> out.merge(v, 1.0 / values.size(), Double::sum));
        return out;
    }

    static String pct(double v) {
        return Math.round(v * 100) + "%";
    }

    static LocalDate lastUse(WardrobeItem w, Map<UUID, TreeSet<LocalDate>> usage) {
        TreeSet<LocalDate> u = usage.get(w.getId());
        LocalDate d = u == null || u.isEmpty() ? null : u.last();
        LocalDate worn = w.getLastWornDate();
        if (d == null) {
            return worn;
        }
        return worn == null || d.isAfter(worn) ? d : worn;
    }

    static long daysSince(WardrobeItem w, Map<UUID, TreeSet<LocalDate>> usage, LocalDate today) {
        LocalDate last = lastUse(w, usage);
        LocalDate ref = last != null ? last : w.getCreatedAt() == null ? today : LocalDate.ofInstant(w.getCreatedAt(), FaiPointsService.ZONE);
        return ChronoUnit.DAYS.between(ref, today);
    }
}

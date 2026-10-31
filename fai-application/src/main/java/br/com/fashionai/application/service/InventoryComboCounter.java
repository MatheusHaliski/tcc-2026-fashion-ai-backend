package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Contagem pura das combinações válidas do Inventory Score (02-inventory-score-calculo.md §3.4 e §7), extraída de
 * {@link InventoryScoreService} sem alterar regra: (upper + lower + shoes) ou (full_body + shoes) com ≥ 1 ocasião em
 * comum; enumeração exata até 400.000 de trabalho e, acima disso, limite inferior por ocasião. Sem Spring, repositório
 * nem relógio — a entrada é a lista de peças e a saída depende só dela.
 */
final class InventoryComboCounter {
    /** Grupos de ocasião de referência da cobertura (§3.2). */
    static final Map<String, List<String>> OCCASION_GROUPS = new LinkedHashMap<>();
    static final long ENUMERATION_LIMIT = 400_000;

    static {
        OCCASION_GROUPS.put("faculdade/trabalho", List.of("university", "school", "work", "business"));
        OCCASION_GROUPS.put("casual", List.of("casual", "home", "travel", "outdoor", "vacation"));
        OCCASION_GROUPS.put("social", List.of("social", "formal", "wedding", "ceremony", "date"));
        OCCASION_GROUPS.put("esporte", List.of("sport", "gym"));
        OCCASION_GROUPS.put("festa", List.of("party", "night_out", "festival"));
    }

    /** Combinações válidas (§3.4) sobre A: (upper+lower+shoes) ou (dress+shoes) com ≥ 1 ocasião em comum. */
    record Combos(Map<UUID, Integer> perPiece, long total, Map<String, Boolean> coverage, List<List<UUID>> sample, boolean enumerated) {
    }

    private InventoryComboCounter() {
    }

    static Set<String> occ(WardrobeItem w) {
        return new HashSet<>(Json.csv(w.getOccasionTags()));
    }

    static Set<String> shared(WardrobeItem a, WardrobeItem b, WardrobeItem c) {
        Set<String> s = occ(a);
        s.retainAll(occ(b));
        if (c != null) {
            s.retainAll(occ(c));
        }
        return s;
    }

    static boolean shareOccasion(WardrobeItem a, WardrobeItem b, WardrobeItem c) {
        return !shared(a, b, c).isEmpty();
    }

    static Combos count(List<WardrobeItem> a, int sampleLimit, Set<String> discoveredKeys) {
        List<WardrobeItem> uppers = a.stream().filter(w -> "upper_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> lowers = a.stream().filter(w -> "lower_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> shoes = a.stream().filter(w -> "shoes_piece".equals(w.getCategory())).toList();
        List<WardrobeItem> dresses = a.stream().filter(w -> "full_body_piece".equals(w.getCategory())).toList();
        Map<UUID, Integer> per = new HashMap<>();
        a.forEach(w -> per.put(w.getId(), 0));
        Map<String, Boolean> coverage = new LinkedHashMap<>();
        OCCASION_GROUPS.keySet().forEach(g -> coverage.put(g, false));
        List<List<UUID>> sample = new ArrayList<>();
        long work = (long) uppers.size() * lowers.size() * shoes.size() + (long) dresses.size() * shoes.size();
        boolean enumerate = work <= ENUMERATION_LIMIT;
        long total = enumerate
                ? enumerate(uppers, lowers, shoes, dresses, per, coverage, sample, sampleLimit, discoveredKeys)
                : lowerBoundByOccasion(uppers, lowers, shoes, dresses, per, coverage);
        return new Combos(per, total, coverage, sample, enumerate);
    }

    /** Enumeração exata; a amostra guarda, na ordem de descoberta, combinações ainda não salvas como look. */
    private static long enumerate(List<WardrobeItem> uppers, List<WardrobeItem> lowers, List<WardrobeItem> shoes,
                                  List<WardrobeItem> dresses, Map<UUID, Integer> per, Map<String, Boolean> coverage,
                                  List<List<UUID>> sample, int sampleLimit, Set<String> discoveredKeys) {
        long total = 0;
        for (WardrobeItem u : uppers) {
            for (WardrobeItem l : lowers) {
                if (!shareOccasion(u, l, null)) {
                    continue;
                }
                for (WardrobeItem s : shoes) {
                    Set<String> sh = shared(u, l, s);
                    if (sh.isEmpty()) {
                        continue;
                    }
                    total++;
                    per.merge(u.getId(), 1, Integer::sum);
                    per.merge(l.getId(), 1, Integer::sum);
                    per.merge(s.getId(), 1, Integer::sum);
                    markCoverage(coverage, sh);
                    sampleIfUndiscovered(sample, sampleLimit, discoveredKeys, List.of(u.getId(), l.getId(), s.getId()));
                }
            }
        }
        for (WardrobeItem d : dresses) {
            for (WardrobeItem s : shoes) {
                Set<String> sh = shared(d, s, null);
                if (sh.isEmpty()) {
                    continue;
                }
                total++;
                per.merge(d.getId(), 1, Integer::sum);
                per.merge(s.getId(), 1, Integer::sum);
                markCoverage(coverage, sh);
                sampleIfUndiscovered(sample, sampleLimit, discoveredKeys, List.of(d.getId(), s.getId()));
            }
        }
        return total;
    }

    private static void sampleIfUndiscovered(List<List<UUID>> sample, int sampleLimit, Set<String> discoveredKeys, List<UUID> ids) {
        if (sample.size() < sampleLimit && discoveredKeys != null && !discoveredKeys.contains(SchemeService.combinationKey(ids))) {
            sample.add(ids);
        }
    }

    /** §7 — contagem por grupos de ocasião (limite inferior por peça: maior grupo em que ela participa). */
    private static long lowerBoundByOccasion(List<WardrobeItem> uppers, List<WardrobeItem> lowers, List<WardrobeItem> shoes,
                                             List<WardrobeItem> dresses, Map<UUID, Integer> per, Map<String, Boolean> coverage) {
        long total = 0;
        for (String o : Taxonomy.OCCASIONS) {
            List<WardrobeItem> uo = uppers.stream().filter(w -> occ(w).contains(o)).toList();
            List<WardrobeItem> lo = lowers.stream().filter(w -> occ(w).contains(o)).toList();
            List<WardrobeItem> so = shoes.stream().filter(w -> occ(w).contains(o)).toList();
            List<WardrobeItem> dO = dresses.stream().filter(w -> occ(w).contains(o)).toList();
            long t = (long) uo.size() * lo.size() * so.size() + (long) dO.size() * so.size();
            if (t > 0) {
                markCoverage(coverage, Set.of(o));
            }
            total = Math.max(total, t);
            for (WardrobeItem u : uo) {
                per.merge(u.getId(), lo.size() * so.size(), Math::max);
            }
            for (WardrobeItem l : lo) {
                per.merge(l.getId(), uo.size() * so.size(), Math::max);
            }
            for (WardrobeItem s : so) {
                per.merge(s.getId(), uo.size() * lo.size() + dO.size(), Math::max);
            }
            for (WardrobeItem d : dO) {
                per.merge(d.getId(), so.size(), Math::max);
            }
        }
        return total;
    }

    private static void markCoverage(Map<String, Boolean> coverage, Set<String> sharedOccasions) {
        OCCASION_GROUPS.forEach((g, codes) -> {
            if (!coverage.get(g) && codes.stream().anyMatch(sharedOccasions::contains)) {
                coverage.put(g, true);
            }
        });
    }
}

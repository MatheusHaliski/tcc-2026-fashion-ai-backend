package br.com.fashionai.application.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.WardrobeItem;

/**
 * Vista-me sem IA (e a lista curta que vai para a IA): monta o look por parte do corpo com as regras de cada ocasião e
 * humor (MirrorOccasionProfiles), do clima e do nível térmico. Puro. Extraído de MirrorService.localCompose, que pegava as 5 primeiras peças por
 * categoria só com bônus de ocasião: casaco virava a peça de cima no frio (o look ficava sem parte de cima), academia e
 * praia recebiam blazer e sapato social, e o humor não contava.
 * <ul>
 *   <li>peças que a ocasião exclui saem da parte (se não sobrar nenhuma, a parte usa todas, ordenadas);</li>
 *   <li>camada externa é parte própria: entra no frio, nunca no calor, e fora disso só quando combina muito;</li>
 *   <li>âncoras sempre entram; combinações já mostradas para o mesmo pedido são puladas.</li>
 * </ul>
 */
final class MirrorLookComposer {
    private MirrorLookComposer() {
    }

    static final int PER_PART = 6;

    static boolean cold(MirrorService.Interpretation it) {
        return it.constraints().contains("cold") || "WINTER".equals(it.season());
    }

    static boolean hot(MirrorService.Interpretation it) {
        return it.constraints().contains("hot") || "SUMMER".equals(it.season());
    }

    static boolean excluded(WardrobeItem w, MirrorService.Interpretation it) {
        String sub = sub(w);
        return it.occasion().stream().map(MirrorOccasionProfiles.PROFILES::get).anyMatch(p -> p != null && p.exclude().contains(sub))
                || hot(it) && Set.of("coat", "parka", "gloves", "beanie", "scarf").contains(sub);
    }

    static double score(WardrobeItem w, MirrorService.Interpretation it) {
        String sub = sub(w);
        List<String> occ = Json.csv(w.getOccasionTags());
        List<String> styles = MirrorOccasionProfiles.moodStyles(it.mood());
        double s = 2 * it.occasion().stream().filter(occ::contains).count();
        boolean specific = it.occasion().stream().anyMatch(o -> !Set.of("casual", "outdoor").contains(o));
        if (specific && !occ.isEmpty() && it.occasion().stream().noneMatch(occ::contains)) {
            s -= 1.5;                                        // a peça diz para que serve, e não é para isso
        }
        for (String o : it.occasion()) {
            MirrorOccasionProfiles.Profile p = MirrorOccasionProfiles.PROFILES.get(o);
            if (p != null && p.prefer().contains(sub)) {
                s += p.bonus();
            }
        }
        s += 1.5 * styles.stream().filter(Json.csv(w.getStyleTags())::contains).count();
        if (cold(it)) {
            s += MirrorOccasionProfiles.COLD.contains(sub) ? 1.5 : MirrorOccasionProfiles.WARM.contains(sub) ? -2 : 0;
        }
        if (hot(it)) {
            s += MirrorOccasionProfiles.WARM.contains(sub) ? 1.5 : MirrorOccasionProfiles.COLD.contains(sub) ? -3 : 0;
        }
        if (it.nivelTermico() != null) {
            s += MirrorThermalFit.of(it.nivelTermico(), List.of(w)).score();
        }
        return s + (w.isFavorite() ? 0.3 : 0);
    }

    /** As melhores peças de cada parte (sem as excluídas pela ocasião, se sobrar alguma) — também a lista que vai para a IA. */
    static Map<String, List<WardrobeItem>> parts(MirrorService.Interpretation it, List<WardrobeItem> eligible, int perPart) {
        Map<String, List<WardrobeItem>> all = new LinkedHashMap<>();
        for (WardrobeItem w : eligible) {
            all.computeIfAbsent(MirrorService.slotOf(w), k -> new ArrayList<>()).add(w);
        }
        Map<String, List<WardrobeItem>> out = new LinkedHashMap<>();
        all.forEach((slot, list) -> {
            List<WardrobeItem> kept = list.stream().filter(w -> !excluded(w, it)).toList();
            List<WardrobeItem> pool = new ArrayList<>(kept.isEmpty() && !slot.equals("outer_layer") ? list : kept);
            pool.sort(Comparator.comparingDouble((WardrobeItem w) -> score(w, it)).reversed());
            List<WardrobeItem> top = new ArrayList<>(pool.subList(0, Math.min(perPart, pool.size())));
            list.stream().filter(w -> it.anchors().contains(w.getId()) && !top.contains(w)).forEach(top::add);
            out.put(slot, top);
        });
        return out;
    }

    /** A lista curta para a IA: as melhores de cada parte e as âncoras (em vez do acervo inteiro). */
    static List<WardrobeItem> shortlist(MirrorService.Interpretation it, List<WardrobeItem> eligible, int perPart) {
        return parts(it, eligible, perPart).values().stream().flatMap(List::stream).toList();
    }

    static List<WardrobeItem> compose(MirrorService.Interpretation it, List<WardrobeItem> eligible, Set<String> shown) {
        Map<String, List<WardrobeItem>> parts = parts(it, eligible, PER_PART);
        Map<String, List<WardrobeItem>> anchored = new LinkedHashMap<>();
        eligible.stream().filter(w -> it.anchors().contains(w.getId()))
                .forEach(w -> anchored.computeIfAbsent(MirrorService.slotOf(w), k -> new ArrayList<>()).add(w));
        List<WardrobeItem> tops = pick(parts, anchored, "upper");
        List<WardrobeItem> bottoms = pick(parts, anchored, "lower");
        List<WardrobeItem> dresses = pick(parts, anchored, "dress");
        List<WardrobeItem> shoes = pick(parts, anchored, "shoes");
        List<List<WardrobeItem>> bases = new ArrayList<>();
        boolean dressAnchored = anchored.containsKey("dress");
        boolean separatesAnchored = anchored.containsKey("upper") || anchored.containsKey("lower");
        if (!dressAnchored) {
            for (WardrobeItem t : tops) {
                for (WardrobeItem b : bottoms) {
                    bases.addAll(withShoes(List.of(t, b), shoes));
                }
            }
        }
        if (!separatesAnchored) {
            for (WardrobeItem d : dresses) {
                bases.addAll(withShoes(List.of(d), shoes));
            }
        }
        bases.sort(Comparator.comparingDouble((List<WardrobeItem> b) -> b.stream().mapToDouble(w -> score(w, it)).sum()).reversed());
        for (List<WardrobeItem> base : bases) {
            List<WardrobeItem> look = new ArrayList<>(base);
            outer(it, parts, anchored).ifPresent(look::add);
            look.addAll(accessories(it, parts, anchored));
            if (!shown.contains(MirrorService.key(look.stream().map(WardrobeItem::getId).toList()))) {
                return look;
            }
        }
        return List.of();
    }

    private static List<WardrobeItem> pick(Map<String, List<WardrobeItem>> parts, Map<String, List<WardrobeItem>> anchored, String slot) {
        return anchored.containsKey(slot) ? anchored.get(slot).subList(0, 1) : parts.getOrDefault(slot, List.of());
    }

    private static List<List<WardrobeItem>> withShoes(List<WardrobeItem> base, List<WardrobeItem> shoes) {
        if (shoes.isEmpty()) {
            return List.of(base);
        }
        return shoes.stream().map(s -> {
            List<WardrobeItem> l = new ArrayList<>(base);
            l.add(s);
            return l;
        }).toList();
    }

    private static java.util.Optional<WardrobeItem> outer(MirrorService.Interpretation it, Map<String, List<WardrobeItem>> parts,
                                                          Map<String, List<WardrobeItem>> anchored) {
        if (anchored.containsKey("outer_layer")) {
            return java.util.Optional.of(anchored.get("outer_layer").get(0));
        }
        List<WardrobeItem> outers = parts.getOrDefault("outer_layer", List.of());
        if (outers.isEmpty() || hot(it)) {
            return java.util.Optional.empty();
        }
        WardrobeItem best = outers.get(0);
        return cold(it) || score(best, it) >= 3 ? java.util.Optional.of(best) : java.util.Optional.empty();
    }

    private static List<WardrobeItem> accessories(MirrorService.Interpretation it, Map<String, List<WardrobeItem>> parts,
                                                  Map<String, List<WardrobeItem>> anchored) {
        List<WardrobeItem> out = new ArrayList<>(anchored.getOrDefault("accessory", List.of()));
        Set<String> subs = new HashSet<>(out.stream().map(MirrorLookComposer::sub).toList());
        for (WardrobeItem a : parts.getOrDefault("accessory", List.of())) {
            if (out.size() >= 2) {
                break;
            }
            if (!out.contains(a) && score(a, it) > 0 && subs.add(sub(a))) {
                out.add(a);
            }
        }
        return out;
    }

    private static String sub(WardrobeItem w) {
        return w.getSubcategory() == null ? "" : w.getSubcategory();
    }
}

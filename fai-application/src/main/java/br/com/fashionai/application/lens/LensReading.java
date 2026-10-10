package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.DoubleFunction;

/**
 * RF54 · Leitura do look (§5.3 LensReading) a partir das peças lidas — composição de estilo, paleta, ocasiões, estação
 * provável — e o Hype do grupo de peças públicas parecidas (§10.1). Puro: sem repositório, sem IA.
 */
public final class LensReading {
    private LensReading() {
    }

    /** O que a leitura usa de cada peça detectada (área = fração da imagem coberta pela caixa, 0–1). */
    public record Piece(UUID id, String category, String subcategory, String material, List<String> styles,
                        List<String> occasions, List<LensViews.ColorShare> colors, double area) {
        public String mainColor() {
            return colors == null || colors.isEmpty() ? null : colors.get(0).name();
        }
    }

    /** Uma peça pública do grupo: as chaves de atributo dela, o score atual e a variação (nula sem base). */
    public record Member(Set<String> keys, double score, Double delta) {
    }

    /** Peças maiores pesam mais na leitura do look (uma jaqueta diz mais que um anel); peça sem caixa pesa o mínimo. */
    static double weight(Piece p) {
        return Math.max(0.02, p.area());
    }

    /** Composição de estilo em % (soma 100 quando há estilo; o resto da divisão vai para as maiores frações). */
    public static List<LensViews.StyleShare> styles(Collection<Piece> pieces) {
        Map<String, Double> acc = new LinkedHashMap<>();
        for (Piece p : pieces) {
            List<String> st = p.styles() == null ? List.of() : p.styles();
            for (String s : st) {
                acc.merge(s, weight(p) / st.size(), Double::sum);
            }
        }
        Map<String, Integer> shares = percentages(acc);
        List<LensViews.StyleShare> out = new ArrayList<>();
        shares.forEach((k, v) -> out.add(new LensViews.StyleShare(k, v)));
        return out;
    }

    /** Paleta do look: até 5 cores (códigos da paleta oficial), da mais presente para a menos. */
    public static List<LensViews.PaletteColor> palette(Collection<Piece> pieces) {
        Map<String, Double> acc = new LinkedHashMap<>();
        for (Piece p : pieces) {
            for (LensViews.ColorShare c : p.colors() == null ? List.<LensViews.ColorShare>of() : p.colors()) {
                acc.merge(c.name(), weight(p) * Math.max(0.05, c.share()), Double::sum);
            }
        }
        return acc.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(5)
                .map(e -> new LensViews.PaletteColor(e.getKey(), Taxonomy.COLORS.get(e.getKey()))).toList();
    }

    /** Ocasiões prováveis: até 3, pela presença ponderada nas peças. */
    public static List<String> occasions(Collection<Piece> pieces) {
        Map<String, Double> acc = new LinkedHashMap<>();
        for (Piece p : pieces) {
            for (String o : p.occasions() == null ? List.<String>of() : p.occasions()) {
                acc.merge(o, weight(p), Double::sum);
            }
        }
        return acc.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(3)
                .map(Map.Entry::getKey).toList();
    }

    static final Set<String> COLD = Set.of("coat", "parka", "sweater", "cardigan", "hoodie", "sweatshirt", "beanie",
            "gloves", "scarf", "long_boots", "ankle_boots", "combat_boots");
    static final Set<String> WARM = Set.of("tank_top", "crop_top", "shorts", "bermuda_shorts", "denim_shorts", "skort",
            "sandals", "flip_flops", "espadrilles");

    /** Estação provável (winter/summer) pelos tipos e materiais; sem maioria clara, nula (não inventa). */
    public static String season(Collection<Piece> pieces) {
        int cold = 0, warm = 0;
        for (Piece p : pieces) {
            String sub = p.subcategory() == null ? "" : p.subcategory();
            if (COLD.contains(sub) || "WOOL".equals(p.material())) {
                cold++;
            }
            if (WARM.contains(sub)) {
                warm++;
            }
        }
        return cold > warm ? "winter" : warm > cold ? "summer" : null;
    }

    // ------------------------------------------------------------------ Hype do grupo (§10.1)

    /**
     * Chaves da peça no formato do {@code HypeSnapshotService.attributeKeys} (cc: categoria×cor, cm: categoria×material,
     * st: categoria×estilo), na ordem de preferência da leitura: cor → estilo → material.
     */
    public static List<String> groupKeys(String category, String color, String material, Collection<String> styles) {
        List<String> keys = new ArrayList<>();
        if (category == null) {
            return keys;
        }
        if (color != null) {
            keys.add("cc:" + category + "|" + color);
        }
        if (styles != null) {
            styles.forEach(s -> keys.add("st:" + category + "|" + s));
        }
        if (material != null) {
            keys.add("cm:" + category + "|" + material);
        }
        return keys;
    }

    /**
     * Hype do grupo: a primeira chave (na ordem dada) com pelo menos {@link LensConfig#TREND_MIN_ITEMS} itens públicos
     * ganha a média dos scores, o nível e a direção (média das variações contra o limiar de estabilidade). Sem chave com
     * itens suficientes: INSUFFICIENT_DATA, com o maior grupo encontrado em {@code items} (nunca um score inventado).
     */
    public static LensViews.Trend trend(List<String> keys, Collection<Member> members, DoubleFunction<String> levelOf,
                                        double stablePoints) {
        int best = 0;
        for (String key : keys) {
            List<Member> group = members.stream().filter(m -> m.keys().contains(key)).toList();
            best = Math.max(best, group.size());
            if (group.size() < LensConfig.TREND_MIN_ITEMS) {
                continue;
            }
            double avg = group.stream().mapToDouble(Member::score).average().orElse(0);
            List<Double> deltas = group.stream().map(Member::delta).filter(d -> d != null).toList();
            String direction = null;
            if (!deltas.isEmpty()) {
                double d = deltas.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                direction = d > stablePoints ? "UP" : d < -stablePoints ? "DOWN" : "STABLE";
            }
            return new LensViews.Trend("AVAILABLE", key, groupLabel(key), (int) Math.round(avg), levelOf.apply(avg),
                    direction, group.size());
        }
        return new LensViews.Trend("INSUFFICIENT_DATA", null, null, null, null, null, best);
    }

    /** "Parte superior · Azul-claro" — o grupo dito em palavras, na língua de quem lê. */
    static String groupLabel(String key) {
        int colon = key.indexOf(':'), bar = key.indexOf('|');
        if (colon < 0 || bar < 0) {
            return key;
        }
        String category = key.substring(colon + 1, bar);
        String value = key.substring(bar + 1);
        String valueLabel = key.startsWith("cm:") ? Taxonomy.label(value.toLowerCase(Locale.ROOT)) : Taxonomy.label(value);
        return Msg.t("lens.grupo", Taxonomy.label(category), valueLabel);
    }

    // ------------------------------------------------------------------ Recriar

    /** Slot do plano para a categoria da peça (sem categoria, a peça não entra no plano). */
    public static String slotOf(String category) {
        if (category == null) {
            return null;
        }
        return switch (category) {
            case "upper_piece" -> "TOP";
            case "lower_piece" -> "BOTTOM";
            case "full_body_piece" -> "FULL";
            case "shoes_piece" -> "SHOES";
            case "accessory_piece" -> "ACCESSORY";
            default -> null;
        };
    }

    // ------------------------------------------------------------------ apoio

    /** Frações → inteiros que somam 100 (maior resto); ordem decrescente. */
    static Map<String, Integer> percentages(Map<String, Double> weights) {
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        Map<String, Integer> out = new LinkedHashMap<>();
        if (total <= 0) {
            return out;
        }
        List<Map.Entry<String, Double>> entries = new ArrayList<>(weights.entrySet());
        entries.sort(Map.Entry.<String, Double>comparingByValue().reversed());
        int assigned = 0;
        Map<String, Double> remainders = new LinkedHashMap<>();
        for (Map.Entry<String, Double> e : entries) {
            double exact = 100 * e.getValue() / total;
            int floor = (int) Math.floor(exact);
            out.put(e.getKey(), floor);
            remainders.put(e.getKey(), exact - floor);
            assigned += floor;
        }
        List<String> byRemainder = new ArrayList<>(remainders.keySet());
        byRemainder.sort(Comparator.comparingDouble((String k) -> remainders.get(k)).reversed());
        for (int i = 0; i < 100 - assigned && i < byRemainder.size(); i++) {
            out.merge(byRemainder.get(i), 1, Integer::sum);
        }
        Map<String, Integer> sorted = new LinkedHashMap<>();
        out.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .forEach(e -> sorted.put(e.getKey(), e.getValue()));
        return sorted;
    }

    /** Estilos, cores (com a família) e ocasiões do conjunto, para a compatibilidade com o DNA. */
    static Set<String> colorsWithFamily(Collection<Piece> pieces) {
        Set<String> out = new LinkedHashSet<>();
        for (Piece p : pieces) {
            for (LensViews.ColorShare c : p.colors() == null ? List.<LensViews.ColorShare>of() : p.colors()) {
                out.add(c.name());
                String family = Taxonomy.COLOR_FAMILY.get(c.name());
                if (family != null) {
                    out.add(family);
                }
            }
        }
        return out;
    }
}

package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.LookInput;
import br.com.fashionai.application.flair.FlairLooks.Synergy;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.flair.FlairLookColors.family;
import static br.com.fashionai.application.flair.FlairLooks.NEUTRAL_HYPE;
import static br.com.fashionai.application.flair.FlairLooks.STATS;

/**
 * Os 10 atributos do look no {@link FlairLooks} (das cartas, do Hype v2 público e do engajamento), as sinergias entre
 * peças e o peso de cada atributo no tema (HYPE nunca acima do menor peso dos outros, P2-17).
 */
final class FlairLookStats {
    private FlairLookStats() {
    }

    static final Set<String> BOLD = Set.of("avant_garde", "statement", "y2k", "edgy", "grunge", "futuristic", "boho", "vintage", "techwear");
    static final Set<String> TRENDY = Set.of("streetwear", "y2k", "athleisure", "utility", "techwear", "minimalist", "urban", "futuristic", "statement");
    static final Set<String> SNEAKERS = Set.of("casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "high_top_sneakers", "low_top_sneakers", "skate_shoes", "sneakers");
    static final Set<String> STREET_BOTTOMS = Set.of("cargo_pants", "jeans", "joggers", "sweatpants", "denim_shorts", "track_pants");
    static final Set<String> STREET_TOPS = Set.of("t_shirt", "hoodie", "sweatshirt", "oversized_t_shirt", "graphic_tee", "tank_top");
    static final Set<String> LEATHER_SHOES = Set.of("loafers", "oxford_shoes", "derby_shoes", "brogues", "monk_shoes", "heels", "pumps", "ankle_boots", "chelsea_boots", "boots");
    static final Map<String, Integer> RARITY_INDEX = Map.of("STANDARD", 40, "PREMIUM", 60, "LIMITED", 80, "RARE", 100);
    /** Peso padrão de um atributo que o tema não cita. */
    static final double DEFAULT_WEIGHT = 0.8;

    // ------------------------------------------------------------------ look

    static int clamp(double v) {
        return (int) Math.max(0, Math.min(100, Math.round(v)));
    }

    /**
     * Peso de um atributo no tema. O HYPE nunca pesa mais que o menor peso entre os outros nove (P2-17): relevância é
     * contexto, não critério dominante — nenhum tema transforma o jogo em concurso de popularidade.
     */
    public static double weight(Theme t, String stat) {
        double w = t.weights().getOrDefault(stat, DEFAULT_WEIGHT);
        if (!"HYPE".equals(stat)) {
            return w;
        }
        double floor = STATS.stream().filter(k -> !"HYPE".equals(k)).mapToDouble(k -> t.weights().getOrDefault(k, DEFAULT_WEIGHT)).min().orElse(DEFAULT_WEIGHT);
        return Math.min(w, floor);
    }

    /** Sinergias entre peças (FLAIR Combo Battle): cada uma soma pontos num atributo do look. */
    public static List<Synergy> synergies(List<Card> cards, Theme theme) {
        List<Synergy> out = new ArrayList<>();
        Set<String> subs = cards.stream().map(Card::subcategory).filter(Objects::nonNull).collect(Collectors.toSet());
        boolean sneakers = cards.stream().anyMatch(c -> "shoes_piece".equals(c.category()) && (SNEAKERS.contains(c.subcategory()) || c.styles().contains("streetwear")));
        if (sneakers && subs.stream().anyMatch(STREET_BOTTOMS::contains) && subs.stream().anyMatch(STREET_TOPS::contains)) {
            out.add(new Synergy("STREETWEAR_COMBO", Msg.t("flairLooks.streetwear_combo"), "⚡", "STYLE", 15));
        }
        if (subs.contains("blazer") && (subs.contains("shirt") || subs.contains("polo_shirt") || subs.contains("blouse")) && subs.stream().anyMatch(LEATHER_SHOES::contains)) {
            out.add(new Synergy("CLASSIC_FORMAL", Msg.t("flairLooks.classic_formal_combo"), "👔", "STYLE", 18));
        }
        Map<String, Long> fam = cards.stream().collect(Collectors.groupingBy(c -> family(c.colorHex()), Collectors.counting()));
        if (fam.values().stream().anyMatch(n -> n >= 3)) {
            out.add(new Synergy("MONOCHROME", Msg.t("flairLooks.monochrome_combo"), "🖤", "STYLE", 12));
        }
        Map<String, Long> brands = cards.stream().map(Card::brandName).filter(x -> x != null && !x.isBlank()).map(x -> x.toLowerCase(Locale.ROOT))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        if (brands.values().stream().anyMatch(n -> n >= 3)) {
            out.add(new Synergy("BRAND_LOYALTY", Msg.t("flairLooks.brand_loyalty"), "🏷️", "BRAND", 10));
        }
        if (brands.size() >= 3) {
            out.add(new Synergy("MIX_MATCH", Msg.t("flairLooks.mix_match"), "🎨", "ORIGINALITY", 10));
        }
        long vintage = cards.stream().filter(c -> c.styles().contains("vintage")).count();
        if (vintage >= 2) {
            boolean retro = theme != null && theme.styles().contains("vintage");
            out.add(new Synergy("VINTAGE_REVIVAL", Msg.t("flairLooks.vintage_revival"), "📻", "TREND", retro ? 15 : 5));
        }
        return out;
    }

    public static Look look(LookInput in) {
        List<Card> cards = in.cards() == null ? List.of() : in.cards();
        int n = Math.max(1, cards.size());
        Map<String, Integer> s = new LinkedHashMap<>();
        s.put("HYPE", in.hype() == null ? NEUTRAL_HYPE : clamp(in.hype()));
        Map<String, Long> styleCount = cards.stream().flatMap(c -> c.styles().stream().distinct()).collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        String top = styleCount.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        double share = top == null ? 0 : styleCount.get(top) / (double) n;
        s.put("STYLE", clamp(45 + 50 * share + (top != null && in.styles() != null && in.styles().contains(top) ? 5 : 0)));
        List<String> fams = cards.stream().map(c -> family(c.colorHex())).toList();
        Set<String> chroma = fams.stream().filter(f -> !"neutral".equals(f)).collect(Collectors.toSet());
        boolean mono = new HashSet<>(fams).size() == 1 && cards.size() > 1;
        s.put("COLOR", mono ? 98 : chroma.isEmpty() ? 90 : chroma.size() == 1 ? 94 : chroma.size() == 2 ? 82 : chroma.size() == 3 ? 66 : 52);
        Map<String, Long> occCount = cards.stream().flatMap(c -> c.occasions().stream().distinct()).collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        long shared = occCount.values().stream().filter(v -> v * 2 > n).count();
        s.put("OCCASION", clamp(28 + 18 * shared));
        Set<String> styles = cards.stream().flatMap(c -> c.styles().stream()).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> brands = cards.stream().map(Card::brandName).filter(x -> x != null && !x.isBlank()).map(x -> x.toLowerCase(Locale.ROOT)).collect(Collectors.toCollection(LinkedHashSet::new));
        long bold = styles.stream().filter(BOLD::contains).count();
        long subs = cards.stream().map(Card::subcategory).distinct().count();
        s.put("ORIGINALITY", clamp(30 + 12 * bold + (brands.size() >= 2 ? 8 * brands.size() : 0) + 4 * subs + (chroma.size() >= 3 ? 10 : 0)));
        s.put("BRAND", clamp(cards.stream().mapToInt(c -> c.stats().getOrDefault("CLOUT", 20)).average().orElse(20)));
        s.put("RARITY", clamp(cards.stream().mapToInt(c -> RARITY_INDEX.getOrDefault(c.rarity(), 40)).average().orElse(40)));
        double trendShare = cards.stream().filter(c -> c.styles().stream().anyMatch(TRENDY::contains)).count() / (double) n;
        s.put("TREND", clamp(30 + 50 * trendShare + 0.2 * cards.stream().mapToInt(c -> c.stats().getOrDefault("SYNC", 50)).average().orElse(50)));
        double eng = in.likes() + 2.0 * in.saves() + 3.0 * in.comments() + 2.0 * in.shares() + 3.0 * in.remixes();
        s.put("COMMUNITY", clamp(18 * (Math.log(1 + eng) / Math.log(2))));
        s.put("AI", clamp(completeness(cards) + 0.25 * s.get("COLOR") + 0.25 * s.get("STYLE")));
        List<Synergy> syn = synergies(cards, null);
        for (Synergy x : syn) {
            s.merge(x.stat(), x.bonus(), (a, b) -> clamp(a + b));
        }
        // nota geral: média simples dos 10 atributos (o HYPE pesa 1, como os demais; antes era a "força-base" ×1,5)
        int rating = clamp(STATS.stream().mapToDouble(s::get).sum() / STATS.size());
        return new Look(in.schemeId(), in.title(), in.owner(), in.coverUrl(), s, syn, rating, new ArrayList<>(styles),
                new ArrayList<>(occCount.keySet()), fams.stream().distinct().toList(), new ArrayList<>(brands), cards);
    }

    /** Completude do look para a "IA": superior + inferior (ou vestido) + calçado; acessório soma. */
    static double completeness(List<Card> cards) {
        Set<String> cats = cards.stream().map(Card::category).collect(Collectors.toSet());
        boolean body = cats.contains("full_body_piece") || (cats.contains("upper_piece") && cats.contains("lower_piece"));
        return (body ? 30 : cats.contains("upper_piece") || cats.contains("lower_piece") ? 15 : 5) + (cats.contains("shoes_piece") ? 12 : 0) + (cats.contains("accessory_piece") ? 8 : 0);
    }

    public static Map<String, Integer> count(List<String> xs) {
        Map<String, Integer> m = new HashMap<>();
        xs.forEach(x -> m.merge(x, 1, Integer::sum));
        return m;
    }
}

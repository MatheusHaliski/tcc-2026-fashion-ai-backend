package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Motor dos modos do FLAIR: <b>PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO</b>. Um look (esquema) tem 10 atributos —
 * HypeScore, Style, Color Harmony, Occasion Fit, Originality, Brand Power, Rarity, Trend, Community e AI Score —
 * calculados das peças (cartas), do HypeScore e do engajamento. O HypeScore é a força-base; o <b>tema</b> da rodada
 * muda os pesos, e sinergias (combos), cor, diversidade e condições do tabuleiro alteram o resultado. Tudo é
 * determinístico e sem aposta (as recompensas vêm do sistema).
 */
public final class FlairLooks {
    private FlairLooks() {
    }

    public static final List<String> STATS = List.of("HYPE", "STYLE", "COLOR", "OCCASION", "ORIGINALITY", "BRAND", "RARITY", "TREND", "COMMUNITY", "AI");
    public static final Map<String, String> LABELS = new LinkedHashMap<>();

    static {
        LABELS.put("HYPE", "HypeScore");
        LABELS.put("STYLE", "Style");
        LABELS.put("COLOR", Msg.k("flairLooks.color_harmony"));
        LABELS.put("OCCASION", Msg.k("flairLooks.occasion_fit"));
        LABELS.put("ORIGINALITY", "Originality");
        LABELS.put("BRAND", Msg.k("flairLooks.brand_power"));
        LABELS.put("RARITY", "Rarity");
        LABELS.put("TREND", "Trend");
        LABELS.put("COMMUNITY", "Community");
        LABELS.put("AI", Msg.k("flairLooks.ai_score"));
    }

    static final Set<String> BOLD = Set.of("avant_garde", "statement", "y2k", "edgy", "grunge", "futuristic", "boho", "vintage", "techwear");
    static final Set<String> TRENDY = Set.of("streetwear", "y2k", "athleisure", "utility", "techwear", "minimalist", "urban", "futuristic", "statement");
    static final Set<String> SNEAKERS = Set.of("casual_sneakers", "running_shoes", "training_shoes", "basketball_shoes", "high_top_sneakers", "low_top_sneakers", "skate_shoes", "sneakers");
    static final Set<String> STREET_BOTTOMS = Set.of("cargo_pants", "jeans", "joggers", "sweatpants", "denim_shorts", "track_pants");
    static final Set<String> STREET_TOPS = Set.of("t_shirt", "hoodie", "sweatshirt", "oversized_t_shirt", "graphic_tee", "tank_top");
    static final Set<String> LEATHER_SHOES = Set.of("loafers", "oxford_shoes", "derby_shoes", "brogues", "monk_shoes", "heels", "pumps", "ankle_boots", "chelsea_boots", "boots");
    public static final Set<String> OUTERWEAR = Set.of("jacket", "coat", "blazer", "parka", "cardigan", "trench_coat", "puffer_jacket", "denim_jacket", "leather_jacket", "bomber_jacket", "windbreaker", "vest");
    static final Map<String, Integer> RARITY_INDEX = Map.of("STANDARD", 40, "PREMIUM", 60, "LIMITED", 80, "RARE", 100);

    // ------------------------------------------------------------------ tipos

    public record LookInput(String schemeId, String title, String owner, String coverUrl, Double hype, long likes, long saves, long comments,
                            long shares, long remixes, List<String> styles, List<String> occasions, String season, List<Card> cards) {
    }

    public record Synergy(String code, String label, String emoji, String stat, int bonus) {
    }

    public record Look(String schemeId, String title, String owner, String coverUrl, Map<String, Integer> stats, List<Synergy> synergies,
                       int rating, List<String> styles, List<String> occasions, List<String> families, List<String> brands, List<Card> cards) {
    }

    /** Tema da rodada: ocasiões e estilos em foco, pesos dos atributos e condições especiais do tabuleiro. */
    public record Theme(String code, String label, String emoji, List<String> occasions, List<String> styles, Map<String, Double> weights,
                        Set<String> bonusSubcategories, int bonusPoints, String boostStyle, String boostStat, double boostPct,
                        String requireStyle, String hint) {
        Theme(String code, String label, String emoji, List<String> occasions, List<String> styles, Map<String, Double> weights, String hint) {
            this(code, label, emoji, occasions, styles, weights, Set.of(), 0, null, null, 0, null, hint);
        }
    }

    public record Score(double total, Map<String, Double> parts, List<String> notes) {
    }

    public record Clash(String label, String a, String b, double scoreA, double scoreB, String winner, List<String> notes, List<Map<String, Object>> breakdown) {
    }

    // ------------------------------------------------------------------ temas

    static Map<String, Double> w(Object... kv) {
        Map<String, Double> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], ((Number) kv[i + 1]).doubleValue());
        }
        return m;
    }

    public static final Map<String, Theme> THEMES = new LinkedHashMap<>();

    static void theme(Theme t) {
        THEMES.put(t.code(), t);
    }

    static {
        theme(new Theme("FESTIVAL_NOITE", Msg.k("flairLooks.festival_de_musica_noite"), "🎶", List.of("festival", "party", "night_out"), List.of("streetwear", "boho", "y2k", "edgy"),
                w("STYLE", 1.4, "ORIGINALITY", 1.5, "TREND", 1.4, "HYPE", 1.0), Msg.k("flairLooks.style_originality_e_trend_recebem")));
        theme(new Theme("DATE_NIGHT", Msg.k("flairLooks.date_night"), "🌙", List.of("date", "night_out"), List.of("romantic", "chic", "glam"),
                w("COLOR", 1.4, "STYLE", 1.3, "OCCASION", 1.3, "AI", 1.1), Msg.k("flairLooks.harmonia_de_cores_e_coerencia")));
        theme(new Theme("BUSINESS_MEETING", Msg.k("flairLooks.business_meeting"), "💼", List.of("work", "business"), List.of("tailored", "classic", "minimalist"),
                w("STYLE", 1.3, "OCCASION", 1.5, "AI", 1.2, "COLOR", 1.1, "ORIGINALITY", 0.6), Msg.k("flairLooks.adequacao_a_ocasiao_pesa_mais")));
        theme(new Theme("MUSIC_FESTIVAL", Msg.k("flairLooks.music_festival"), "🎪", List.of("festival", "outdoor"), List.of("boho", "streetwear", "y2k"),
                w("ORIGINALITY", 1.5, "TREND", 1.3, "STYLE", 1.1), Msg.k("flairLooks.criatividade_em_primeiro_lugar")));
        theme(new Theme("BEACH_CLUB", Msg.k("flairLooks.beach_club"), "🏖️", List.of("beach", "vacation", "party"), List.of("resort", "boho", "minimalist"),
                w("COLOR", 1.3, "OCCASION", 1.4, "TREND", 1.1), Msg.k("common.ocasiao_de_praia_e_cores")));
        theme(new Theme("RED_CARPET", Msg.k("flairLooks.red_carpet"), "🎬", List.of("formal", "ceremony", "party"), List.of("glam", "luxury", "avant_garde"),
                w("BRAND", 1.4, "RARITY", 1.4, "HYPE", 1.3, "STYLE", 1.2), Set.of(), 0, "luxury", "BRAND", 0.15, null,
                Msg.k("common.formal_luxury_marca_de_celebridade")));
        theme(new Theme("CYBERPUNK_FORMAL", Msg.k("flairLooks.cyberpunk_formal"), "🤖", List.of("formal", "party", "night_out"), List.of("futuristic", "techwear", "tailored", "avant_garde"),
                w("ORIGINALITY", 1.5, "TREND", 1.3, "STYLE", 1.2), Msg.k("flairLooks.tema_da_flair_runway_tecnologia")));
        theme(new Theme("SMART_CASUAL_AUTUMN", Msg.k("flairLooks.smart_casual_outono_jantar"), "🍂", List.of("date", "social", "casual"), List.of("classic", "chic", "preppy"),
                w("STYLE", 1.2, "COLOR", 1.2, "OCCASION", 1.3), Msg.k("flairLooks.challenge_do_deck_battle_smart")));
        theme(new Theme("RAINY_LONDON", Msg.k("common.rainy_london"), "☔", List.of("work", "casual", "outdoor"), List.of("classic", "utility"),
                w("STYLE", 1.1, "AI", 1.1), OUTERWEAR, 10, null, null, 0, null, Msg.k("common.looks_com_outerwear_recebem_bonus")));
        theme(new Theme("MILAN_FASHION_WEEK", Msg.k("common.milan_fashion_week"), "🇮🇹", List.of("formal", "party", "social"), List.of("luxury", "chic", "tailored"),
                w("BRAND", 1.4, "STYLE", 1.2, "RARITY", 1.2), Set.of(), 0, null, null, 0, "luxury", Msg.k("common.use_um_look_com_pelo")));
        theme(new Theme("TOKYO_STREET", Msg.k("common.tokyo_street_challenge"), "🗼", List.of("casual", "night_out", "social"), List.of("streetwear", "y2k", "urban"),
                w("ORIGINALITY", 1.3, "TREND", 1.3, "STYLE", 1.1), Set.of(), 0, "streetwear", "ORIGINALITY", 0.20, null, Msg.k("common.streetwear_recebe_20_originality")));
        theme(new Theme("PARIS_COUTURE", Msg.k("flairLooks.paris_couture"), "🗼", List.of("formal", "date", "ceremony"), List.of("chic", "glam", "romantic"),
                w("STYLE", 1.4, "COLOR", 1.2, "BRAND", 1.2), Msg.k("flairLooks.elegancia_e_coerencia_parisiense")));
        theme(new Theme("SEOUL_KFASHION", Msg.k("common.seoul_k_fashion"), "🇰🇷", List.of("casual", "social", "university"), List.of("modern", "y2k", "minimalist"),
                w("TREND", 1.5, "COLOR", 1.1, "COMMUNITY", 1.2), Msg.k("common.trend_e_comunidade_em_alta")));
        theme(new Theme("NEW_YORK_MINIMAL", Msg.k("common.new_york_minimal"), "🗽", List.of("work", "business", "casual"), List.of("minimalist", "modern", "classic"),
                w("COLOR", 1.4, "STYLE", 1.3, "AI", 1.2), Msg.k("flairLooks.menos_e_mais_harmonia_de")));
        theme(new Theme("SAO_PAULO_TROPICAL", Msg.k("flairLooks.sao_paulo_tropical"), "🌴", List.of("casual", "party", "social"), List.of("resort", "boho", "urban"),
                w("COLOR", 1.2, "ORIGINALITY", 1.2, "COMMUNITY", 1.2), Msg.k("common.cor_calor_e_comunidade")));
        theme(new Theme("LONDON_VINTAGE", Msg.k("flairLooks.london_vintage"), "🎩", List.of("casual", "social", "date"), List.of("vintage", "classic", "grunge"),
                w("TREND", 1.2, "ORIGINALITY", 1.2, "STYLE", 1.1), Msg.k("common.evento_retro_vintage_revival_vale")));
        theme(new Theme("GYM_RUN", Msg.k("flairLooks.treino_ao_ar_livre"), "🏃", List.of("sport", "gym", "outdoor"), List.of("sporty", "athleisure"),
                w("OCCASION", 1.6, "AI", 1.1, "TREND", 1.1), Msg.k("common.esporte_adequacao_acima_de_tudo")));
        theme(new Theme("WEDDING_GUEST", Msg.k("common.casamento_de_dia"), "💐", List.of("wedding", "ceremony", "formal"), List.of("romantic", "classic", "chic"),
                w("OCCASION", 1.4, "COLOR", 1.3, "STYLE", 1.2), Msg.k("flairLooks.convidado_elegante_sem_roubar_a")));
    }

    public static final List<String> SQUAD_SITUATIONS = List.of("DATE_NIGHT", "BUSINESS_MEETING", "MUSIC_FESTIVAL", "BEACH_CLUB", "RED_CARPET");

    public static Theme theme(String code) {
        return THEMES.getOrDefault(code == null ? "" : code.toUpperCase(Locale.ROOT), THEMES.get("FESTIVAL_NOITE"));
    }

    /** Tema sorteado de forma determinística por uma semente (data + ids), para o resultado poder ser auditado. */
    public static Theme drawTheme(long seed) {
        List<Theme> all = new ArrayList<>(THEMES.values());
        return all.get(Math.floorMod(new Random(seed).nextInt(), all.size()));
    }

    // ------------------------------------------------------------------ cor

    /** Família de cor a partir do hex: neutral (baixa saturação, preto/branco/cinza/bege) ou faixa de matiz. */
    public static String family(String hex) {
        if (hex == null || !hex.matches("#?[0-9A-Fa-f]{6}")) {
            return "neutral";
        }
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        float r = Integer.parseInt(h.substring(0, 2), 16) / 255f, g = Integer.parseInt(h.substring(2, 4), 16) / 255f, b = Integer.parseInt(h.substring(4, 6), 16) / 255f;
        float[] hsb = java.awt.Color.RGBtoHSB(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), null);
        if (hsb[1] < 0.18 || hsb[2] < 0.16) {
            return "neutral";
        }
        float hue = hsb[0] * 360;
        return hue < 15 || hue >= 345 ? "red" : hue < 40 ? "orange" : hue < 65 ? "yellow" : hue < 165 ? "green" : hue < 255 ? "blue" : hue < 290 ? "purple" : "pink";
    }

    static boolean dark(String hex) {
        return hex != null && hex.matches("#?[0-9A-Fa-f]{6}") && luminance(hex) < 0.18;
    }

    static boolean light(String hex) {
        return hex != null && hex.matches("#?[0-9A-Fa-f]{6}") && luminance(hex) > 0.82;
    }

    static double luminance(String hex) {
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        return (0.299 * Integer.parseInt(h.substring(0, 2), 16) + 0.587 * Integer.parseInt(h.substring(2, 4), 16) + 0.114 * Integer.parseInt(h.substring(4, 6), 16)) / 255.0;
    }

    // ------------------------------------------------------------------ look

    static int clamp(double v) {
        return (int) Math.max(0, Math.min(100, Math.round(v)));
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
        double avgPower = cards.stream().mapToInt(Card::power).average().orElse(50);
        s.put("HYPE", clamp(in.hype() != null && in.hype() > 0 ? in.hype() : Math.min(100, avgPower * 0.7)));
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
        int rating = clamp(STATS.stream().mapToDouble(k -> s.get(k) * ("HYPE".equals(k) ? 1.5 : 1)).sum() / (STATS.size() + 0.5));
        return new Look(in.schemeId(), in.title(), in.owner(), in.coverUrl(), s, syn, rating, new ArrayList<>(styles),
                new ArrayList<>(occCount.keySet()), fams.stream().distinct().toList(), new ArrayList<>(brands), cards);
    }

    /** Completude do look para a "IA": superior + inferior (ou vestido) + calçado; acessório soma. */
    static double completeness(List<Card> cards) {
        Set<String> cats = cards.stream().map(Card::category).collect(Collectors.toSet());
        boolean body = cats.contains("full_body_piece") || (cats.contains("upper_piece") && cats.contains("lower_piece"));
        return (body ? 30 : cats.contains("upper_piece") || cats.contains("lower_piece") ? 15 : 5) + (cats.contains("shoes_piece") ? 12 : 0) + (cats.contains("accessory_piece") ? 8 : 0);
    }

    // ------------------------------------------------------------------ pontuação contextual

    /** Pontuação do look no tema: pesos do tema sobre os 10 atributos + ocasião/estilo do tema + condições. */
    public static Score score(Look l, Theme t) {
        List<String> notes = new ArrayList<>();
        Map<String, Double> v = new LinkedHashMap<>();
        l.stats().forEach((k, x) -> v.put(k, x.doubleValue()));
        int n = Math.max(1, l.cards().size());
        if (!t.occasions().isEmpty()) {
            double fit = l.cards().stream().filter(c -> c.occasions().stream().anyMatch(t.occasions()::contains)).count() / (double) n;
            v.put("OCCASION", 0.7 * fit * 100 + 0.3 * v.get("OCCASION"));
        }
        if (!t.styles().isEmpty()) {
            double fit = l.cards().stream().filter(c -> c.styles().stream().anyMatch(t.styles()::contains)).count() / (double) n;
            v.put("STYLE", Math.min(120, v.get("STYLE") + 12 * fit));
        }
        if (t.boostStyle() != null && l.styles().contains(t.boostStyle()) && t.boostStat() != null) {
            v.put(t.boostStat(), v.get(t.boostStat()) * (1 + t.boostPct()));
            notes.add(t.boostStyle() + " → +" + Math.round(t.boostPct() * 100) + "% " + LABELS.get(t.boostStat()));
        }
        for (Synergy x : synergies(l.cards(), t)) {
            if (x.code().equals("VINTAGE_REVIVAL") && t.styles().contains("vintage")) {
                v.put("TREND", v.get("TREND") + 10);
                notes.add(Msg.t("flairLooks.vintage_revival_no_evento_retro"));
            }
        }
        double sw = 0, sum = 0;
        Map<String, Double> parts = new LinkedHashMap<>();
        for (String k : STATS) {
            double wt = t.weights().getOrDefault(k, 0.8);
            sw += wt;
            sum += wt * v.get(k);
            parts.put(k, Math.round(wt * v.get(k) * 10) / 10.0);
        }
        double total = sum / sw;
        if (!t.bonusSubcategories().isEmpty() && l.cards().stream().anyMatch(c -> t.bonusSubcategories().contains(c.subcategory()))) {
            total += t.bonusPoints();
            notes.add(Msg.t("flairLooks.pela_peca_exigida_no_tema", t.bonusPoints()));
        }
        if (t.requireStyle() != null) {
            if (l.styles().contains(t.requireStyle())) {
                total += 5;
                notes.add(Msg.t("flairLooks.tem_peca_5", t.requireStyle()));
            } else {
                total -= 15;
                notes.add(Msg.t("flairLooks.sem_peca_15", t.requireStyle()));
            }
        }
        if (!l.synergies().isEmpty()) {
            notes.add(l.synergies().stream().map(x -> x.emoji() + " " + x.label()).collect(Collectors.joining(", ")));
        }
        return new Score(Math.round(total * 10) / 10.0, parts, notes);
    }

    /** Battle of Looks: Look A × Look B no tema sorteado — o contexto muda os pesos, não só o HypeScore. */
    public static Clash battle(Look a, Look b, Theme t) {
        Score sa = score(a, t), sb = score(b, t);
        List<Map<String, Object>> bd = new ArrayList<>();
        for (String k : STATS) {
            bd.add(Map.of("stat", k, "label", LABELS.get(k), "weight", t.weights().getOrDefault(k, 0.8), "a", a.stats().get(k), "b", b.stats().get(k)));
        }
        List<String> notes = new ArrayList<>();
        sa.notes().forEach(x -> notes.add("A: " + x));
        sb.notes().forEach(x -> notes.add("B: " + x));
        return new Clash(t.emoji() + " " + t.label(), a.title(), b.title(), sa.total(), sb.total(), winner(sa.total(), sb.total()), notes, bd);
    }

    public static String winner(double a, double b) {
        return Math.abs(a - b) < 0.5 ? "DRAW" : a > b ? "A" : "B";
    }

    // ------------------------------------------------------------------ Squad 5×5 (e Liga)

    /** Melhor escalação: cada situação recebe um look diferente, maximizando a soma (força bruta, até 5! = 120). */
    public static List<Integer> assign(List<Look> looks, List<Theme> situations) {
        int m = situations.size();
        List<Integer> idx = new ArrayList<>();
        for (int i = 0; i < looks.size(); i++) {
            idx.add(i);
        }
        List<Integer> best = new ArrayList<>();
        double[] bestScore = {-1};
        permute(idx, 0, m, looks, situations, bestScore, best);
        return best;
    }

    private static void permute(List<Integer> idx, int k, int m, List<Look> looks, List<Theme> sits, double[] best, List<Integer> out) {
        if (k == Math.min(m, idx.size())) {
            double s = 0;
            for (int i = 0; i < k; i++) {
                s += score(looks.get(idx.get(i)), sits.get(i)).total();
            }
            if (s > best[0]) {
                best[0] = s;
                out.clear();
                out.addAll(idx.subList(0, k));
            }
            return;
        }
        for (int i = k; i < idx.size(); i++) {
            java.util.Collections.swap(idx, k, i);
            permute(idx, k + 1, m, looks, sits, best, out);
            java.util.Collections.swap(idx, k, i);
        }
    }

    public static List<Clash> squad(List<Look> a, List<Look> b, List<Theme> situations) {
        List<Integer> pa = assign(a, situations), pb = assign(b, situations);
        List<Clash> out = new ArrayList<>();
        for (int r = 0; r < situations.size(); r++) {
            Theme t = situations.get(r);
            Look la = r < pa.size() ? a.get(pa.get(r)) : null, lb = r < pb.size() ? b.get(pb.get(r)) : null;
            if (la == null && lb == null) {
                continue;
            }
            if (la == null || lb == null) {
                out.add(new Clash(t.emoji() + " " + t.label(), la == null ? "—" : la.title(), lb == null ? "—" : lb.title(), la == null ? 0 : score(la, t).total(),
                        lb == null ? 0 : score(lb, t).total(), la == null ? "B" : "A", List.of(Msg.t("flairLooks.w_o_o_outro_lado")), List.of()));
                continue;
            }
            out.add(battle(la, lb, t));
        }
        return out;
    }

    public static final List<String[]> DIVISIONS = List.of(new String[]{"0", "BRONZE", "Bronze"}, new String[]{"6", "SILVER", "Silver"},
            new String[]{"12", "GOLD", "Gold"}, new String[]{"18", "PLATINUM", "Platinum"}, new String[]{"24", "DIAMOND", "Diamond"},
            new String[]{"30", "FLAIR_ELITE", Msg.k("flairLooks.flair_elite")});

    public static Map<String, Object> division(int points) {
        String[] d = DIVISIONS.get(0);
        for (String[] x : DIVISIONS) {
            if (points >= Integer.parseInt(x[0])) {
                d = x;
            }
        }
        return Map.of("code", d[1], "label", d[2], "from", Integer.parseInt(d[0]));
    }

    /** Partida da Fashion League: titulares por situação, até 2 substituições por reservas e cartas especiais (+3). */
    public static List<Clash> leagueMatch(List<Look> startersA, List<Look> reservesA, List<Card> specialsA, List<Look> startersB,
                                          List<Look> reservesB, List<Card> specialsB, List<Theme> situations) {
        List<Clash> base = squad(startersA, startersB, situations);
        List<Clash> out = new ArrayList<>();
        int subsA = 0, subsB = 0;
        List<Integer> pa = assign(startersA, situations), pb = assign(startersB, situations);
        for (int r = 0; r < base.size(); r++) {
            Clash c = base.get(r);
            Theme t = situations.get(r);
            double sa = c.scoreA(), sb = c.scoreB();
            List<String> notes = new ArrayList<>(c.notes());
            String la = c.a(), lb = c.b();
            if (subsA < 2 && !reservesA.isEmpty()) {
                Look best = reservesA.stream().max(Comparator.comparingDouble(x -> score(x, t).total())).get();
                double bs = score(best, t).total();
                if (bs > sa + 3) {
                    notes.add(Msg.t("flairLooks.a_substituicao_entra_no_lugar", best.title(), la));
                    la = best.title();
                    sa = bs;
                    subsA++;
                }
            }
            if (subsB < 2 && !reservesB.isEmpty()) {
                Look best = reservesB.stream().max(Comparator.comparingDouble(x -> score(x, t).total())).get();
                double bs = score(best, t).total();
                if (bs > sb + 3) {
                    notes.add(Msg.t("flairLooks.b_substituicao_entra_no_lugar", best.title(), lb));
                    lb = best.title();
                    sb = bs;
                    subsB++;
                }
            }
            if (specialsA.stream().anyMatch(x -> x.occasions().stream().anyMatch(t.occasions()::contains) || x.styles().stream().anyMatch(t.styles()::contains))) {
                sa += 3;
                notes.add(Msg.t("flairLooks.a_carta_especial_3"));
            }
            if (specialsB.stream().anyMatch(x -> x.occasions().stream().anyMatch(t.occasions()::contains) || x.styles().stream().anyMatch(t.styles()::contains))) {
                sb += 3;
                notes.add(Msg.t("flairLooks.b_carta_especial_3"));
            }
            out.add(new Clash(c.label(), la, lb, Math.round(sa * 10) / 10.0, Math.round(sb * 10) / 10.0, winner(sa, sb), notes, c.breakdown()));
        }
        return out;
    }

    // ------------------------------------------------------------------ Tag Team

    /** Team Harmony: estética compatível entre os dois looks da dupla (estilo, cor e ocasião). */
    public static int harmony(Look a, Look b) {
        double st = jaccard(a.styles(), b.styles()), oc = jaccard(a.occasions(), b.occasions());
        Set<String> fa = new HashSet<>(a.families()), fb = new HashSet<>(b.families());
        fa.remove("neutral");
        fb.remove("neutral");
        double col = fa.isEmpty() || fb.isEmpty() ? 0.85 : jaccard(new ArrayList<>(fa), new ArrayList<>(fb)) * 0.6 + 0.4;
        return clamp(40 + st * 30 + col * 20 + oc * 15);
    }

    static double jaccard(Collection<String> a, Collection<String> b) {
        Set<String> i = new HashSet<>(a);
        i.retainAll(b);
        Set<String> u = new HashSet<>(a);
        u.addAll(b);
        return u.isEmpty() ? 0 : i.size() / (double) u.size();
    }

    public static double tagScore(Look a, Look b, Theme t) {
        return Math.round(((score(a, t).total() + score(b, t).total()) / 2 * 0.8 + harmony(a, b) * 0.2) * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Combo Battle

    public static double comboScore(Look l, Theme t) {
        int combos = synergies(l.cards(), t).stream().mapToInt(Synergy::bonus).sum();
        return Math.round((combos * 2 + score(l, t).total() * 0.3) * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Boss

    public record Boss(String code, String name, String emoji, String theme, Map<String, Integer> stats, String lesson) {
    }

    public static final Map<String, Boss> BOSSES = new LinkedHashMap<>();

    static void boss(Boss b) {
        BOSSES.put(b.code(), b);
    }

    static {
        boss(new Boss("MINIMALIST", Msg.k("flairLooks.the_minimalist"), "👑", "NEW_YORK_MINIMAL", Map.of("STYLE", 100, "COLOR", 95, "AI", 97),
                Msg.k("flairLooks.poucas_cores_e_pecas_coerentes")));
        boss(new Boss("STREET_KING", Msg.k("flairLooks.street_king"), "🔥", "TOKYO_STREET", Map.of("TREND", 96, "ORIGINALITY", 92, "STYLE", 90),
                Msg.k("flairLooks.tenis_cargo_camiseta_ampla_formam")));
        boss(new Boss("LUXURY_QUEEN", Msg.k("flairLooks.luxury_queen"), "💎", "RED_CARPET", Map.of("BRAND", 98, "RARITY", 96, "HYPE", 94),
                Msg.k("flairLooks.no_red_carpet_marca_e")));
        boss(new Boss("COLOR_MASTER", Msg.k("flairLooks.color_master"), "🌈", "SAO_PAULO_TROPICAL", Map.of("COLOR", 99, "ORIGINALITY", 90, "COMMUNITY", 88),
                Msg.k("flairLooks.cores_analogas_vizinhas_no_circulo")));
        boss(new Boss("VINTAGE_COLLECTOR", Msg.k("flairLooks.vintage_collector"), "🧥", "LONDON_VINTAGE", Map.of("TREND", 92, "ORIGINALITY", 94, "RARITY", 90),
                Msg.k("flairLooks.duas_pecas_vintage_ativam_o")));
        boss(new Boss("AVANT_GARDE_AI", Msg.k("flairLooks.avant_garde_ai"), "🧬", "CYBERPUNK_FORMAL", Map.of("ORIGINALITY", 99, "TREND", 95, "AI", 96),
                Msg.k("flairLooks.estilos_ousados_avant_garde_statement")));
    }

    /** O boss tem os atributos fixos acima e 72 nos demais; a luta usa o tema preferido dele. */
    public static Look bossLook(Boss b) {
        Map<String, Integer> s = new LinkedHashMap<>();
        STATS.forEach(k -> s.put(k, b.stats().getOrDefault(k, 72)));
        Theme t = theme(b.theme());
        return new Look(null, b.emoji() + " " + b.name(), "BOSS", null, s, List.of(), 88, t.styles(), t.occasions(), List.of("neutral"), List.of(), List.of());
    }

    /** Boss não tem cartas: a pontuação dele é só a média ponderada dos atributos no tema. */
    public static double bossScore(Look boss, Theme t) {
        double sw = 0, sum = 0;
        for (String k : STATS) {
            double wt = t.weights().getOrDefault(k, 0.8);
            sw += wt;
            sum += wt * boss.stats().get(k);
        }
        return Math.round(sum / sw * 10) / 10.0;
    }

    // ------------------------------------------------------------------ Ultimate Team

    public static final Map<String, String> ROLES = new LinkedHashMap<>();

    static {
        ROLES.put("ICON", "RATING");
        ROLES.put("TREND", "TREND");
        ROLES.put("SOCIAL", "COMMUNITY");
        ROLES.put("CREATIVE", "ORIGINALITY");
        ROLES.put("CLASSIC", "STYLE");
        ROLES.put("WILD_CARD", "WILD");
        ROLES.put("SPECIAL", "RARITY");
    }

    public static int roleValue(Look l, String role) {
        String stat = ROLES.get(role);
        if ("RATING".equals(stat)) {
            return l.rating();
        }
        if ("WILD".equals(stat)) {
            // imprevisível: o maior atributo do look vale inteiro, o menor puxa pouco
            int max = l.stats().values().stream().mapToInt(Integer::intValue).max().orElse(0);
            int min = l.stats().values().stream().mapToInt(Integer::intValue).min().orElse(0);
            return clamp(max * 0.8 + min * 0.2);
        }
        if ("STYLE".equals(stat)) {
            return clamp((l.stats().get("STYLE") + l.stats().get("AI")) / 2.0);
        }
        return l.stats().get(stat);
    }

    public static Map<String, Object> teamRating(Map<String, Look> roster) {
        List<Look> looks = roster.values().stream().filter(Objects::nonNull).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        if (looks.isEmpty()) {
            m.put("rating", 0);
            return m;
        }
        double rating = roster.entrySet().stream().filter(e -> e.getValue() != null).mapToInt(e -> roleValue(e.getValue(), e.getKey())).average().orElse(0);
        double chem = 0;
        int pairs = 0;
        for (int i = 0; i < looks.size(); i++) {
            for (int j = i + 1; j < looks.size(); j++) {
                chem += harmony(looks.get(i), looks.get(j));
                pairs++;
            }
        }
        Set<String> styles = looks.stream().flatMap(l -> l.styles().stream()).collect(Collectors.toSet());
        Set<String> occ = looks.stream().flatMap(l -> l.occasions().stream()).collect(Collectors.toSet());
        m.put("rating", clamp(rating));
        m.put("chemistry", clamp(pairs == 0 ? 70 : chem / pairs));
        m.put("diversity", clamp(styles.size() * 7 + occ.size() * 5));
        m.put("trend", clamp(looks.stream().mapToInt(l -> l.stats().get("TREND")).average().orElse(0)));
        m.put("creativity", clamp(looks.stream().mapToInt(l -> l.stats().get("ORIGINALITY")).average().orElse(0)));
        m.put("community", clamp(looks.stream().mapToInt(l -> l.stats().get("COMMUNITY")).average().orElse(0)));
        return m;
    }

    // ------------------------------------------------------------------ Chess (Fashion Strategy)

    public static final List<String> BOARD = List.of("ACCESSORY_L", "TOP", "ACCESSORY_R", "BOTTOM", "HERO", "OUTERWEAR", "SHOES_L", "SUPPORT", "SHOES_R");

    static boolean fits(String slot, Card c) {
        return switch (slot) {
            case "ACCESSORY_L", "ACCESSORY_R" -> "accessory_piece".equals(c.category());
            case "TOP" -> "upper_piece".equals(c.category()) && !OUTERWEAR.contains(c.subcategory()) || "full_body_piece".equals(c.category());
            case "OUTERWEAR" -> OUTERWEAR.contains(c.subcategory());
            case "BOTTOM" -> "lower_piece".equals(c.category()) || "full_body_piece".equals(c.category());
            case "SHOES_L", "SHOES_R" -> "shoes_piece".equals(c.category());
            default -> true;
        };
    }

    static List<Integer> neighbors(int i) {
        List<Integer> n = new ArrayList<>();
        int r = i / 3, c = i % 3;
        if (r > 0) n.add(i - 3);
        if (r < 2) n.add(i + 3);
        if (c > 0) n.add(i - 1);
        if (c < 2) n.add(i + 1);
        return n;
    }

    /** Avalia o tabuleiro 3×3: poder das cartas na posição certa, HERO ×1,25, SUPPORT e bônus de adjacência. */
    public static Map<String, Object> chess(Map<String, Card> board) {
        List<Map<String, Object>> cells = new ArrayList<>();
        List<String> bonuses = new ArrayList<>();
        double total = 0;
        for (int i = 0; i < BOARD.size(); i++) {
            String slot = BOARD.get(i);
            Card c = board.get(slot);
            if (c == null) {
                cells.add(Map.of("slot", slot, "empty", true));
                continue;
            }
            boolean ok = fits(slot, c);
            double v = c.power() / 10.0 * (ok ? 1 : 0.5) * ("HERO".equals(slot) ? 1.25 : 1);
            total += v;
            cells.add(Map.of("slot", slot, "card", c.name(), "fits", ok, "value", Math.round(v * 10) / 10.0));
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < BOARD.size(); i++) {
            Card a = board.get(BOARD.get(i));
            if (a == null) {
                continue;
            }
            for (int j : neighbors(i)) {
                Card b = board.get(BOARD.get(j));
                if (b == null || !seen.add(Math.min(i, j) + ":" + Math.max(i, j))) {
                    continue;
                }
                total += adjacency(a, b, bonuses);
            }
            if ("SUPPORT".equals(BOARD.get(i))) {
                long n = neighbors(i).stream().filter(j -> board.get(BOARD.get(j)) != null).count();
                total += 3 * n;
                if (n > 0) {
                    bonuses.add(Msg.t("flairLooks.support_para_as_vizinhas", a.name(), (3 * n)));
                }
            }
        }
        return Map.of("total", Math.round(total * 10) / 10.0, "cells", cells, "bonuses", bonuses);
    }

    static double adjacency(Card a, Card b, List<String> log) {
        double s = 0;
        String fa = family(a.colorHex()), fb = family(b.colorHex());
        if (light(a.colorHex()) && "upper_piece".equals(a.category()) && dark(b.colorHex()) && "lower_piece".equals(b.category())
                || light(b.colorHex()) && "upper_piece".equals(b.category()) && dark(a.colorHex()) && "lower_piece".equals(a.category())) {
            s += 5;
            log.add("claro + calça escura: +5 Harmony (" + a.name() + " · " + b.name() + ")");
        } else if (fa.equals(fb) && !"neutral".equals(fa)) {
            s += 3;
            log.add("mesma família de cor: +3 (" + a.name() + " · " + b.name() + ")");
        } else if ("neutral".equals(fa) || "neutral".equals(fb)) {
            s += 2;
        }
        boolean street = (SNEAKERS.contains(a.subcategory()) && STREET_BOTTOMS.contains(b.subcategory())) || (SNEAKERS.contains(b.subcategory()) && STREET_BOTTOMS.contains(a.subcategory()));
        if (street) {
            s += 8;
            log.add("tênis + cargo/jeans: +8 Style");
        }
        if (("blazer".equals(a.subcategory()) && "tailored_pants".equals(b.subcategory())) || ("blazer".equals(b.subcategory()) && "tailored_pants".equals(a.subcategory()))) {
            s += 6;
            log.add("blazer + alfaiataria: +6 Style");
        }
        if (a.styles().stream().anyMatch(b.styles()::contains)) {
            s += 4;
        }
        if (a.brandName() != null && a.brandName().equalsIgnoreCase(b.brandName())) {
            s += 3;
            log.add("mesma marca: +3 (" + a.brandName() + ")");
        }
        return s;
    }

    /** Monta o melhor tabuleiro possível com um conjunto de cartas (IA do oponente e sugestão para o jogador). */
    public static Map<String, Card> autoBoard(List<Card> pool) {
        Map<String, Card> board = new LinkedHashMap<>();
        List<Card> left = new ArrayList<>(pool);
        left.sort(Comparator.comparingInt(Card::power).reversed());
        for (String slot : List.of("TOP", "BOTTOM", "OUTERWEAR", "SHOES_L", "SHOES_R", "ACCESSORY_L", "ACCESSORY_R")) {
            left.stream().filter(c -> fits(slot, c)).findFirst().ifPresent(c -> {
                board.put(slot, c);
                left.remove(c);
            });
        }
        if (!left.isEmpty()) {
            board.put("HERO", left.remove(0));
        }
        if (!left.isEmpty()) {
            board.put("SUPPORT", left.remove(0));
        }
        return board;
    }

    // ------------------------------------------------------------------ Draft e Deck Battle

    /** Ordem de escolha em serpente: A, B, B, A, A, B, B, A… */
    public static String draftTurn(int pick) {
        int block = (pick + 1) / 2;
        return pick == 0 ? "A" : block % 2 == 1 ? "B" : "A";
    }

    /** Melhor look de até 5 cartas de uma mão para o tema (a IA do oponente e a dica do jogador usam isso). */
    public static List<Card> bestLook(List<Card> hand, Theme t, Function<List<Card>, Look> lookOf) {
        List<Card> best = List.of();
        double bestScore = -1;
        List<Card> tops = hand.stream().filter(c -> "upper_piece".equals(c.category()) || "full_body_piece".equals(c.category())).toList();
        List<Card> bottoms = hand.stream().filter(c -> "lower_piece".equals(c.category())).toList();
        List<Card> shoes = hand.stream().filter(c -> "shoes_piece".equals(c.category())).toList();
        List<Card> accs = hand.stream().filter(c -> "accessory_piece".equals(c.category())).toList();
        for (Card top : tops.isEmpty() ? List.<Card>of() : tops) {
            List<Card> bs = "full_body_piece".equals(top.category()) || bottoms.isEmpty() ? java.util.Collections.singletonList(null) : bottoms;
            for (Card bot : bs) {
                for (Card sh : shoes.isEmpty() ? java.util.Collections.<Card>singletonList(null) : shoes) {
                    for (Card ac : accs.isEmpty() ? java.util.Collections.<Card>singletonList(null) : java.util.stream.Stream.concat(accs.stream(), java.util.stream.Stream.of((Card) null)).toList()) {
                        List<Card> look = new ArrayList<>();
                        look.add(top);
                        if (bot != null) look.add(bot);
                        if (sh != null) look.add(sh);
                        if (ac != null) look.add(ac);
                        double s = score(lookOf.apply(look), t).total();
                        if (s > bestScore) {
                            bestScore = s;
                            best = look;
                        }
                    }
                }
            }
        }
        return best.isEmpty() ? hand.stream().limit(3).toList() : best;
    }

    // ------------------------------------------------------------------ Wardrobe Wars

    public record Wardrobe(String owner, double quality, int styles, int occasions, double originality, double collection, double sustainability, double community) {
    }

    public static List<Clash> wardrobeWars(Wardrobe a, Wardrobe b) {
        List<Clash> out = new ArrayList<>();
        out.add(cat(Msg.t("flairLooks.qualidade_media_do_hypescore"), a.quality(), b.quality()));
        out.add(cat(Msg.t("flairLooks.diversidade_estilos"), a.styles(), b.styles()));
        out.add(cat(Msg.t("flairLooks.versatilidade_ocasioes_atendidas"), a.occasions(), b.occasions()));
        out.add(cat(Msg.t("flairLooks.originalidade_combinacoes_por_peca"), a.originality(), b.originality()));
        out.add(cat(Msg.t("flairLooks.collection_quantidade_raridade"), a.collection(), b.collection()));
        out.add(cat(Msg.t("flairLooks.sustainability_reutilizacao"), a.sustainability(), b.sustainability()));
        out.add(cat(Msg.t("flairLooks.community_engajamento"), a.community(), b.community()));
        return out;
    }

    static Clash cat(String label, double a, double b) {
        return new Clash(label, "", "", Math.round(a * 10) / 10.0, Math.round(b * 10) / 10.0, winner(a, b), List.of(), List.of());
    }

    // ------------------------------------------------------------------ Runway

    /** Nota da FLAIR Runway: 40% IA + 30% compatibilidade temática + 20% comunidade + 10% originalidade (± júri). */
    public static double runwayScore(Look l, Theme t, int stage, long seed) {
        double judge = new Random(seed * 31 + stage * 7L + Objects.hashCode(l.schemeId())).nextGaussian() * 1.5;
        return Math.round((0.4 * l.stats().get("AI") + 0.3 * score(l, t).total() + 0.2 * l.stats().get("COMMUNITY") + 0.1 * l.stats().get("ORIGINALITY") + judge) * 10) / 10.0;
    }

    public static Map<String, Integer> count(List<String> xs) {
        Map<String, Integer> m = new HashMap<>();
        xs.forEach(x -> m.merge(x, 1, Integer::sum));
        return m;
    }
}

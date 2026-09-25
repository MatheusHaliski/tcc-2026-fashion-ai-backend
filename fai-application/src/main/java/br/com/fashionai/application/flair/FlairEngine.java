package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import java.time.LocalDate;
import java.time.Month;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * FLAIR — motor puro (sem banco) das cartas, decks, combos e duelos. Tudo sai dos campos reais da peça; como o
 * sistema não tem "wearstyles" como entidade, EDGE usa os estilos (style_tags) e RANGE as ocasiões (occasion_tags).
 * <ul>
 *   <li>EDGE: 20 + bônus por estilo (statement/avant-garde fortes, basic/minimal leves), até 100</li>
 *   <li>RANGE: 20 por ocasião, até 100</li>
 *   <li>CLOUT: marca cadastrada 90, só nome de marca 60, sem marca 20; +5 por selo</li>
 *   <li>GLOW: foto de estúdio 88; senão a nota de qualidade da foto (RF4) × 100; imagem padrão 55</li>
 *   <li>ART: 10 + fundo de estúdio 35 + detalhe do logo 10 + modelo 3D 20 + foto no manequim 15</li>
 *   <li>SYNC: 100 com a estação atual (hemisfério sul) ou peça de qualquer estação, 50 na vizinha, 0 na oposta</li>
 * </ul>
 * Raridade: RARE (hype ≥ 80 ou preço ≥ R$ 1.500), LIMITED (selo, hype ≥ 65 ou modelo 3D), PREMIUM (preço ≥ R$ 600 ou
 * foto de estúdio) e STANDARD — multiplicadores 1,0 · 1,15 · 1,30 · 1,50. Poder da carta = soma dos 6 atributos ÷ 2 × multiplicador.
 */
public final class FlairEngine {
    private FlairEngine() {
    }

    public static final List<String> STATS = List.of("EDGE", "RANGE", "CLOUT", "GLOW", "ART", "SYNC");
    public static final List<String> DUEL_ROUNDS = List.of("EDGE", "RANGE", "CLOUT", "GLOW", "ART");
    public static final List<String> RARITIES = List.of("STANDARD", "PREMIUM", "LIMITED", "RARE");
    static final Map<String, Double> MULT = Map.of("STANDARD", 1.0, "PREMIUM", 1.15, "LIMITED", 1.30, "RARE", 1.50);

    /** Bônus de EDGE por estilo da taxonomia (os "archetypes" do documento viram os estilos cadastrados). */
    static final Map<String, Integer> EDGE_BONUS = Map.ofEntries(
            Map.entry("statement", 22), Map.entry("avant_garde", 22), Map.entry("edgy", 18), Map.entry("streetwear", 16),
            Map.entry("y2k", 16), Map.entry("grunge", 14), Map.entry("glam", 14), Map.entry("futuristic", 14),
            Map.entry("techwear", 12), Map.entry("luxury", 12), Map.entry("vintage", 10), Map.entry("urban", 10),
            Map.entry("utility", 8), Map.entry("sporty", 8), Map.entry("athleisure", 8), Map.entry("boho", 8),
            Map.entry("romantic", 8), Map.entry("chic", 8), Map.entry("preppy", 6), Map.entry("tailored", 6),
            Map.entry("modern", 6), Map.entry("resort", 6), Map.entry("classic", 4), Map.entry("minimalist", 4), Map.entry("basic", 2));

    static final Set<String> COLD = Set.of("coat", "parka", "jacket", "blazer", "sweater", "sweatshirt", "hoodie", "cardigan",
            "beanie", "gloves", "scarf", "long_boots", "combat_boots", "ankle_boots");
    static final Set<String> WARM = Set.of("shorts", "denim_shorts", "bermuda_shorts", "tank_top", "crop_top", "sandals",
            "flip_flops", "sunglasses", "espadrilles", "skort", "kimono");

    public record Ability(String code, String label, String description) {
    }

    /** Dados da peça que o motor usa (o serviço preenche a partir de WardrobeItem). */
    public record PieceInput(String id, String name, String category, String subcategory, String imageUrl, String colorHex,
                             String brandName, boolean registeredBrand, String brandOwner, List<String> styles,
                             List<String> occasions, String material, Double qualityOverall, boolean studio, boolean logoDetail,
                             boolean model3d, boolean mannequinPhoto, boolean defaultImage, double price, double hype, int seals) {
    }

    public record Card(String id, String name, String category, String subcategory, String imageUrl, String colorHex,
                       String brandName, String brandOwner, List<String> styles, List<String> occasions, String material,
                       String season, Map<String, Integer> stats, String rarity, double multiplier, int power, Ability ability) {
    }

    public record Combo(String code, String label, int points) {
    }

    public record Deck(String schemeId, String title, List<Card> cards, List<Combo> combos, double brandMultiplier,
                       String topBrand, int seasonBonus, int power, Map<String, Integer> avg, List<Ability> abilities) {
    }

    // ------------------------------------------------------------------ estação

    public static String season(LocalDate d) {
        Month m = d.getMonth();
        return switch (m) {
            case DECEMBER, JANUARY, FEBRUARY -> "SUMMER";
            case MARCH, APRIL, MAY -> "AUTUMN";
            case JUNE, JULY, AUGUST -> "WINTER";
            default -> "SPRING";
        };
    }

    static String pieceSeason(String subcategory) {
        if (subcategory == null) {
            return "ALL";
        }
        return COLD.contains(subcategory) ? "WINTER" : WARM.contains(subcategory) ? "SUMMER" : "ALL";
    }

    static int sync(String pieceSeason, String current) {
        if ("ALL".equals(pieceSeason) || pieceSeason.equals(current)) {
            return 100;
        }
        boolean opposite = Set.of(pieceSeason, current).equals(Set.of("SUMMER", "WINTER")) || Set.of(pieceSeason, current).equals(Set.of("SPRING", "AUTUMN"));
        return opposite ? 0 : 50;
    }

    // ------------------------------------------------------------------ carta

    public static Card card(PieceInput p, String currentSeason) {
        List<String> styles = norm(p.styles()), occ = norm(p.occasions());
        int edge = Math.min(100, 20 + styles.stream().mapToInt(s -> EDGE_BONUS.getOrDefault(s, 4)).sum());
        int range = Math.min(100, 20 * occ.size());
        int clout = Math.min(100, (p.registeredBrand() ? 90 : p.brandName() != null && !p.brandName().isBlank() ? 60 : 20) + 5 * p.seals());
        int glow = p.studio() ? 88 : p.defaultImage() ? 55 : (int) Math.round(Math.max(0.3, Math.min(1, p.qualityOverall() == null ? 0.6 : p.qualityOverall())) * 100);
        int art = Math.min(100, 10 + (p.studio() ? 35 : 0) + (p.logoDetail() ? 10 : 0) + (p.model3d() ? 20 : 0) + (p.mannequinPhoto() ? 15 : 0));
        String season = pieceSeason(p.subcategory());
        int sync = sync(season, currentSeason);
        Map<String, Integer> stats = new LinkedHashMap<>();
        stats.put("EDGE", edge);
        stats.put("RANGE", range);
        stats.put("CLOUT", clout);
        stats.put("GLOW", glow);
        stats.put("ART", art);
        stats.put("SYNC", sync);
        String rarity = p.hype() >= 80 || p.price() >= 1500 ? "RARE"
                : p.seals() > 0 || p.hype() >= 65 || p.model3d() ? "LIMITED"
                : p.price() >= 600 || p.studio() ? "PREMIUM" : "STANDARD";
        double mult = MULT.get(rarity);
        int power = (int) Math.round(stats.values().stream().mapToInt(Integer::intValue).sum() / 2.0 * mult);
        return new Card(p.id(), p.name(), p.category(), p.subcategory(), p.imageUrl(), p.colorHex(), p.brandName(),
                p.brandOwner(), styles, occ, p.material(), season, stats, rarity, mult, power,
                ability(rarity, stats, styles));
    }

    static Ability ability(String rarity, Map<String, Integer> s, List<String> styles) {
        return switch (rarity) {
            case "RARE" -> s.get("EDGE") >= 80 ? new Ability("TRENDSETTER", "Trendsetter", Msg.t("flair.dobra_o_edge_desta_carta"))
                    : s.get("GLOW") >= 80 ? new Ability("SPOTLIGHT", "Spotlight", Msg.t("flair.n30_de_glow_para_todo"))
                    : new Ability("ICON", Msg.t("flair.icone"), Msg.t("flair.n20_no_poder_do_deck"));
            case "LIMITED" -> styles.contains("statement") || styles.contains("avant_garde")
                    ? new Ability("STATEMENT_LOCK", Msg.t("flair.statement_lock"), Msg.t("flair.bloqueia_a_carta_mais_forte"))
                    : styles.contains("streetwear") || styles.contains("urban")
                    ? new Ability("HYPE_BOOST", Msg.t("flair.hype_boost"), Msg.t("flair.n15_de_edge_para_cada")) : null;
            case "PREMIUM" -> new Ability("SHIELD", "Escudo", Msg.t("flair.rodada_perdida_por_menos_de"));
            default -> null;
        };
    }

    // ------------------------------------------------------------------ deck

    public static Deck deck(String schemeId, String title, List<Card> cards, String schemeSeason, String currentSeason) {
        List<Combo> combos = new ArrayList<>();
        if (!cards.isEmpty()) {
            Map<String, Integer> styleCount = count(cards.stream().map(Card::styles).toList());
            int style = styleCount.values().stream().filter(c -> c >= 2).mapToInt(c -> 8 * c).sum();
            if (style > 0) {
                combos.add(new Combo("STYLE_SYNERGY", Msg.t("flair.sinergia_de_estilo"), Math.min(60, style)));
            }
            Set<String> shared = new HashSet<>(cards.get(0).occasions());
            cards.forEach(c -> shared.retainAll(c.occasions()));
            if (!shared.isEmpty() && cards.size() >= 2) {
                combos.add(new Combo("OCCASION_SYNERGY", Msg.t("flair.sinergia_de_ocasiao"), Math.min(48, 12 * shared.size())));
            }
            Map<String, Integer> seasons = count(cards.stream().map(c -> List.of(c.season())).toList());
            seasons.remove("ALL");
            if (seasons.values().stream().anyMatch(c -> c >= 3)) {
                combos.add(new Combo("SEASON_SWEEP", Msg.t("flair.varredura_de_estacao"), 25));
            }
            long materials = cards.stream().map(Card::material).filter(m -> m != null && !m.isBlank()).distinct().count();
            if (materials >= 3) {
                combos.add(new Combo("MATERIAL_CONTRAST", Msg.t("flair.contraste_de_materiais"), (int) Math.min(36, 6 * materials)));
            }
        }
        Map<String, Integer> brands = count(cards.stream().map(c -> c.brandName() == null || c.brandName().isBlank() ? List.<String>of() : List.of(c.brandName().toLowerCase(Locale.ROOT))).toList());
        String topBrand = brands.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        int same = topBrand == null ? 0 : brands.get(topBrand);
        double brandMult = same >= 4 ? 1.35 : same == 3 ? 1.20 : same == 2 ? 1.10 : 1.0;
        int seasonBonus = schemeSeason != null && schemeSeason.equals(currentSeason) ? 15 : 0;
        double avgPower = cards.stream().mapToInt(Card::power).average().orElse(0);
        int comboPts = combos.stream().mapToInt(Combo::points).sum();
        List<Ability> abilities = cards.stream().map(Card::ability).filter(a -> a != null).toList();
        boolean icon = abilities.stream().anyMatch(a -> a.code().equals("ICON"));
        int power = (int) Math.round((avgPower + comboPts + seasonBonus) * brandMult * (icon ? 1.2 : 1));
        Map<String, Integer> avg = new LinkedHashMap<>();
        STATS.forEach(s -> avg.put(s, (int) Math.round(cards.stream().mapToInt(c -> c.stats().get(s)).average().orElse(0))));
        return new Deck(schemeId, title, cards, combos, brandMult, topBrand, seasonBonus, power, avg, abilities);
    }

    private static Map<String, Integer> count(Collection<List<String>> lists) {
        Map<String, Integer> m = new HashMap<>();
        lists.forEach(l -> new HashSet<>(l).forEach(v -> m.merge(v, 1, Integer::sum)));
        return m;
    }

    private static List<String> norm(List<String> v) {
        return v == null ? List.of() : v.stream().filter(x -> x != null && !x.isBlank()).map(x -> x.trim().toLowerCase(Locale.ROOT)).distinct().toList();
    }

    // ------------------------------------------------------------------ duelo

    public record Round(String stat, double a, double b, String winner, List<String> notes) {
    }

    public record DuelResult(List<Round> rounds, int winsA, int winsB, String winner) {
    }

    /**
     * Duelo de estilo em 5 rodadas (EDGE, RANGE, CLOUT, GLOW, ART): cada lado revela a média do atributo no deck, com
     * as habilidades das cartas, +8 com a maioria das cartas em SYNC, parte da Sinergia de estilo no EDGE e a sinergia
     * de marca a 75% da força. Vence quem ganhar mais rodadas; empate não dá vitória a ninguém.
     */
    public static DuelResult duel(Deck a, Deck b) {
        List<Round> rounds = new ArrayList<>();
        int wa = 0, wb = 0;
        for (String stat : DUEL_ROUNDS) {
            List<String> notes = new ArrayList<>();
            double va = side(a, b, stat, notes, "A"), vb = side(b, a, stat, notes, "B");
            String w = Math.abs(va - vb) < 0.5 ? "DRAW" : va > vb ? "A" : "B";
            if (!"DRAW".equals(w)) {
                Deck loser = "A".equals(w) ? b : a;
                if (Math.abs(va - vb) < 10 && loser.abilities().stream().anyMatch(x -> x.code().equals("SHIELD"))) {
                    notes.add(Msg.t("flair.escudo_de_derrota_por_menos", ("A".equals(w) ? "B" : "A")));
                    w = "DRAW";
                }
            }
            if ("A".equals(w)) {
                wa++;
            } else if ("B".equals(w)) {
                wb++;
            }
            rounds.add(new Round(stat, Math.round(va * 10) / 10.0, Math.round(vb * 10) / 10.0, w, notes));
        }
        return new DuelResult(rounds, wa, wb, wa == wb ? "DRAW" : wa > wb ? "A" : "B");
    }

    static double side(Deck me, Deck other, String stat, List<String> notes, String tag) {
        List<Card> cards = new ArrayList<>(me.cards());
        if (cards.isEmpty()) {
            return 0;
        }
        if ("EDGE".equals(stat) && other.abilities().stream().anyMatch(x -> x.code().equals("STATEMENT_LOCK")) && cards.size() > 1) {
            Card strongest = cards.stream().max((x, y) -> Integer.compare(x.stats().get("EDGE"), y.stats().get("EDGE"))).get();
            cards.remove(strongest);
            notes.add(Msg.t("flair.statement_lock_bloqueou", strongest.name(), tag));
        }
        double sum = 0;
        long street = cards.stream().filter(c -> c.styles().contains("streetwear") || c.styles().contains("urban")).count();
        for (Card c : cards) {
            double v = c.stats().get(stat);
            if ("EDGE".equals(stat) && c.ability() != null && c.ability().code().equals("TRENDSETTER")) {
                v *= 2;
                notes.add(Msg.t("flair.trendsetter_dobrou_o_edge_de", c.name(), tag));
            }
            if ("EDGE".equals(stat) && c.ability() != null && c.ability().code().equals("HYPE_BOOST")) {
                v += 15 * Math.max(0, street - 1);
            }
            sum += v;
        }
        double val = sum / cards.size();
        if ("GLOW".equals(stat) && me.abilities().stream().anyMatch(x -> x.code().equals("SPOTLIGHT"))) {
            val += 30;
            notes.add(Msg.t("flair.spotlight_30_glow", tag));
        }
        long synced = me.cards().stream().filter(c -> c.stats().get("SYNC") == 100).count();
        if (synced * 2 > me.cards().size()) {
            val += 8;
        }
        if ("EDGE".equals(stat)) {
            val += me.combos().stream().filter(c -> c.code().equals("STYLE_SYNERGY")).mapToInt(c -> c.points() / 4).sum();
        }
        return val * (1 + (me.brandMultiplier() - 1) * 0.75);
    }

    // ------------------------------------------------------------------ batalha de ocasião

    /** Nota da batalha de ocasião do dia: cobertura da ocasião + RANGE, EDGE e GLOW médios + combos. */
    public static double occasionScore(Deck d, String occasion) {
        if (d.cards().isEmpty()) {
            return 0;
        }
        double fit = d.cards().stream().filter(c -> c.occasions().contains(occasion)).count() / (double) d.cards().size();
        double combos = d.combos().stream().mapToInt(Combo::points).sum();
        return Math.round((fit * 100 * 0.4 + d.avg().get("RANGE") * 0.2 + d.avg().get("EDGE") * 0.2 + d.avg().get("GLOW") * 0.2 + combos * 0.3) * 10) / 10.0;
    }

    /** Rank do jogador pelos pontos (FlairRank). */
    public static Map<String, Object> rank(int points) {
        String[][] ranks = {{"0", "ROOKIE", "Rookie"}, {"500", "TRENDSETTER", "Trendsetter"}, {"1500", "STYLE_MAVEN", Msg.t("flair.style_maven")},
                {"4000", "FASHION_ARCHITECT", Msg.t("flair.fashion_architect")}, {"8000", "ICONIC", "Iconic"}, {"15000", "LEGEND", "Legend"}};
        int i = 0;
        for (int k = 0; k < ranks.length; k++) {
            if (points >= Integer.parseInt(ranks[k][0])) {
                i = k;
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", ranks[i][1]);
        m.put("label", ranks[i][2]);
        m.put("points", points);
        m.put("next", i + 1 < ranks.length ? Map.of("label", ranks[i + 1][2], "at", Integer.parseInt(ranks[i + 1][0])) : null);
        return m;
    }
}

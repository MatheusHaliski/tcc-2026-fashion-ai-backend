package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Ability;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Hype;
import br.com.fashionai.application.flair.FlairEngine.PieceInput;
import br.com.fashionai.domain.model.enums.HypeLevel;

import java.time.LocalDate;
import java.time.Month;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.FlairEngine.LIMITED_RARITY_MIN;
import static br.com.fashionai.application.flair.FlairEngine.RARE_RARITY_MIN;

/**
 * Regras da carta do {@link FlairEngine}: estação (hemisfério sul) e SYNC, os seis atributos tirados da peça, a
 * raridade pelo Hype v2 público (nunca pelo preço) e a habilidade de cada raridade.
 */
final class FlairCardRules {
    private FlairCardRules() {
    }

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
            "beanie", "gloves", "scarf", "long_boots", "combat_boots", "ankle_boots", "boots");
    static final Set<String> WARM = Set.of("shorts", "denim_shorts", "bermuda_shorts", "tank_top", "crop_top", "top", "sandals",
            "flip_flops", "sunglasses", "espadrilles", "skort", "kimono");

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
        Hype hype = p.hype() == null ? Hype.NONE : p.hype();
        String rarity = rarity(hype, p.seals(), p.model3d(), p.studio());
        double mult = MULT.get(rarity);
        int power = (int) Math.round(stats.values().stream().mapToInt(Integer::intValue).sum() / 2.0 * mult);
        return new Card(p.id(), p.name(), p.category(), p.subcategory(), p.imageUrl(), p.colorHex(), p.brandName(),
                p.brandOwner(), styles, occ, p.material(), season, stats, rarity, mult, power,
                ability(rarity, stats, styles), hype);
    }

    /** Raridade da carta (P2-18): dimensão RARITY + faixa do Hype v2 público; preço nunca entra. */
    public static String rarity(Hype hype, int seals, boolean model3d, boolean studio) {
        Hype h = hype == null ? Hype.NONE : hype;
        if (h.rarityAtLeast(RARE_RARITY_MIN) && h.atLeast(HypeLevel.NICHE)) {
            return "RARE";
        }
        if (h.rarityAtLeast(LIMITED_RARITY_MIN) || seals > 0 || model3d) {
            return "LIMITED";
        }
        return h.atLeast(HypeLevel.HOT) || studio ? "PREMIUM" : "STANDARD";
    }

    static Ability ability(String rarity, Map<String, Integer> s, List<String> styles) {
        return switch (rarity) {
            case "RARE" -> s.get("EDGE") >= 80 ? new Ability("TRENDSETTER", "Trendsetter", Msg.t("flair.dobra_o_edge_desta_carta"))
                    : s.get("GLOW") >= 80 ? new Ability("SPOTLIGHT", "Spotlight", Msg.t("flair.n30_de_glow_para_todo"))
                    : new Ability("ICON", Msg.t("flair.icone"), Msg.t("flair.n20_no_poder_do_deck"));
            case "LIMITED" -> styles.contains("statement") || styles.contains("avant_garde")
                    ? new Ability("STATEMENT_LOCK", Msg.t("flair.statement_lock"), Msg.t("flair.bloqueia_a_carta_mais_forte"))
                    : styles.contains("streetwear") || styles.contains("urban")
                    // código HYPE_BOOST mantido (API/duelo); o nome exibido é "Street Boost": não deriva do HypeScore
                    ? new Ability("HYPE_BOOST", Msg.t("hypeFlair.street_boost"), Msg.t("flair.n15_de_edge_para_cada")) : null;
            case "PREMIUM" -> new Ability("SHIELD", "Escudo", Msg.t("flair.rodada_perdida_por_menos_de"));
            default -> null;
        };
    }

    private static List<String> norm(List<String> v) {
        return v == null ? List.of() : v.stream().filter(x -> x != null && !x.isBlank()).map(x -> x.trim().toLowerCase(Locale.ROOT)).distinct().toList();
    }
}

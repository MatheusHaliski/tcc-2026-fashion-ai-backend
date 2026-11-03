package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.HypeLevel;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
 * Raridade (RF53 · P2-18) — vem do HypeScore v2 PÚBLICO da peça ({@link Hype}), nunca do preço (sem pay-to-win):
 * <ul>
 *   <li>RARE: dimensão RARITY ≥ {@value #RARE_RARITY_MIN} (frequência do modelo entre os guarda-roupas) e faixa ≥ Nicho
 *   — a mesma régua do selo de Hype "Raro"</li>
 *   <li>LIMITED: RARITY ≥ {@value #LIMITED_RARITY_MIN} (modelo pouco comum), selo ou modelo 3D</li>
 *   <li>PREMIUM: faixa ≥ Em alta (relevância pública) ou foto de estúdio</li>
 *   <li>STANDARD: o resto. Sem Hype público (privado, dados insuficientes, não calculado) as regras de Hype só não
 *   valem: nada vira 0 nem rebaixa a carta.</li>
 * </ul>
 * Multiplicadores 1,0 · 1,15 · 1,30 · 1,50. Poder da carta = soma dos 6 atributos ÷ 2 × multiplicador.
 */
public final class FlairEngine {
    private FlairEngine() {
    }

    public static final List<String> STATS = List.of("EDGE", "RANGE", "CLOUT", "GLOW", "ART", "SYNC");
    public static final List<String> DUEL_ROUNDS = List.of("EDGE", "RANGE", "CLOUT", "GLOW", "ART");
    public static final List<String> RARITIES = List.of("STANDARD", "PREMIUM", "LIMITED", "RARE");

    /** Raridade do modelo (0–100) a partir da qual a carta é RARE (com faixa ≥ Nicho) — igual ao selo de Hype "Raro". */
    public static final double RARE_RARITY_MIN = 75;
    /** Raridade do modelo a partir da qual a carta é LIMITED. */
    public static final double LIMITED_RARITY_MIN = 60;

    public record Ability(String code, String label, String description) {
    }

    /**
     * HypeScore v2 PÚBLICO da peça, como o jogo enxerga: {@code score} e {@code level} só com status AVAILABLE;
     * {@code rarity} = dimensão RARITY (frequência do modelo, estrutural — existe mesmo com dados insuficientes). Item
     * privado, só para seguidores ou sem cálculo entra como {@link #NONE}: a mesma carta tem o mesmo poder para qualquer
     * jogador (justo) e nenhum Hype pessoal vaza para o adversário (privacidade). Nulo = sem dado, nunca 0.
     */
    public record Hype(Double score, String level, Double rarity) {
        public static final Hype NONE = new Hype(null, null, null);

        /** Do estado gravado pelo job (hype_scores) para o jogo: só {@code publicEligible} conta. */
        public static Hype of(boolean publicEligible, String status, Double score, String level, Double rarity) {
            if (!publicEligible) {
                return NONE;
            }
            boolean available = "AVAILABLE".equals(status) && score != null && level != null;
            return new Hype(available ? score : null, available ? level : null, rarity);
        }

        /** Faixa v2 pelo menos {@code min} (sem faixa = falso). */
        public boolean atLeast(HypeLevel min) {
            if (level == null) {
                return false;
            }
            try {
                return HypeLevel.valueOf(level).ordinal() >= min.ordinal();
            } catch (IllegalArgumentException e) {
                return false;   // faixa desconhecida (versão nova do algoritmo): não conta
            }
        }

        boolean rarityAtLeast(double min) {
            return rarity != null && rarity >= min;
        }
    }

    /**
     * Dados da peça que o motor usa (o serviço preenche a partir de WardrobeItem). O preço saiu da entrada: não decide
     * raridade nem poder (sem pay-to-win). {@code hype} = Hype v2 público ({@link Hype#NONE} sem dado).
     */
    public record PieceInput(String id, String name, String category, String subcategory, String imageUrl, String colorHex,
                             String brandName, boolean registeredBrand, String brandOwner, List<String> styles,
                             List<String> occasions, String material, Double qualityOverall, boolean studio, boolean logoDetail,
                             boolean model3d, boolean mannequinPhoto, boolean defaultImage, Hype hype, int seals) {
    }

    /** Carta. {@code hype} (aditivo): o Hype v2 público que decidiu a raridade, para a interface explicar com texto. */
    public record Card(String id, String name, String category, String subcategory, String imageUrl, String colorHex,
                       String brandName, String brandOwner, List<String> styles, List<String> occasions, String material,
                       String season, Map<String, Integer> stats, String rarity, double multiplier, int power, Ability ability,
                       Hype hype) {
    }

    public record Combo(String code, String label, int points) {
    }

    public record Deck(String schemeId, String title, List<Card> cards, List<Combo> combos, double brandMultiplier,
                       String topBrand, int seasonBonus, int power, Map<String, Integer> avg, List<Ability> abilities) {
    }

    // ------------------------------------------------------------------ estação

    public static String season(LocalDate d) {
        return FlairCardRules.season(d);
    }

    static String pieceSeason(String subcategory) {
        return FlairCardRules.pieceSeason(subcategory);
    }

    static int sync(String pieceSeason, String current) {
        return FlairCardRules.sync(pieceSeason, current);
    }

    // ------------------------------------------------------------------ carta

    public static Card card(PieceInput p, String currentSeason) {
        return FlairCardRules.card(p, currentSeason);
    }

    /** Raridade da carta (P2-18): dimensão RARITY + faixa do Hype v2 público; preço nunca entra. */
    public static String rarity(Hype hype, int seals, boolean model3d, boolean studio) {
        return FlairCardRules.rarity(hype, seals, model3d, studio);
    }

    // ------------------------------------------------------------------ deck

    public static Deck deck(String schemeId, String title, List<Card> cards, String schemeSeason, String currentSeason) {
        return FlairDeckRules.deck(schemeId, title, cards, schemeSeason, currentSeason);
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
        return FlairDuelRules.duel(a, b);
    }

    static double side(Deck me, Deck other, String stat, List<String> notes, String tag) {
        return FlairDuelRules.side(me, other, stat, notes, tag);
    }

    // ------------------------------------------------------------------ batalha de ocasião

    /** Nota da batalha de ocasião do dia: cobertura da ocasião + RANGE, EDGE e GLOW médios + combos. */
    public static double occasionScore(Deck d, String occasion) {
        return FlairDuelRules.occasionScore(d, occasion);
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

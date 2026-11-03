package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;

/**
 * Motor dos modos do FLAIR: <b>PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO</b>. Um look (esquema) tem 10 atributos —
 * HypeScore, Style, Color Harmony, Occasion Fit, Originality, Brand Power, Rarity, Trend, Community e AI Score —
 * calculados das peças (cartas), do HypeScore e do engajamento. O <b>tema</b> da rodada muda os pesos, e sinergias
 * (combos), cor, diversidade e condições do tabuleiro alteram o resultado. Tudo é determinístico e sem aposta (as
 * recompensas vêm do sistema).
 *
 * <p>HYPE (RF53 · P2-17): é o HypeScore v2 <b>público</b> do look (relevância, não qualidade) e só um atributo entre
 * dez — peso 1 na nota geral (como os demais) e, no tema, nunca acima do menor peso entre os outros atributos
 * ({@link #weight}). Sem Hype público (privado, dados insuficientes, não calculado) vale {@value #NEUTRAL_HYPE}
 * (neutro): "sem dados" nunca vira 0 nem herda o poder das cartas.</p>
 */
public final class FlairLooks {
    private FlairLooks() {
    }

    public static final List<String> STATS = List.of("HYPE", "STYLE", "COLOR", "OCCASION", "ORIGINALITY", "BRAND", "RARITY", "TREND", "COMMUNITY", "AI");
    public static final Map<String, String> LABELS = new LinkedHashMap<>();

    public static final Set<String> OUTERWEAR = Set.of("jacket", "coat", "blazer", "parka", "cardigan", "trench_coat", "puffer_jacket", "denim_jacket", "leather_jacket", "bomber_jacket", "windbreaker", "vest");
    /** HYPE de um look sem Hype v2 público: neutro (nem prêmio nem punição). */
    public static final int NEUTRAL_HYPE = 50;

    // ------------------------------------------------------------------ tipos

    /** {@code hype}: HypeScore v2 PÚBLICO do look (nulo = sem Hype público → {@link #NEUTRAL_HYPE}). */
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

    public static final Map<String, Theme> THEMES = new LinkedHashMap<>();

    public static final List<String> SQUAD_SITUATIONS = List.of("DATE_NIGHT", "BUSINESS_MEETING", "MUSIC_FESTIVAL", "BEACH_CLUB", "RED_CARPET");

    public static Theme theme(String code) {
        return THEMES.getOrDefault(code == null ? "" : code.toUpperCase(Locale.ROOT), THEMES.get("FESTIVAL_NOITE"));
    }

    /** Tema sorteado de forma determinística por uma semente (data + ids), para o resultado poder ser auditado. */
    public static Theme drawTheme(long seed) {
        List<Theme> all = new ArrayList<>(THEMES.values());
        return all.get(Math.floorMod(new Random(seed).nextInt(), all.size()));
    }

    /** Família de cor a partir do hex: neutral (baixa saturação, preto/branco/cinza/bege) ou faixa de matiz. */
    public static String family(String hex) {
        return FlairLookColors.family(hex);
    }

    /**
     * Peso de um atributo no tema. O HYPE nunca pesa mais que o menor peso entre os outros nove (P2-17): relevância é
     * contexto, não critério dominante — nenhum tema transforma o jogo em concurso de popularidade.
     */
    public static double weight(Theme t, String stat) {
        return FlairLookStats.weight(t, stat);
    }

    /** Sinergias entre peças (FLAIR Combo Battle): cada uma soma pontos num atributo do look. */
    public static List<Synergy> synergies(List<Card> cards, Theme theme) {
        return FlairLookStats.synergies(cards, theme);
    }

    public static Look look(LookInput in) {
        return FlairLookStats.look(in);
    }

    /** Pontuação do look no tema: pesos do tema sobre os 10 atributos + ocasião/estilo do tema + condições. */
    public static Score score(Look l, Theme t) {
        return FlairLookScoring.score(l, t);
    }

    /** Battle of Looks: Look A × Look B no tema sorteado — o contexto muda os pesos, não só o HypeScore. */
    public static Clash battle(Look a, Look b, Theme t) {
        return FlairLookScoring.battle(a, b, t);
    }

    public static String winner(double a, double b) {
        return Math.abs(a - b) < 0.5 ? "DRAW" : a > b ? "A" : "B";
    }

    /** Melhor escalação: cada situação recebe um look diferente, maximizando a soma (força bruta, até 5! = 120). */
    public static List<Integer> assign(List<Look> looks, List<Theme> situations) {
        return FlairSquadRules.assign(looks, situations);
    }

    public static List<Clash> squad(List<Look> a, List<Look> b, List<Theme> situations) {
        return FlairSquadRules.squad(a, b, situations);
    }

    public static final List<String[]> DIVISIONS = List.of(new String[]{"0", "BRONZE", "Bronze"}, new String[]{"6", "SILVER", "Silver"},
            new String[]{"12", "GOLD", "Gold"}, new String[]{"18", "PLATINUM", "Platinum"}, new String[]{"24", "DIAMOND", "Diamond"},
            new String[]{"30", "FLAIR_ELITE", Msg.k("flairLooks.flair_elite")});

    public static Map<String, Object> division(int points) {
        return FlairSquadRules.division(points);
    }

    /** Partida da Fashion League: titulares por situação, até 2 substituições por reservas e cartas especiais (+3). */
    public static List<Clash> leagueMatch(List<Look> startersA, List<Look> reservesA, List<Card> specialsA, List<Look> startersB,
                                          List<Look> reservesB, List<Card> specialsB, List<Theme> situations) {
        return FlairSquadRules.leagueMatch(startersA, reservesA, specialsA, startersB, reservesB, specialsB, situations);
    }

    /** Team Harmony: estética compatível entre os dois looks da dupla (estilo, cor e ocasião). */
    public static int harmony(Look a, Look b) {
        return FlairTeamRules.harmony(a, b);
    }

    public static double tagScore(Look a, Look b, Theme t) {
        return FlairTeamRules.tagScore(a, b, t);
    }

    public static double comboScore(Look l, Theme t) {
        return FlairLookScoring.comboScore(l, t);
    }

    public record Boss(String code, String name, String emoji, String theme, Map<String, Integer> stats, String lesson) {
    }

    public static final Map<String, Boss> BOSSES = new LinkedHashMap<>();

    /** O boss tem os atributos fixos acima e 72 nos demais; a luta usa o tema preferido dele. */
    public static Look bossLook(Boss b) {
        return FlairLookScoring.bossLook(b);
    }

    /** Boss não tem cartas: a pontuação dele é só a média ponderada dos atributos no tema. */
    public static double bossScore(Look boss, Theme t) {
        return FlairLookScoring.bossScore(boss, t);
    }

    public static final Map<String, String> ROLES = new LinkedHashMap<>();

    static {
        FlairLookCatalog.labels();
        FlairLookCatalog.themes();
        FlairLookCatalog.bosses();
        FlairLookCatalog.roles();
    }

    public static int roleValue(Look l, String role) {
        return FlairTeamRules.roleValue(l, role);
    }

    public static Map<String, Object> teamRating(Map<String, Look> roster) {
        return FlairTeamRules.teamRating(roster);
    }

    public static final List<String> BOARD = List.of("ACCESSORY_L", "TOP", "ACCESSORY_R", "BOTTOM", "HERO", "OUTERWEAR", "SHOES_L", "SUPPORT", "SHOES_R");

    /** Avalia o tabuleiro 3×3: poder das cartas na posição certa, HERO ×1,25, SUPPORT e bônus de adjacência. */
    public static Map<String, Object> chess(Map<String, Card> board) {
        return FlairChessRules.chess(board);
    }

    /** Monta o melhor tabuleiro possível com um conjunto de cartas (IA do oponente e sugestão para o jogador). */
    public static Map<String, Card> autoBoard(List<Card> pool) {
        return FlairChessRules.autoBoard(pool);
    }

    /** Ordem de escolha em serpente: A, B, B, A, A, B, B, A… */
    public static String draftTurn(int pick) {
        return FlairDraftRules.draftTurn(pick);
    }

    /** Melhor look de até 5 cartas de uma mão para o tema (a IA do oponente e a dica do jogador usam isso). */
    public static List<Card> bestLook(List<Card> hand, Theme t, Function<List<Card>, Look> lookOf) {
        return FlairDraftRules.bestLook(hand, t, lookOf);
    }

    /**
     * Guarda-roupa no Wardrobe Wars. {@code relevance}: média do HypeScore v2 PÚBLICO dos looks (nulo = nenhum look com
     * Hype público). {@code quality} fica só por compatibilidade da API (deprecado: era a "qualidade média do HypeScore"
     * v1, um juízo de qualidade) e espelha a relevância usada na rodada ({@link #NEUTRAL_HYPE} sem dados).
     */
    public record Wardrobe(String owner, double quality, int styles, int occasions, double originality, double collection, double sustainability,
                           double community, Double relevance) {
        public Wardrobe(String owner, Double relevance, int styles, int occasions, double originality, double collection, double sustainability,
                        double community) {
            this(owner, relevance == null ? NEUTRAL_HYPE : relevance, styles, occasions, originality, collection, sustainability, community, relevance);
        }
    }

    public static List<Clash> wardrobeWars(Wardrobe a, Wardrobe b) {
        return FlairWardrobeRules.wardrobeWars(a, b);
    }

    /** Nota da FLAIR Runway: 40% IA + 30% compatibilidade temática + 20% comunidade + 10% originalidade (± júri). */
    public static double runwayScore(Look l, Theme t, int stage, long seed) {
        return FlairLookScoring.runwayScore(l, t, stage, seed);
    }

    public static Map<String, Integer> count(List<String> xs) {
        return FlairLookStats.count(xs);
    }
}

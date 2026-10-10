package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF53 — Selos de Hype FashionAI: automáticos e DERIVADOS do HypeScore v2 atual. Nada é salvo, nada é emitido por
 * marca ou celebridade e nada volta para o cálculo (o Hype alimenta os selos; selo nunca alimenta o Hype).
 *
 * <table>
 *   <tr><th>Código</th><th>Regra (sempre com status AVAILABLE e {@code publicEligible})</th></tr>
 *   <tr><td>VIRAL</td><td>faixa = VIRAL</td></tr>
 *   <tr><td>TRENDING</td><td>faixa ∈ {HOT, TRENDING} e momento ∈ {RISING, EMERGING}</td></tr>
 *   <tr><td>EMERGING</td><td>momento = EMERGING (e não VIRAL/TRENDING)</td></tr>
 *   <tr><td>CLASSIC</td><td>momento = CLASSIC, ou longevidade ≥ {@value #CLASSIC_LONGEVITY_MIN} e faixa ≥ {@link #CLASSIC_LEVEL_MIN}</td></tr>
 *   <tr><td>RARE</td><td>raridade ≥ {@value #RARE_RARITY_MIN} e faixa ≥ {@link #RARE_LEVEL_MIN}</td></tr>
 * </table>
 *
 * Prioridade (ordem da lista): VIRAL &gt; TRENDING &gt; EMERGING &gt; CLASSIC &gt; RARE. O card mostra no máximo
 * {@value #CARD_MAX}; o detalhe mostra todos. Item privado não tem selo de Hype (o Hype dele é só estrutural/pessoal).
 */
public final class HypeSeals {
    public static final String VIRAL = "VIRAL";
    public static final String TRENDING = "TRENDING";
    public static final String EMERGING = "EMERGING";
    public static final String CLASSIC = "CLASSIC";
    public static final String RARE = "RARE";
    /** Ordem de prioridade dos códigos (a lista devolvida segue esta ordem). */
    public static final List<String> CODES = List.of(VIRAL, TRENDING, EMERGING, CLASSIC, RARE);

    /** Selos de Hype exibidos no card (frente); o detalhe mostra todos. */
    public static final int CARD_MAX = 2;
    /** TRENDING: faixas que contam como "em alta" e momentos que contam como "subindo". */
    public static final Set<HypeLevel> TRENDING_LEVELS = Set.of(HypeLevel.HOT, HypeLevel.TRENDING);
    public static final Set<HypeMomentum> TRENDING_MOMENTUM = Set.of(HypeMomentum.RISING, HypeMomentum.EMERGING);
    /** CLASSIC sem o momento CLASSIC: relevância sustentada (longevidade 0–100) com faixa mínima. */
    public static final double CLASSIC_LONGEVITY_MIN = 70;
    public static final HypeLevel CLASSIC_LEVEL_MIN = HypeLevel.RELEVANT;
    /** RARE: raridade do modelo (0–100, nunca "poucas interações") com faixa mínima, para não premiar item sem tração. */
    public static final double RARE_RARITY_MIN = 75;
    public static final HypeLevel RARE_LEVEL_MIN = HypeLevel.NICHE;

    private HypeSeals() {
    }

    /** Códigos conquistados, na ordem de prioridade; vazio quando nada (ou sem Hype público disponível). */
    public static List<String> of(HypeScoreCurrent c) {
        List<String> out = new ArrayList<>();
        if (!eligible(c)) {
            return out;
        }
        HypeLevel level = c.getLevel();
        HypeMomentum momentum = c.getMomentum();
        if (level == HypeLevel.VIRAL) {
            out.add(VIRAL);
        }
        if (level != null && TRENDING_LEVELS.contains(level) && momentum != null && TRENDING_MOMENTUM.contains(momentum)) {
            out.add(TRENDING);
        }
        if (momentum == HypeMomentum.EMERGING && !out.contains(VIRAL) && !out.contains(TRENDING)) {
            out.add(EMERGING);
        }
        if (momentum == HypeMomentum.CLASSIC || (dim(c, "longevity") >= CLASSIC_LONGEVITY_MIN && atLeast(level, CLASSIC_LEVEL_MIN))) {
            out.add(CLASSIC);
        }
        if (dim(c, "rarity") >= RARE_RARITY_MIN && atLeast(level, RARE_LEVEL_MIN)) {
            out.add(RARE);
        }
        return out;
    }

    /** Os {@value #CARD_MAX} primeiros por prioridade (o que cabe no card). */
    public static List<String> forCard(HypeScoreCurrent c) {
        List<String> all = of(c);
        return all.size() > CARD_MAX ? List.copyOf(all.subList(0, CARD_MAX)) : all;
    }

    /**
     * Progresso de todos os selos. O texto traduzido continua disponível aos clientes antigos; requirements fornece
     * metas numéricas e grupos ALL/ANY para a interface explicar a regra sem interpretar aquele texto.
     */
    public static List<Map<String, Object>> progress(HypeScoreCurrent c, int[] levelThresholds) {
        List<String> earned = of(c);
        List<Map<String, Object>> out = new ArrayList<>();
        for (String code : CODES) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", code);
            m.put("earned", earned.contains(code));
            m.put("criteria", criteria(code, levelThresholds));
            boolean available = c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
            m.put("available", available);
            m.put("publicEligible", c != null && c.isPublicEligible());
            m.put("requirements", requirements(code, c, levelThresholds, available));
            out.add(m);
        }
        return out;
    }

    private static Map<String, Object> requirements(String code, HypeScoreCurrent c, int[] thresholds, boolean available) {
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("rule", CLASSIC.equals(code) ? "ANY" : "ALL");
        switch (code) {
            case VIRAL -> group.put("score", score(c, thresholds, HypeLevel.VIRAL, available));
            case TRENDING -> {
                group.put("score", score(c, thresholds, HypeLevel.HOT, available));
                group.put("levels", levels(c, List.of(HypeLevel.HOT, HypeLevel.TRENDING), available));
                group.put("momentum", momentum(c, List.of(HypeMomentum.RISING, HypeMomentum.EMERGING), available));
            }
            case EMERGING -> {
                group.put("momentum", momentum(c, List.of(HypeMomentum.EMERGING), available));
                group.put("levels", levels(c, List.of(HypeLevel.LOW_SIGNAL, HypeLevel.NICHE, HypeLevel.RELEVANT), available));
            }
            case CLASSIC -> {
                Map<String, Object> classicMoment = new LinkedHashMap<>();
                classicMoment.put("rule", "ALL");
                classicMoment.put("momentum", momentum(c, List.of(HypeMomentum.CLASSIC), available));
                Map<String, Object> lasting = new LinkedHashMap<>();
                lasting.put("rule", "ALL");
                lasting.put("score", score(c, thresholds, CLASSIC_LEVEL_MIN, available));
                lasting.put("dimensions", List.of(dimension(c, "LONGEVITY", CLASSIC_LONGEVITY_MIN, available)));
                group.put("alternatives", List.of(classicMoment, lasting));
            }
            case RARE -> {
                group.put("score", score(c, thresholds, RARE_LEVEL_MIN, available));
                group.put("dimensions", List.of(dimension(c, "RARITY", RARE_RARITY_MIN, available)));
            }
            default -> { }
        }
        return group;
    }

    private static Map<String, Object> score(HypeScoreCurrent c, int[] thresholds, HypeLevel minimum, boolean available) {
        int target = threshold(thresholds, minimum);
        // As faixas do HypeScore usam o inteiro arredondado. A meta e os pontos faltantes usam a mesma régua.
        Long current = available ? Math.round(c.getScore().doubleValue()) : null;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("current", current); value.put("target", target); value.put("maximum", 100);
        value.put("missing", current == null ? null : Math.max(0, target - current));
        value.put("met", available ? atLeast(c.getLevel(), minimum) : null);
        return value;
    }

    private static Map<String, Object> momentum(HypeScoreCurrent c, List<HypeMomentum> accepted, boolean available) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("current", available && c.getMomentum() != null ? c.getMomentum().name() : null);
        value.put("accepted", accepted.stream().map(Enum::name).toList());
        value.put("met", available ? c.getMomentum() != null && accepted.contains(c.getMomentum()) : null);
        return value;
    }

    private static Map<String, Object> levels(HypeScoreCurrent c, List<HypeLevel> accepted, boolean available) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("current", available && c.getLevel() != null ? c.getLevel().name() : null);
        value.put("accepted", accepted.stream().map(Enum::name).toList());
        value.put("met", available ? c.getLevel() != null && accepted.contains(c.getLevel()) : null);
        return value;
    }

    private static Map<String, Object> dimension(HypeScoreCurrent c, String code, double target, boolean available) {
        double raw = available ? dim(c, "LONGEVITY".equals(code) ? "longevity" : "rarity") : -1;
        Double current = raw < 0 ? null : Math.round(raw * 10) / 10.0;
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("dimension", code); value.put("current", current); value.put("target", target); value.put("maximum", 100);
        value.put("missing", current == null ? null : Math.round(Math.max(0, target - raw) * 10) / 10.0);
        value.put("met", current == null ? null : raw >= target);
        return value;
    }

    /** Texto do critério no idioma de quem lê. */
    static String criteria(String code, int[] t) {
        return switch (code) {
            case VIRAL -> Msg.t("hypeSeal.criteria.VIRAL", threshold(t, HypeLevel.VIRAL));
            case TRENDING -> Msg.t("hypeSeal.criteria.TRENDING", threshold(t, HypeLevel.HOT));
            case EMERGING -> Msg.t("hypeSeal.criteria.EMERGING");
            case CLASSIC -> Msg.t("hypeSeal.criteria.CLASSIC", Math.round(CLASSIC_LONGEVITY_MIN), threshold(t, CLASSIC_LEVEL_MIN));
            case RARE -> Msg.t("hypeSeal.criteria.RARE", Math.round(RARE_RARITY_MIN), threshold(t, RARE_LEVEL_MIN));
            default -> code;
        };
    }

    /** Score mínimo da faixa (limiares do HypeScoreConfig: NICHE, RELEVANT, HOT, TRENDING, VIRAL). */
    static int threshold(int[] t, HypeLevel level) {
        int i = level.ordinal() - 1;
        return t == null || i < 0 || i >= t.length ? 0 : t[i];
    }

    static boolean eligible(HypeScoreCurrent c) {
        return c != null && c.getStatus() == HypeStatus.AVAILABLE && c.isPublicEligible() && c.getScore() != null;
    }

    private static boolean atLeast(HypeLevel level, HypeLevel min) {
        return level != null && level.ordinal() >= min.ordinal();
    }

    private static double dim(HypeScoreCurrent c, String name) {
        if (c.getDimensions() == null) {
            return -1;
        }
        java.math.BigDecimal v = "longevity".equals(name) ? c.getDimensions().getLongevity() : c.getDimensions().getRarity();
        return v == null ? -1 : v.doubleValue();
    }
}

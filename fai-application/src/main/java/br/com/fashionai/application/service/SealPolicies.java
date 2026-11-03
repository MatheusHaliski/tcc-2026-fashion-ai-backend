package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF25 — política padronizada do selo: regras que o sistema avalia sozinho nos criadores de peça (RF4) e de look
 * (RF5), no lugar de um texto livre separado por vírgulas.
 *
 * <pre>
 * { "match": "ALL" | "ANY",
 *   "rules": [ { "quantifier": "AT_LEAST", "count": 3, "color": "Azul", "brand": "Zara", "category": null, "subcategory": null },
 *              { "quantifier": "ALL",      "color": "Amarelo", "brand": "Adidas" },
 *              { "quantifier": "NONE",     "color": "Preto" } ],
 *   "occasions": ["party"], "styles": ["streetwear"],
 *   "hype": { "minLevel": "RELEVANT", "minScore": 60, "momentum": ["RISING", "EMERGING"] } }
 * </pre>
 *
 * Cada regra filtra peças por cor (família da taxonomia, como "Azul", ou a cor exata, como "navy"), marca, categoria,
 * subcategoria e Hype mínimo da peça ({@code hypeMin}, um HypeLevel); o quantificador diz quantas peças do look precisam
 * passar no filtro: no mínimo N, todas ou nenhuma. No selo de PEÇA a peça precisa passar em cada filtro (NONE: não pode
 * passar). Ocasiões e estilos do selo são tags: com os dois lados preenchidos, o look/peça precisa ter ao menos uma em
 * comum.
 *
 * <p>RF53 — critério de Hype ({@code hype}): vale para a ENTIDADE avaliada (selo de PEÇA → o HypeScore v2 atual da
 * peça; selo de LOOK → o do look). Nível e score juntos = os dois precisam valer; {@code momentum} = qualquer um da
 * lista. Sem Hype disponível (não calculado ou dados insuficientes) o critério NÃO é atendido. O Hype alimenta o selo;
 * o selo nunca alimenta o Hype (nenhum vínculo vira sinal do HypeCalculator).
 */
public final class SealPolicies {
    public static final List<String> QUANTIFIERS = List.of("AT_LEAST", "ALL", "NONE");
    public static final int MAX_RULES = 6;
    public static final int MAX_TAGS = 4;
    /** RF53 — no máximo 3 momentos de Hype aceitos num critério (EMERGING, RISING, STABLE, COOLING, CLASSIC). */
    public static final int MAX_HYPE_MOMENTUM = 3;
    public static final Set<String> HYPE_DIMENSIONS = Set.of("POPULARITY", "ENGAGEMENT", "TREND", "TREND_VELOCITY", "ORIGINALITY", "RARITY", "LONGEVITY", "NOVELTY", "INFLUENCE");

    private SealPolicies() {
    }

    /** {@code hypeMin}: a peça só passa no filtro com Hype atual ≥ esse nível (nulo = sem filtro de Hype). */
    public record Rule(String quantifier, int count, String color, String brand, String category, String subcategory, HypeLevel hypeMin) {
        public Rule(String quantifier, int count, String color, String brand, String category, String subcategory) {
            this(quantifier, count, color, brand, category, subcategory, null);
        }
    }

    /** RF53 — critério de Hype da entidade avaliada; campos nulos/vazios não restringem. */
    public record HypeCriteria(HypeLevel minLevel, Integer minScore, List<HypeMomentum> momentum, Map<String, Integer> dimensionMins) {
        public HypeCriteria(HypeLevel minLevel, Integer minScore, List<HypeMomentum> momentum) {
            this(minLevel, minScore, momentum, Map.of());
        }
        public boolean isEmpty() {
            return minLevel == null && minScore == null && (momentum == null || momentum.isEmpty()) && (dimensionMins == null || dimensionMins.isEmpty());
        }
    }

    public record Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles, HypeCriteria hype,
                         Map<String, Object> referenceModel) {
        public Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles, HypeCriteria hype) {
            this(any, rules, occasions, styles, hype, null);
        }
        public Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles) {
            this(any, rules, occasions, styles, null);
        }

        public boolean isEmpty() {
            return rules.isEmpty() && occasions.isEmpty() && styles.isEmpty() && hype == null && referenceModel == null;
        }

        /** A política usa Hype (critério da entidade ou {@code hypeMin} em alguma regra)? */
        public boolean usesHype() {
            return hype != null || rules.stream().anyMatch(r -> r.hypeMin() != null);
        }
    }

    /**
     * RF53 — fato de Hype de uma peça ou look: score (0–100), faixa, momento e se está disponível (status AVAILABLE com
     * score). Vem sempre do HypeScore v2 atual ({@code hype_scores}, versão corrente do algoritmo).
     */
    public record HypeFact(Double score, HypeLevel level, HypeMomentum momentum, boolean available, Map<String, Double> dimensions) {
        public HypeFact(Double score, HypeLevel level, HypeMomentum momentum, boolean available) {
            this(score, level, momentum, available, Map.of());
        }
        public static HypeFact of(HypeScoreCurrent c) {
            if (c == null) {
                return null;
            }
            boolean ok = c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
            return new HypeFact(c.getScore() == null ? null : c.getScore().doubleValue(), c.getLevel(), c.getMomentum(), ok, SealPolicies.dimensions(c.getDimensions()));
        }

        /** {@code {score, level}} das sugestões (score com 1 casa); nulo quando não há Hype disponível. */
        public Map<String, Object> view() {
            if (!available) {
                return null;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("score", score == null ? null : Math.round(score * 10) / 10.0);
            m.put("level", level == null ? null : level.name());
            return m;
        }
    }

    public static Map<String, Double> dimensions(HypeDimensions d) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (d == null) return out;
        Map<String, java.math.BigDecimal> values = new LinkedHashMap<>();
        values.put("POPULARITY", d.getPopularity()); values.put("ENGAGEMENT", d.getEngagement());
        values.put("TREND", d.getTrend()); values.put("TREND_VELOCITY", d.getTrendVelocity());
        values.put("ORIGINALITY", d.getOriginality()); values.put("RARITY", d.getRarity());
        values.put("LONGEVITY", d.getLongevity()); values.put("NOVELTY", d.getNovelty()); values.put("INFLUENCE", d.getInfluence());
        values.forEach((key, value) -> { if (value != null) out.put(key, value.doubleValue()); });
        return out;
    }

    /** RF53 — de onde a avaliação tira o Hype: de cada peça e do look avaliado. Nulo = sem Hype (critério não atendido). */
    public interface HypeLookup {
        /** Sem Hype nenhum: as assinaturas antigas de {@code evaluate} usam esta (critério de Hype nunca atendido). */
        HypeLookup NONE = new HypeLookup() {
            @Override
            public HypeFact piece(UUID pieceId) {
                return null;
            }

            @Override
            public HypeFact look() {
                return null;
            }
        };

        default long earnedSealCount(UUID sealId, String scope, List<UUID> pieceIds) { return 0; }

        HypeFact piece(UUID pieceId);

        HypeFact look();

        /** Lookup a partir das linhas atuais (em lote) das peças e do look; {@code look} nulo = look ainda não salvo. */
        static HypeLookup of(Map<UUID, HypeScoreCurrent> pieces, HypeScoreCurrent look) {
            Map<UUID, HypeScoreCurrent> p = pieces == null ? Map.of() : pieces;
            HypeFact l = HypeFact.of(look);
            return new HypeLookup() {
                @Override
                public HypeFact piece(UUID pieceId) {
                    return pieceId == null ? null : HypeFact.of(p.get(pieceId));
                }

                @Override
                public HypeFact look() {
                    return l;
                }
            };
        }
    }

    /** Resultado da avaliação: atende? quais peças sustentam o selo e por quê (texto da regra que bateu). */
    public record Verdict(boolean matched, List<UUID> pieceIds, String why) {
    }

    // ------------------------------------------------------------------ validação, leitura, avaliação e texto
    // (regras em SealPolicyNormalizer, SealPolicyParser, SealPolicyEvaluator e SealPolicyText)

    /** Valida o JSON vindo da tela; devolve null quando não há política (selo sem regras). Erros viram 400 legíveis. */
    public static Map<String, Object> normalize(Map<String, Object> raw) {
        return SealPolicyNormalizer.normalize(raw);
    }

    public static Policy parse(Object stored) {
        return SealPolicyParser.parse(stored);
    }

    /**
     * Avalia a política contra as peças de um look (tier LOOK) ou contra uma única peça (tier PECA). Ocasiões/estilos
     * vazios de um dos lados não bloqueiam. Sem Hype à mão: critério de Hype (e {@code hypeMin}) nunca é atendido; a
     * política sem Hype se comporta exatamente como antes.
     */
    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles) {
        return evaluate(p, tier, pieces, occasions, styles, HypeLookup.NONE);
    }

    /**
     * RF53 — avaliação com o Hype atual das peças e do look. O critério {@code hype} da política vale para a entidade
     * avaliada: no tier PECA, cada peça avaliada; no tier LOOK, o look ({@link HypeLookup#look()}, nulo para look ainda
     * não salvo). {@code hypeMin} das regras usa o Hype de cada peça.
     */
    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles,
                                   HypeLookup hype) {
        return evaluate(p, tier, pieces, occasions, styles, hype, Map.of());
    }

    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles,
                                   HypeLookup hype, Map<String, Object> background) {
        return SealPolicyEvaluator.evaluate(p, tier, pieces, occasions, styles, hype, background);
    }

    /**
     * RF53 — o fato de Hype atende ao critério? Sem Hype disponível (não calculado, dados insuficientes) → não.
     * Nível compara a faixa; score compara o número exibido (arredondado), como a faixa.
     */
    public static boolean meets(HypeCriteria c, HypeFact f) {
        return SealPolicyEvaluator.meets(c, f);
    }

    /** "Azul" casa com navy/denim/cobalt…; "navy" só com navy. */
    static boolean colorMatches(String wanted, String color) {
        return SealPolicyEvaluator.colorMatches(wanted, color);
    }

    /** Frase da política inteira: o que o card do selo mostra no lugar do antigo texto livre. */
    public static String describe(Policy p, SealTier tier) {
        return SealPolicyText.describe(p, tier);
    }

    /** Rótulo da faixa de Hype no idioma de quem lê ("Em alta", "Viral"…). */
    public static String levelLabel(HypeLevel level) {
        return SealPolicyText.levelLabel(level);
    }
}

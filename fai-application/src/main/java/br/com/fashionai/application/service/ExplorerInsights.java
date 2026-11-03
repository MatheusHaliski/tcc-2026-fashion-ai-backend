package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ExplorerHype.PublicPiece;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ExplorerService.BRAND_TOP_ITEMS;
import static br.com.fashionai.application.service.ExplorerService.MIN_BRAND_ITEMS;
import static br.com.fashionai.application.service.ExplorerService.RANKING_ROWS;

/**
 * Insights globais (RF26 + RF53 · P2-04): rankings de volume e de HypeScore v2 público (categorias, cores, marcas,
 * estações e crescimento por categoria, só grupos com itens suficientes) e a leitura textual pelo Insight Generator.
 */
final class ExplorerInsights {
    private final AnalyticsQueryPort analytics;
    private final AiEngine ai;
    private final ExplorerHype hypes;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final SchemeRepository schemes;

    ExplorerInsights(AnalyticsQueryPort analytics, AiEngine ai, ExplorerHype hypes, HypeScoreCurrentRepository hypeScores,
                     HypeScoreConfig hypeConfig, SchemeRepository schemes) {
        this.analytics = analytics;
        this.ai = ai;
        this.hypes = hypes;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.schemes = schemes;
    }

    // ================================================================== Insights globais (RF26 + RF53 · P2-04)
    /** Uma linha agregada: rótulo, média, quantos itens públicos e (quando é score) a faixa. */
    record Agg(String key, double value, int items) {
    }

    /** Média por grupo, só grupos com ≥ {@link ExplorerService#MIN_BRAND_ITEMS} itens; {@code top} limita a média aos N maiores (marcas). */
    static <T> List<Agg> averageBy(List<T> pool, Function<T, String> key, Function<T, Double> value, int top) {
        Map<String, List<Double>> groups = new LinkedHashMap<>();
        for (T x : pool) {
            String k = key.apply(x);
            Double v = value.apply(x);
            if (k != null && !k.isBlank() && v != null) {
                groups.computeIfAbsent(k, z -> new ArrayList<>()).add(v);
            }
        }
        List<Agg> out = new ArrayList<>();
        groups.forEach((k, vs) -> {
            if (vs.size() >= MIN_BRAND_ITEMS) {
                double avg = vs.stream().sorted(Comparator.reverseOrder()).limit(top <= 0 ? vs.size() : top).mapToDouble(Double::doubleValue).average().orElse(0);
                out.add(new Agg(k, SearchHype.round1(avg), vs.size()));
            }
        });
        out.sort(Comparator.comparingDouble(Agg::value).reversed().thenComparing(Agg::key));
        return out;
    }

    private List<Map<String, Object>> rows(List<Agg> list, boolean withLevel, Function<String, String> label, boolean withHex) {
        return list.stream().limit(RANKING_ROWS).map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", label.apply(a.key()));
            m.put("value", a.value());
            if (withLevel) {
                m.put("level", (hypeConfig == null ? HypeScoreConfig.defaults() : hypeConfig).level(a.value()).name());
            }
            m.put("items", a.items());
            if (withHex) {
                m.put("hex", String.valueOf(Taxonomy.hex(a.key())));
            }
            return m;
        }).toList();
    }

    /**
     * Rankings de Hype v2 sobre a população pública ({@code publicEligible} + AVAILABLE): categorias, cores e marcas pela
     * média (marca = média das 5 mais relevantes, como no "Em alta"), estações pelos looks e o CRESCIMENTO (dimensão
     * TREND) por categoria — separado de volume/popularidade. Grupo com menos de {@link ExplorerService#MIN_BRAND_ITEMS} itens fica fora.
     */
    Map<String, Object> hypeRankings() {
        List<PublicPiece> ps = hypes.publicPieces();
        Map<String, String> brandName = new HashMap<>();
        ps.forEach(p -> {
            String k = ExplorerHype.brandKey(p.piece());
            if (k != null) {
                String n = p.piece().getBrand() != null ? p.piece().getBrand().getName() : p.piece().getBrandName();
                brandName.putIfAbsent(k, n.trim());
            }
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", hypeConfig == null ? null : hypeConfig.algorithmVersion());
        out.put("minItems", MIN_BRAND_ITEMS);
        out.put("byCategory", rows(averageBy(ps, p -> p.hype().getCategory() != null ? p.hype().getCategory() : p.piece().getCategory(), PublicPiece::score, 0),
                true, Function.identity(), false));
        out.put("byColor", rows(averageBy(ps, p -> p.piece().getColor(), PublicPiece::score, 0), true, Function.identity(), true));
        out.put("byBrand", rows(averageBy(ps, p -> ExplorerHype.brandKey(p.piece()), PublicPiece::score, BRAND_TOP_ITEMS), true,
                k -> brandName.getOrDefault(k, k), false));
        out.put("bySeason", rows(seasonAverages(), true, Function.identity(), false));
        // crescimento ≠ popularidade: média da dimensão TREND (50 = estável), não volume nem curtidas
        out.put("growthByCategory", rows(averageBy(ps, p -> p.hype().getCategory() != null ? p.hype().getCategory() : p.piece().getCategory(),
                p -> SearchHype.trendFor(p.hype(), false), 0), false, Function.identity(), false));
        return out;
    }

    /** Hype v2 médio por estação, a partir dos looks públicos (mesma base do ranking v1, agora sem o v1). */
    List<Agg> seasonAverages() {
        if (hypeScores == null || hypeConfig == null || schemes == null) {
            return List.of();
        }
        List<HypeScoreCurrent> pool = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME,
                hypeConfig.algorithmVersion(), HypeStatus.AVAILABLE).stream().filter(c -> SearchHype.publicRow(c) != null).toList();
        if (pool.isEmpty()) {
            return List.of();
        }
        Map<UUID, Scheme> byId = schemes.findByIdIn(pool.stream().map(HypeScoreCurrent::getEntityId).toList()).stream()
                .collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a));
        return averageBy(pool, c -> byId.get(c.getEntityId()) == null || byId.get(c.getEntityId()).getSeason() == null ? null
                : byId.get(c.getEntityId()).getSeason().name(), c -> c.getScore().doubleValue(), 0);
    }

    /** Insights globais — rankings + leitura textual (Insight Generator, RF24; fallback local). */
    Map<String, Object> insights(CurrentUser viewer) {
        Map<String, Object> hype = hypeRankings();
        Map<String, Object> rankings = new LinkedHashMap<>();
        // volume (popularidade): só peças públicas — a contagem total da view incluía peças privadas
        rankings.put("topBrands", analytics.brandUsage(500).stream().filter(r -> r.get("public_pieces") instanceof Number n && n.longValue() > 0)
                .sorted(Comparator.comparingLong((Map<String, Object> r) -> ((Number) r.get("public_pieces")).longValue()).reversed()
                        .thenComparing(r -> String.valueOf(r.get("brand"))))
                .limit(RANKING_ROWS).map(r -> Map.of("label", r.get("brand"), "value", r.get("public_pieces"))).toList());
        // Hype: v2 público (mesmas chaves de antes, agora com faixa e base de itens; o v1 saiu desta aba)
        rankings.put("hypeBySeason", hype.get("bySeason"));
        rankings.put("topColors", analytics.colorRanking(null, 5).stream().map(r -> Map.of("label", r.get("color"), "value", r.get("total"),
                "hex", String.valueOf(Taxonomy.hex(String.valueOf(r.get("color")))))).toList());
        rankings.put("hypeByColor", hype.get("byColor"));
        rankings.put("hypeByBrand", hype.get("byBrand"));
        rankings.put("topCountries", analytics.countries().stream().sorted(Comparator.comparingLong((Map<String, Object> r) ->
                ((Number) r.get("public_schemes")).longValue()).reversed()).limit(5).map(r -> Map.of("label", r.get("country"), "value", r.get("public_schemes"))).toList());
        Map<String, Object> forText = new LinkedHashMap<>(rankings);
        forText.put("growthByCategory", hype.get("growthByCategory"));
        String local = LocalAdvisors.insightText(forText);
        if (viewer == null) {
            return Map.of("rankings", rankings, "hype", hype, "aiInsight", local, "explanation", Msg.t("explorer.leitura_local_faca_login_para"),
                    "fallbackUsed", false, "note", Msg.t("explorer.cores_de_status_do_dataviz"));
        }
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(viewer.id(), AiCapability.INSIGHT_GENERATOR,
                "Você é o Insight Generator do Fashion AI. Escreva UMA leitura de tendência (até 2 frases, em " + Msg.languageName() + ") a partir dos rankings agregados. "
                        + "Não invente números; use só os dados. HypeScore mede relevância atual (não qualidade) e é diferente de volume; "
                        + "growthByCategory é crescimento recente (tendência), não popularidade.", "Rankings: " + Json.write(forText), List.of(), 250,
                List.of(Msg.t("explorer.rankings_agregados_sem_dados_pessoais")), text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 400), () -> local, null));
        return Map.of("rankings", rankings, "hype", hype, "aiInsight", outcome.value() == null ? local : outcome.value(), "explanation", outcome.explanation(),
                "fallbackUsed", outcome.fallbackUsed(), "note", Msg.t("explorer.cores_de_status_do_dataviz"));
    }
}

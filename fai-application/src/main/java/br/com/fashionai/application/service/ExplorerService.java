package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * RF26 — Explorador Global: Painel global (globo por País, intensidade = hype médio), Buscar marcas & lojas (grade com
 * filtros de país, categoria, cor e ordenação por hype) e Insights globais (rankings calculados sobre hypeScore/
 * hypeScoreGlobal + leitura textual pelo mesmo motor de IA). Só cruza dados já coletados; nenhum campo novo além de
 * User.country. Agregações feitas no MySQL (views e GROUP BY da V6).
 */
@Service
public class ExplorerService {
    private final AnalyticsQueryPort analytics;
    private final BrandProfileRepository brands;
    private final SealBondRepository bonds;
    private final AiEngine ai;

    public ExplorerService(AnalyticsQueryPort analytics, BrandProfileRepository brands, SealBondRepository bonds, AiEngine ai) {
        this.analytics = analytics;
        this.brands = brands;
        this.bonds = bonds;
        this.ai = ai;
    }

    /** Mínimo de peças + looks públicos para um país acender no globo (CA01 — "com dados suficientes"). */
    public static final int MIN_DATA = 3;
    /** Faixas do hypeScore (mesmas do RF6/dashboard). */
    public static final Map<String, double[]> HYPE_BANDS = new LinkedHashMap<>();

    static {
        HYPE_BANDS.put("DESPRETENSIOSO", new double[]{0, 15});
        HYPE_BANDS.put("EM_CONSTRUCAO", new double[]{15, 30});
        HYPE_BANDS.put("NOTADO", new double[]{30, 50});
        HYPE_BANDS.put("COM_ESTILO", new double[]{50, 70});
        HYPE_BANDS.put("MUITO_ESTILOSO", new double[]{70, 85});
        HYPE_BANDS.put("ARRASANDO_NO_LOOK", new double[]{85, 96});
        HYPE_BANDS.put("ICONE_DE_ESTILO", new double[]{96, 101});
    }

    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry) {
        return globalPanel(viewer, selectedCountry, null, null, null);
    }

    /**
     * RF26.CA01 — painel global: um ponto por país com dados suficientes, agrupando peças e esquemas públicos pelo país do
     * dono (User.country — CA04: nenhum campo de região em peça/esquema), com recorte por estação, cor e faixa de hype.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> globalPanel(CurrentUser viewer, String selectedCountry, String season, String color, String hypeBand) {
        String se = season == null || season.isBlank() ? null : season.trim().toUpperCase(Locale.ROOT);
        if (se != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(se)) {
            throw ApiException.badRequest("ESTACAO_INVALIDA", Msg.t("explorer.estacoes_spring_summer_autumn_winter"));
        }
        String co = color == null || color.isBlank() ? null : color.trim();
        if (co != null && !Taxonomy.COLORS.containsKey(co)) {
            throw ApiException.badRequest("COR_INVALIDA", Msg.t("explorer.cor_fora_da_taxonomia", co));
        }
        String band = hypeBand == null || hypeBand.isBlank() ? null : hypeBand.trim().toUpperCase(Locale.ROOT);
        if (band != null && !HYPE_BANDS.containsKey(band)) {
            throw ApiException.badRequest("FAIXA_INVALIDA", Msg.t("explorer.faixas_de_hype", HYPE_BANDS.keySet()));
        }
        double[] range = band == null ? null : HYPE_BANDS.get(band);
        AnalyticsQueryPort.GlobalFilter gf = new AnalyticsQueryPort.GlobalFilter(se, co, range == null ? null : range[0], range == null ? null : range[1]);
        Map<String, String> dominantColor = new HashMap<>();
        Map<String, Long> best = new HashMap<>();
        for (Map<String, Object> r : analytics.countryColors()) {
            String c = String.valueOf(r.get("country"));
            long n = ((Number) r.get("total")).longValue();
            if (n > best.getOrDefault(c, -1L)) {
                best.put(c, n);
                dominantColor.put(c, String.valueOf(r.get("color")));
            }
        }
        Map<String, Map<String, Object>> byCountry = new LinkedHashMap<>();
        for (Map<String, Object> r : analytics.schemesByCountry(gf)) {
            Map<String, Object> m = byCountry.computeIfAbsent(String.valueOf(r.get("country")), k -> new LinkedHashMap<>(Map.of("country", k, "schemes", 0L, "pieces", 0L)));
            m.put("schemes", ((Number) r.get("schemes")).longValue());
            m.put("avg_hype", r.get("avg_hype"));
        }
        for (Map<String, Object> r : analytics.piecesByCountry(gf)) {
            Map<String, Object> m = byCountry.computeIfAbsent(String.valueOf(r.get("country")), k -> new LinkedHashMap<>(Map.of("country", k, "schemes", 0L, "pieces", 0L)));
            m.put("pieces", ((Number) r.get("pieces")).longValue());
        }
        List<Map<String, Object>> points = new ArrayList<>();
        for (Map<String, Object> m : byCountry.values()) {
            long total = ((Number) m.get("schemes")).longValue() + ((Number) m.get("pieces")).longValue();
            String c = String.valueOf(m.get("country"));
            String dc = co != null ? co : dominantColor.get(c);
            m.put("total", total);
            m.put("sufficient", total >= MIN_DATA);
            m.put("dominantColor", dc);
            m.put("dominantColorHex", dc == null ? null : Taxonomy.hex(dc));
            m.put("intensity", m.get("avg_hype") == null ? 0 : m.get("avg_hype"));
            m.put("public_schemes", m.get("schemes"));
            points.add(m);
        }
        points.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("total")).longValue()).reversed());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("countries", points);
        out.put("minData", MIN_DATA);
        out.put("filters", Map.of("season", String.valueOf(se), "color", String.valueOf(co), "hypeBand", String.valueOf(band)));
        out.put("facets", Map.of("seasons", List.of("SPRING", "SUMMER", "AUTUMN", "WINTER"), "hypeBands", HYPE_BANDS.keySet(),
                "colors", analytics.colorRanking(null, 12).stream().map(r -> String.valueOf(r.get("color"))).toList()));
        if (selectedCountry != null && !selectedCountry.isBlank()) {
            out.put("selected", Map.of("country", selectedCountry, "hypeBySeason", analytics.hypeBySeason(selectedCountry),
                    "topColors", analytics.colorRanking(selectedCountry, 5)));
        }
        out.put("legend", Msg.t("explorer.um_ponto_por_pais_com", MIN_DATA));
        return out;
    }

    /** Buscar marcas & lojas — grade de cards (userType = BRAND) com filtros e ordenação por hype. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort) {
        return brandsAndStores(viewer, term, country, category, sort, null, null, null);
    }

    /** RF26.CA02 — grade de perfis BRAND com filtros de país, categoria, cor, estação e hypeScore mínimo. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandsAndStores(CurrentUser viewer, String term, String country, String category, String sort,
                                               String color, String season, Integer hypeMin) {
        Map<String, Map<String, Object>> facets = new HashMap<>();
        analytics.brandFacets().forEach(r -> facets.put(String.valueOf(r.get("brand")), r));
        Set<String> countries = new java.util.TreeSet<>();
        Set<String> categories = new java.util.TreeSet<>();
        Map<String, Map<String, Object>> usage = new HashMap<>();
        analytics.brandUsage(500).forEach(r -> usage.put(String.valueOf(r.get("brand")).toLowerCase(Locale.ROOT), r));
        List<Map<String, Object>> cards = new ArrayList<>();
        for (BrandProfile b : brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (b.getCountry() != null) {
                countries.add(b.getCountry());
            }
            if (b.getFashionCategory() != null) {
                categories.add(b.getFashionCategory());
            }
            Map<String, Object> fx = facets.getOrDefault(b.getBrandName().toLowerCase(Locale.ROOT), Map.of());
            List<String> brandColors = Json.csv(String.valueOf(fx.getOrDefault("colors", "")));
            List<String> brandSeasons = Json.csv(String.valueOf(fx.getOrDefault("seasons", "")));
            if (color != null && !color.isBlank() && !brandColors.contains(color.trim())) {
                continue;
            }
            if (season != null && !season.isBlank() && !brandSeasons.contains(season.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (term != null && !term.isBlank() && !b.getBrandName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (country != null && !country.isBlank() && !country.equalsIgnoreCase(String.valueOf(b.getCountry()))) {
                continue;
            }
            if (category != null && !category.isBlank() && !category.equalsIgnoreCase(String.valueOf(b.getFashionCategory()))) {
                continue;
            }
            Map<String, Object> u = usage.getOrDefault(b.getBrandName().toLowerCase(Locale.ROOT), Map.of());
            long schemes = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(b.getOwner().getId(), SealBondStatus.APPROVED).stream()
                    .map(x -> x.getScheme().getId()).distinct().count();
            double hype = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(b.getOwner().getId(), SealBondStatus.APPROVED).stream().map(x -> x.getScheme())
                    .map(Scheme::getHypeScore).filter(Objects::nonNull).mapToDouble(BigDecimal::doubleValue).average()
                    .orElse(u.get("avg_hype") instanceof Number n ? n.doubleValue() : 0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", b.getOwner().getId());
            m.put("slug", b.getSlug());
            m.put("name", b.getBrandName());
            m.put("logoUrl", b.getLogoUrl());
            m.put("country", b.getCountry());
            m.put("category", b.getFashionCategory());
            m.put("schemes", schemes);
            m.put("pieces", u.getOrDefault("pieces", 0));
            m.put("hypeScore", Math.round(hype));
            m.put("stars", Math.max(1, Math.min(5, (int) Math.round(hype / 20.0))));
            m.put("storeUrl", b.getStoreUrl());
            m.put("colors", brandColors.stream().limit(4).map(c -> Map.of("color", c, "hex", String.valueOf(Taxonomy.hex(c)))).toList());
            m.put("seasons", brandSeasons.stream().filter(x -> !x.isBlank() && !"null".equals(x)).toList());
            if (hypeMin != null && Math.round(hype) < hypeMin) {
                continue;
            }
            cards.add(m);
        }
        Comparator<Map<String, Object>> cmp = "SCHEMES".equalsIgnoreCase(sort)
                ? Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("schemes")).longValue())
                : Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("hypeScore")).longValue());
        cards.sort(cmp.reversed());
        return Map.of("brands", cards, "filters", Map.of("term", String.valueOf(term), "country", String.valueOf(country), "category", String.valueOf(category),
                        "color", String.valueOf(color), "season", String.valueOf(season), "hypeMin", String.valueOf(hypeMin)),
                "sorts", List.of("HYPE", "SCHEMES"), "countries", countries, "categories", categories,
                "seasons", List.of("spring", "summer", "autumn", "winter"));
    }

    /** Insights globais — rankings + leitura textual (Insight Generator, RF24; fallback local). */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer) {
        Map<String, Object> rankings = new LinkedHashMap<>();
        rankings.put("topBrands", analytics.brandUsage(5).stream().map(r -> Map.of("label", r.get("brand"), "value", r.get("pieces"))).toList());
        rankings.put("hypeBySeason", analytics.hypeBySeason(null).stream().map(r -> Map.of("label", String.valueOf(r.get("season")),
                "value", r.get("avg_hype") == null ? 0 : r.get("avg_hype"))).toList());
        rankings.put("topColors", analytics.colorRanking(null, 5).stream().map(r -> Map.of("label", r.get("color"), "value", r.get("total"),
                "hex", String.valueOf(Taxonomy.hex(String.valueOf(r.get("color")))))).toList());
        rankings.put("hypeByColor", analytics.hypeByColor(5).stream().map(r -> Map.of("label", r.get("color"), "value", r.get("avg_hype"),
                "hex", String.valueOf(Taxonomy.hex(String.valueOf(r.get("color")))))).toList());
        rankings.put("hypeByBrand", analytics.hypeByBrand(5).stream().map(r -> Map.of("label", r.get("brand"), "value", r.get("avg_hype"))).toList());
        rankings.put("topCountries", analytics.countries().stream().sorted(Comparator.comparingLong((Map<String, Object> r) ->
                ((Number) r.get("public_schemes")).longValue()).reversed()).limit(5).map(r -> Map.of("label", r.get("country"), "value", r.get("public_schemes"))).toList());
        String local = LocalAdvisors.insightText(rankings);
        if (viewer == null) {
            return Map.of("rankings", rankings, "aiInsight", local, "explanation", Msg.t("explorer.leitura_local_faca_login_para"),
                    "fallbackUsed", false, "note", Msg.t("explorer.cores_de_status_do_dataviz"));
        }
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(viewer.id(), AiCapability.INSIGHT_GENERATOR,
                "Você é o Insight Generator do Fashion AI. Escreva UMA leitura de tendência (até 2 frases, português) a partir dos rankings agregados. "
                        + "Não invente números; use só os dados.", "Rankings: " + Json.write(rankings), List.of(), 250,
                List.of(Msg.t("explorer.rankings_agregados_sem_dados_pessoais")), text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 400), () -> local, null));
        return Map.of("rankings", rankings, "aiInsight", outcome.value() == null ? local : outcome.value(), "explanation", outcome.explanation(),
                "fallbackUsed", outcome.fallbackUsed(), "note", Msg.t("explorer.cores_de_status_do_dataviz"));
    }
}
